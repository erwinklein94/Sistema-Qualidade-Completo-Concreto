-- Testes transacionais do registro de acessos: nada fica gravado.
begin;
select set_config('teste.consulta', (select id::text from public.usuarios_app where ativo and perfil::text = 'consulta' limit 1), true);
select set_config('teste.admin', (select id::text from public.usuarios_app where ativo and perfil::text = 'admin' limit 1), true);

-- Consulta registra a própria página; usuário e horário vêm do banco.
select set_config('request.jwt.claim.sub', current_setting('teste.consulta'), true);
set local role authenticated;
do $$ begin
  insert into public.usuarios_acessos (pagina, titulo) values ('producao.html', 'Produção de Dormentes');
  insert into public.usuarios_acessos (pagina) values ('subcomponentes.html#estoque');
  begin
    insert into public.usuarios_acessos (usuario_id, pagina) values (gen_random_uuid(), 'index.html');
    raise exception 'Consulta escolheu o usuário do acesso';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.usuarios_acessos (pagina, acessado_em) values ('index.html', now() - interval '1 year');
    raise exception 'Consulta escolheu o horário do acesso';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.usuarios_acessos (pagina) values ('producao.html?id=123');
    raise exception 'Página com parâmetros aceita';
  exception when check_violation then null; end;
  assert (select count(*) from public.usuarios_acessos) = 0, 'Consulta leu acessos';
  assert (select count(*) from public.usuarios_acessos_resumo) = 0, 'Consulta leu o resumo';
end $$;
reset role;

-- Admin não gera registro, mas lê tudo.
select set_config('request.jwt.claim.sub', current_setting('teste.admin'), true);
set local role authenticated;
do $$ begin
  begin
    insert into public.usuarios_acessos (pagina) values ('usuarios.html');
    raise exception 'Acesso do admin registrado';
  exception when insufficient_privilege then null; end;
  assert (select count(*) from public.usuarios_acessos where usuario_id = current_setting('teste.consulta')::uuid and acessado_em > now() - interval '1 minute') = 2, 'Admin não vê os acessos';
  assert (select acessos from public.usuarios_acessos_resumo where usuario_id = current_setting('teste.consulta')::uuid and pagina = 'producao.html') >= 1, 'Resumo sem a página';
  begin
    update public.usuarios_acessos set pagina = 'index.html';
    raise exception 'Admin editou acessos';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Sem usuário ativo e anônimo não gravam nem leem.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
set local role authenticated;
do $$ begin
  begin
    insert into public.usuarios_acessos (pagina) values ('index.html');
    raise exception 'Sessão sem usuário ativo registrou acesso';
  exception when insufficient_privilege or foreign_key_violation or not_null_violation then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform * from public.usuarios_acessos; raise exception 'Anônimo leu acessos';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: não admin registra só a própria página; admin não registra e lê tudo; ninguém forja usuário/horário; anônimo bloqueado' as resultado;
