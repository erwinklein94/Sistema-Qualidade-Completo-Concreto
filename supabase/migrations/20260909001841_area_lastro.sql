-- Checklist fixo de 13 itens: gravação atômica do relatório e preservação da fonte.
create table public.lastro_inspecoes (
 id uuid primary key default gen_random_uuid(),
 audit_id text unique,
 audit_nome text,
 origem_dados text not null default 'manual' check (origem_dados in ('manual','historico')),
 fornecedor text,
 data_inspecao date,
 responsavel text,
 localizacao text,
 respostas jsonb not null default '{}'::jsonb check (jsonb_typeof(respostas)='object'),
 notas_gerais jsonb not null default '{}'::jsonb check (jsonb_typeof(notas_gerais)='object'),
 observacoes text,
 status text not null default 'rascunho' check (status in ('rascunho','concluida')),
 dados_originais jsonb,
 fonte_arquivo text,
 fonte_linha integer,
 fonte_sha256 text,
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 criado_por uuid references auth.users(id) on delete set null,
 atualizado_por uuid references auth.users(id) on delete set null,
 constraint lastro_manual_identificado check (origem_dados='historico' or
   (data_inspecao is not null and nullif(trim(fornecedor),'') is not null and nullif(trim(responsavel),'') is not null)),
 constraint lastro_fonte check ((origem_dados='historico' and audit_id is not null and dados_originais is not null)
   or (origem_dados='manual' and audit_id is null and dados_originais is null and fonte_arquivo is null and fonte_linha is null and fonte_sha256 is null))
);
create index lastro_inspecoes_data_id on public.lastro_inspecoes(data_inspecao desc, id);
create index lastro_inspecoes_criado_por on public.lastro_inspecoes(criado_por);
create index lastro_inspecoes_atualizado_por on public.lastro_inspecoes(atualizado_por);
create function public.lastro_validar_inspecao() returns trigger
language plpgsql set search_path = public as $$
declare k text; v jsonb; resposta text;
begin
 if (select count(*) from jsonb_object_keys(new.respostas)) <> 13 then
   raise exception 'O relatório deve conter os 13 critérios.' using errcode='23514';
 end if;
 for n in 1..13 loop
   k := 'c' || lpad(n::text,2,'0');
   v := new.respostas->k;
   if v is null or jsonb_typeof(v) <> 'object' or not (v ? 'resposta') then
     raise exception 'Critério inválido: %', k using errcode='23514';
   end if;
   resposta := v->>'resposta';
   if resposta is not null and resposta not in ('Sim','Não','N/D') then
     raise exception 'Resposta inválida: %', k using errcode='23514';
   end if;
   if new.status='concluida' and resposta is null then
     raise exception 'Responda aos 13 critérios antes de concluir.' using errcode='23514';
   end if;
 end loop;
 if tg_op='INSERT' then
   new.criado_por := auth.uid(); new.atualizado_por := auth.uid();
   new.criado_em := now(); new.atualizado_em := now();
 else
   new.criado_por := old.criado_por; new.criado_em := old.criado_em;
   new.atualizado_por := auth.uid(); new.atualizado_em := clock_timestamp();
 end if;
 return new;
end $$;
revoke all on function public.lastro_validar_inspecao() from public, anon, authenticated;
create trigger lastro_validar before insert or update on public.lastro_inspecoes
for each row execute function public.lastro_validar_inspecao();
alter table public.lastro_inspecoes enable row level security;
revoke all on public.lastro_inspecoes from anon, authenticated;
grant select, insert, update on public.lastro_inspecoes to authenticated;
create policy lastro_leitura on public.lastro_inspecoes for select to authenticated
using ((select public.usuario_ativo()));
create policy lastro_criar on public.lastro_inspecoes for insert to authenticated
with check ((select public.usuario_ativo()) and (select public.pode_escrever()) and origem_dados='manual');
create policy lastro_editar on public.lastro_inspecoes for update to authenticated
using ((select public.usuario_ativo()) and (select public.pode_escrever()) and origem_dados='manual')
with check ((select public.usuario_ativo()) and (select public.pode_escrever()) and origem_dados='manual');
comment on table public.lastro_inspecoes is 'Histórico importado somente para consulta; inspeções manuais com checklist de pedreira. N/D preservado conforme fonte.';
