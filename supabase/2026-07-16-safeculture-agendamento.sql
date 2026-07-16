-- =====================================================================
-- Agendamento da sincronização SafetyCulture
--
-- PRÉ-REQUISITOS:
-- 1. Edge Function safeculture-sync implantada.
-- 2. Secrets da função cadastrados:
--      SAFETYCULTURE_API_TOKEN
--      SAFETYCULTURE_CRON_SECRET
-- 3. Substitua os placeholders abaixo somente durante a implantação.
--    O script seguro em .tools faz isso em memória e não altera este arquivo.
-- =====================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault;

do $$
declare
  secret_id uuid;
begin
  select id into secret_id from vault.secrets
  where name = 'safeculture_project_url'
  limit 1;

  if secret_id is null then
    perform vault.create_secret(
      'https://kqtvtjgvscjbxrfsbjfg.supabase.co',
      'safeculture_project_url',
      'URL pública do projeto para o cron SafetyCulture'
    );
  else
    perform vault.update_secret(
      secret_id,
      'https://kqtvtjgvscjbxrfsbjfg.supabase.co',
      'safeculture_project_url',
      'URL pública do projeto para o cron SafetyCulture'
    );
  end if;

  select id into secret_id from vault.secrets
  where name = 'safeculture_anon_jwt'
  limit 1;

  if secret_id is null then
    perform vault.create_secret(
      '__SAFECULTURE_ANON_JWT__',
      'safeculture_anon_jwt',
      'JWT público anon usado pelo gateway da Edge Function'
    );
  else
    perform vault.update_secret(
      secret_id,
      '__SAFECULTURE_ANON_JWT__',
      'safeculture_anon_jwt',
      'JWT público anon usado pelo gateway da Edge Function'
    );
  end if;

  select id into secret_id from vault.secrets
  where name = 'safeculture_cron_secret'
  limit 1;

  if secret_id is null then
    perform vault.create_secret(
      '__SAFECULTURE_CRON_SECRET__',
      'safeculture_cron_secret',
      'Segredo interno do agendador SafetyCulture'
    );
  else
    perform vault.update_secret(
      secret_id,
      '__SAFECULTURE_CRON_SECRET__',
      'safeculture_cron_secret',
      'Segredo interno do agendador SafetyCulture'
    );
  end if;
end
$$;

do $$
declare
  job_id bigint;
begin
  select jobid into job_id
  from cron.job
  where jobname = 'safeculture-sync-30min'
  limit 1;

  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;
end $$;

select cron.schedule(
  'safeculture-sync-30min',
  '*/30 * * * *',
  $cron$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'safeculture_project_url'
      limit 1
    ) || '/functions/v1/safeculture-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'safeculture_anon_jwt'
        limit 1
      ),
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'safeculture_anon_jwt'
        limit 1
      ),
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'safeculture_cron_secret'
        limit 1
      )
    ),
    body := '{"action":"sync","origin":"cron"}'::jsonb,
    timeout_milliseconds := 55000
  );
  $cron$
);

-- Reconciliação diária: relê as últimas 48 horas para recuperar relatórios
-- que tenham sido corrigidos, sincronizados com atraso ou temporariamente
-- indisponíveis.
do $$
declare
  job_id bigint;
begin
  select jobid into job_id
  from cron.job
  where jobname = 'safeculture-reconciliacao-diaria'
  limit 1;

  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;
end $$;

select cron.schedule(
  'safeculture-reconciliacao-diaria',
  '15 6 * * *',
  $cron$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'safeculture_project_url'
      limit 1
    ) || '/functions/v1/safeculture-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'safeculture_anon_jwt'
        limit 1
      ),
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'safeculture_anon_jwt'
        limit 1
      ),
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'safeculture_cron_secret'
        limit 1
      )
    ),
    body := '{"action":"sync","origin":"reprocessamento","window_hours":48}'::jsonb,
    timeout_milliseconds := 55000
  );
  $cron$
);
