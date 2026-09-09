begin;
do $$ begin
  assert (select count(*) from public.madeira_inspecoes)=358, 'Histórico incompleto';
  assert has_table_privilege('authenticated','public.madeira_inspecoes','select'), 'Leitura não concedida';
  assert not has_table_privilege('authenticated','public.madeira_inspecoes','insert'), 'Inserção indevida';
  assert not has_table_privilege('authenticated','public.madeira_inspecoes','update'), 'Edição indevida';
  assert not has_table_privilege('authenticated','public.madeira_inspecoes','delete'), 'Exclusão indevida';
  assert not has_table_privilege('anon','public.madeira_inspecoes','select'), 'Leitura anônima indevida';
end $$;
select set_config('request.jwt.claim.sub',(select id::text from public.usuarios_app where ativo limit 1),true);
set local role authenticated;
do $$ begin assert (select count(*) from public.madeira_inspecoes)=358, 'Usuário ativo sem leitura'; end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from public.usuarios_app where not ativo limit 1),true);
set local role authenticated;
do $$ begin assert (select count(*) from public.madeira_inspecoes)=0, 'Usuário inativo leu o histórico'; end $$;
reset role;
rollback;
select 'PASS: histórico íntegro e somente leitura para usuários ativos' resultado;
