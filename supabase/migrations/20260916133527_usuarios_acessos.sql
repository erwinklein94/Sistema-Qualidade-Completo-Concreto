-- Acessos às páginas do site, para o admin acompanhar em Usuários e Perfis.
-- Só usuários ativos que NÃO são admin geram registros; só admin lê.
-- O cliente informa apenas a página e o título: usuário e horário vêm do banco.
create table public.usuarios_acessos (
  id bigint generated always as identity primary key,
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pagina text not null check (pagina ~ '^[A-Za-z0-9._-]{1,120}(#[A-Za-z0-9_-]{1,60})?$'),
  titulo text check (titulo is null or char_length(titulo) <= 200),
  acessado_em timestamptz not null default now()
);
create index usuarios_acessos_usuario_data on public.usuarios_acessos (usuario_id, acessado_em desc);

alter table public.usuarios_acessos enable row level security;
revoke all on table public.usuarios_acessos from anon, authenticated;
grant insert (pagina, titulo) on table public.usuarios_acessos to authenticated;
grant select on table public.usuarios_acessos to authenticated;

create policy usuarios_acessos_registrar
on public.usuarios_acessos for insert to authenticated
with check (usuario_id = (select auth.uid()) and (select public.usuario_ativo()) and not (select public.eh_admin()));

create policy usuarios_acessos_leitura_admin
on public.usuarios_acessos for select to authenticated
using ((select public.eh_admin()));

-- Resumo por usuário e página; security_invoker mantém a regra de leitura só do admin.
create view public.usuarios_acessos_resumo with (security_invoker = true) as
select usuario_id, pagina, max(titulo) as titulo, count(*)::integer as acessos,
       min(acessado_em) as primeiro_acesso, max(acessado_em) as ultimo_acesso
from public.usuarios_acessos
group by usuario_id, pagina;

revoke all on public.usuarios_acessos_resumo from anon, authenticated;
grant select on public.usuarios_acessos_resumo to authenticated;

comment on table public.usuarios_acessos is
'Páginas abertas por usuários não admin (arquivo e #aba, sem parâmetros de URL). Leitura exclusiva do admin.';
