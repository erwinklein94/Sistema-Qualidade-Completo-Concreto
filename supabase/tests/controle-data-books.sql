-- Testes transacionais da página Data books: nenhum registro é alterado.
begin;
do $$ begin
  assert (select count(*) from public.controle_data_books) > 0, 'Tabela sem carga';
  assert has_table_privilege('authenticated', 'public.controle_data_books', 'select'), 'Leitura não concedida';
  assert not has_table_privilege('authenticated', 'public.controle_data_books', 'insert'), 'Inserção indevida';
  assert not has_table_privilege('authenticated', 'public.controle_data_books', 'update'), 'Edição indevida';
  assert not has_table_privilege('authenticated', 'public.controle_data_books', 'delete'), 'Exclusão indevida';
  assert not has_table_privilege('anon', 'public.controle_data_books', 'select'), 'Leitura anônima indevida';
  assert not exists (select 1 from public.controle_data_books where link !~ '^https://'), 'Link fora de https';
end $$;
select set_config('teste.total', (select count(*)::text from public.controle_data_books), true);

-- Os três perfis ativos enxergam todas as linhas.
select set_config('request.jwt.claim.sub', (select id::text from public.usuarios_app where ativo and perfil::text = 'admin' limit 1), true);
set local role authenticated;
do $$ begin assert (select count(*) from public.controle_data_books) = current_setting('teste.total')::bigint, 'Admin sem leitura completa'; end $$;
reset role;

select set_config('request.jwt.claim.sub', (select id::text from public.usuarios_app where ativo and perfil::text in ('fiscalizacao', 'qualidade') limit 1), true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.controle_data_books) = current_setting('teste.total')::bigint, 'Fiscalização sem leitura completa';
  begin
    insert into public.controle_data_books (area, fonte_arquivo, fonte_aba, fonte_linha, fonte_sha256)
    values ('ombreiras', 'teste', 'TESTE', 99999, 'teste');
    raise exception 'Fiscalização gravou';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', (select id::text from public.usuarios_app where ativo and perfil::text = 'consulta' limit 1), true);
set local role authenticated;
do $$ begin assert (select count(*) from public.controle_data_books) = current_setting('teste.total')::bigint, 'Consulta sem leitura completa'; end $$;
reset role;

-- Sessão sem usuário ativo e visitante anônimo não veem nada.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
set local role authenticated;
do $$ begin assert (select count(*) from public.controle_data_books) = 0, 'Usuário sem perfil ativo leu registros'; end $$;
reset role;

set local role anon;
do $$ begin
  begin perform * from public.controle_data_books; raise exception 'Anônimo leu registros';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: admin, fiscalização e consulta leem tudo; ninguém grava; sem perfil ativo e anônimo não leem' as resultado;
