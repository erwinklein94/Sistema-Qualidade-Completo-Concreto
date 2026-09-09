-- Testes transacionais no projeto já configurado: nenhum registro de teste permanece.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.usuarios_app where perfil='fiscalizacao' and ativo limit 1),true);
set local role authenticated;
do $$
declare respostas jsonb; novo uuid; afetadas integer;
begin
 assert (select count(*) from public.lastro_inspecoes where origem_dados='historico')=71, 'Histórico incompleto';
 select jsonb_object_agg('c'||lpad(n::text,2,'0'),jsonb_build_object('resposta','Sim','notas',null)) into respostas from generate_series(1,13) n;
 insert into public.lastro_inspecoes(fornecedor,data_inspecao,responsavel,status,respostas)
 values ('TESTE TRANSACIONAL',current_date,'Fiscal teste','concluida',respostas) returning id into novo;
 update public.lastro_inspecoes set observacoes='Persistência verificada' where id=novo;
 assert (select observacoes='Persistência verificada' from public.lastro_inspecoes where id=novo), 'Falha ao editar';
 update public.lastro_inspecoes set observacoes='Não deve alterar' where origem_dados='historico';
 get diagnostics afetadas=row_count;
 assert afetadas=0, 'Histórico editável';
 begin
   update public.lastro_inspecoes l set respostas=jsonb_set(l.respostas,'{c01,resposta}','null') where id=novo;
   raise exception 'Conclusão incompleta aceita';
 exception when check_violation then null; end;
 begin
   delete from public.lastro_inspecoes where id=novo;
   raise exception 'Exclusão aceita';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from public.usuarios_app where perfil='consulta' and ativo limit 1),true);
set local role authenticated;
do $$ begin
 assert (select count(*) from public.lastro_inspecoes)>0, 'Consulta sem leitura';
 begin
   insert into public.lastro_inspecoes(fornecedor,data_inspecao,responsavel,respostas)
   select 'TESTE',current_date,'TESTE',respostas from public.lastro_inspecoes limit 1;
   raise exception 'Consulta gravou';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from public.usuarios_app where not ativo limit 1),true);
set local role authenticated;
do $$ begin assert (select count(*) from public.lastro_inspecoes)=0, 'Inativo leu registros'; end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.lastro_inspecoes; raise exception 'Anônimo leu registros';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: leitura, criação, edição, validação, histórico protegido, consulta, inativo e anônimo' as resultado;
