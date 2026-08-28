-- Encerra os agendamentos externos sem remover os dados ja importados.
do $$
declare job record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for job in select jobid from cron.job
      where jobname in ('safeculture-sync-30min', 'safeculture-reconciliacao-diaria')
         or command ilike '%safeculture-sync%'
    loop
      perform cron.unschedule(job.jobid);
    end loop;
  end if;
end $$;

update public.safeculture_estado_sync set ativo = false, atualizado_em = now() where id = true;
