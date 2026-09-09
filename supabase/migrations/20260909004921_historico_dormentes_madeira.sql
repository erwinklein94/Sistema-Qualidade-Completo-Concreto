-- Histórico dos relatórios de recebimento de dormentes de madeira.
-- Registros importados são somente leitura no aplicativo.
create table public.madeira_inspecoes (
  id uuid primary key default gen_random_uuid(),
  audit_id text not null unique,
  audit_nome text,
  template_id text,
  template_nome text not null,
  tipo_relatorio text not null check (tipo_relatorio in ('recebimento_v1','recebimento_v2','recebimento_v3','recebimento_v4','dormente_lei_fornecedor')),
  fornecedor text,
  data_inspecao date,
  localizacao text,
  responsavel text,
  projeto text,
  tipo_dormente text,
  nota_fiscal text,
  numero_pedido text,
  data_entrega date,
  qtd_entregue numeric check (qtd_entregue is null or qtd_entregue >= 0),
  qtd_reprovada numeric check (qtd_reprovada is null or qtd_reprovada >= 0),
  taxa_reprovacao numeric check (taxa_reprovacao is null or taxa_reprovacao >= 0),
  teor_umidade_medido text,
  teor_umidade_aprovado text,
  marcacao_lado text,
  carimbo_fiscalizadora text,
  defeitos jsonb not null default '{}'::jsonb check (jsonb_typeof(defeitos) = 'object'),
  informacoes_adicionais text,
  status text not null check (status in ('rascunho','concluida')),
  fonte_arquivo text not null,
  fonte_aba text not null,
  fonte_linha integer not null check (fonte_linha >= 2),
  fonte_sha256 text not null,
  dados_originais jsonb not null check (jsonb_typeof(dados_originais) = 'object'),
  criado_em timestamptz not null default now()
);
create index madeira_inspecoes_data_id on public.madeira_inspecoes (data_inspecao desc, id);
create index madeira_inspecoes_fornecedor on public.madeira_inspecoes (fornecedor);
create index madeira_inspecoes_projeto on public.madeira_inspecoes (projeto);
create index madeira_inspecoes_tipo on public.madeira_inspecoes (tipo_dormente);
create index madeira_inspecoes_relatorio on public.madeira_inspecoes (tipo_relatorio);

alter table public.madeira_inspecoes enable row level security;
revoke all on table public.madeira_inspecoes from anon, authenticated;
grant select on table public.madeira_inspecoes to authenticated;
create policy madeira_inspecoes_leitura
on public.madeira_inspecoes for select to authenticated
using ((select public.usuario_ativo()));

comment on table public.madeira_inspecoes is
'Histórico somente para consulta dos quatro lotes de relatórios de dormentes de madeira, com todas as colunas originais preservadas.';
