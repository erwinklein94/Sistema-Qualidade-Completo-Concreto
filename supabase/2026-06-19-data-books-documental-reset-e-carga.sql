/* =====================================================================
   DATA BOOKS DOCUMENTAL — RESET + CARGA INICIAL
   Sistema de Qualidade Completo Concreto

   O que este SQL faz:
   1) Remove a tabela antiga public.data_books_dormentes, zerando a página antiga.
   2) Cria o novo modelo documental:
      - public.data_book_inspecoes: um registro por PDF/Data Book
      - public.data_book_itens: um registro por campo avaliado da planilha Excel
   3) Insere a primeira leitura do PDF:
      "001_26 - DB CAVAN SL - RUMO_FMT - JANEIRO(3).pdf"
      usando os campos da planilha:
      "Relatório inspeção - Databook - Cavan - MODELO IAUDITOR.xlsx"

   Rode no SQL Editor do Supabase.
   Após rodar, publique os arquivos atualizados do site.
   ===================================================================== */

create extension if not exists "pgcrypto";
grant usage on schema public to authenticated;

-- RESET da estrutura antiga da página de Data Books.
drop table if exists public.data_books_dormentes cascade;

-- Funções de perfil compatíveis com o sistema principal.
create table if not exists public.usuarios_app (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text not null,
  perfil text not null default 'consulta',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create or replace function public.normalizar_perfil(valor text)
returns text
language sql
immutable
as $$
  select case
    when translate(lower(trim(coalesce(valor, ''))), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') = 'admin' then 'admin'
    when translate(lower(trim(coalesce(valor, ''))), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') in ('qualidade', 'fiscalizacao') then 'fiscalizacao'
    else 'consulta'
  end;
$$;

create or replace function public.perfil_usuario_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select public.normalizar_perfil(u.perfil::text)
    from public.usuarios_app u
    where u.id = auth.uid()
      and u.ativo is true
    limit 1
  ), 'consulta');
$$;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.perfil_usuario_atual() = 'admin';
$$;

grant execute on function public.normalizar_perfil(text) to authenticated;
grant execute on function public.perfil_usuario_atual() to authenticated;
grant execute on function public.eh_admin() to authenticated;

-- Auditoria unificada.
create table if not exists public.auditoria_alteracoes (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid,
  acao text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  usuario_id uuid references auth.users(id) on delete set null,
  usuario_nome text,
  usuario_email text,
  valores_antes jsonb,
  valores_depois jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_auditoria_tabela on public.auditoria_alteracoes (tabela);
create index if not exists idx_auditoria_registro_id on public.auditoria_alteracoes (registro_id);
create index if not exists idx_auditoria_criado_em on public.auditoria_alteracoes (criado_em desc);

create or replace function public.preencher_campos_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
    new.atualizado_por := coalesce(new.atualizado_por, auth.uid());
    new.criado_em := coalesce(new.criado_em, now());
    new.atualizado_em := coalesce(new.atualizado_em, now());
  elsif tg_op = 'UPDATE' then
    new.atualizado_por := auth.uid();
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

create or replace function public.registrar_auditoria_alteracao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_usuario_nome text;
  v_usuario_email text;
  v_registro_id uuid;
begin
  select nome, email
    into v_usuario_nome, v_usuario_email
  from public.usuarios_app
  where id = v_usuario_id
  limit 1;

  if tg_op = 'DELETE' then
    v_registro_id := old.id;
  else
    v_registro_id := new.id;
  end if;

  insert into public.auditoria_alteracoes (
    tabela, registro_id, acao, usuario_id, usuario_nome, usuario_email, valores_antes, valores_depois
  ) values (
    tg_table_name,
    v_registro_id,
    tg_op,
    v_usuario_id,
    v_usuario_nome,
    v_usuario_email,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Novo cabeçalho por PDF/Data Book.
drop table if exists public.data_book_itens cascade;
drop table if exists public.data_book_inspecoes cascade;

create table public.data_book_inspecoes (
  id uuid primary key default gen_random_uuid(),
  data_book_numero text not null,
  cliente text,
  fornecedor text,
  mes_referencia text,
  periodo_producao text,
  quantidade_dormentes integer,
  produto text,
  modelo text,
  arquivo_fonte text,
  status_geral text not null default 'PENDENTE' check (status_geral in ('OK', 'NOK', 'NA', 'PENDENTE')),
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null
);

create table public.data_book_itens (
  id uuid primary key default gen_random_uuid(),
  data_book_id uuid not null references public.data_book_inspecoes(id) on delete cascade,
  ordem integer not null,
  origem_excel_linha integer,
  secao text not null,
  item_numero text,
  campo text not null,
  ferramenta text,
  tolerancia text,
  valor_obtido text,
  status text not null default 'PENDENTE' check (status in ('OK', 'NOK', 'NA', 'PENDENTE')),
  paginas_origem text,
  evidencia text,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null
);

create index idx_data_book_inspecoes_numero on public.data_book_inspecoes (data_book_numero);
create index idx_data_book_inspecoes_fornecedor on public.data_book_inspecoes (fornecedor);
create index idx_data_book_inspecoes_status on public.data_book_inspecoes (status_geral);
create index idx_data_book_itens_data_book_id on public.data_book_itens (data_book_id);
create index idx_data_book_itens_ordem on public.data_book_itens (data_book_id, ordem);
create index idx_data_book_itens_secao on public.data_book_itens (secao);
create index idx_data_book_itens_status on public.data_book_itens (status);

alter table public.data_book_inspecoes enable row level security;
alter table public.data_book_itens enable row level security;

revoke all on table public.data_book_inspecoes from anon;
revoke all on table public.data_book_itens from anon;
grant select, insert, update, delete on table public.data_book_inspecoes to authenticated;
grant select, insert, update, delete on table public.data_book_itens to authenticated;

drop policy if exists "admin visualiza data book inspeções" on public.data_book_inspecoes;
create policy "admin visualiza data book inspeções"
on public.data_book_inspecoes
for select
to authenticated
using (public.eh_admin());

drop policy if exists "admin cria data book inspeções" on public.data_book_inspecoes;
create policy "admin cria data book inspeções"
on public.data_book_inspecoes
for insert
to authenticated
with check (public.eh_admin());

drop policy if exists "admin edita data book inspeções" on public.data_book_inspecoes;
create policy "admin edita data book inspeções"
on public.data_book_inspecoes
for update
to authenticated
using (public.eh_admin())
with check (public.eh_admin());

drop policy if exists "admin exclui data book inspeções" on public.data_book_inspecoes;
create policy "admin exclui data book inspeções"
on public.data_book_inspecoes
for delete
to authenticated
using (public.eh_admin());

drop policy if exists "admin visualiza data book itens" on public.data_book_itens;
create policy "admin visualiza data book itens"
on public.data_book_itens
for select
to authenticated
using (public.eh_admin());

drop policy if exists "admin cria data book itens" on public.data_book_itens;
create policy "admin cria data book itens"
on public.data_book_itens
for insert
to authenticated
with check (public.eh_admin());

drop policy if exists "admin edita data book itens" on public.data_book_itens;
create policy "admin edita data book itens"
on public.data_book_itens
for update
to authenticated
using (public.eh_admin())
with check (public.eh_admin());

drop policy if exists "admin exclui data book itens" on public.data_book_itens;
create policy "admin exclui data book itens"
on public.data_book_itens
for delete
to authenticated
using (public.eh_admin());

drop trigger if exists trg_data_book_inspecoes_preencher_auditoria on public.data_book_inspecoes;
create trigger trg_data_book_inspecoes_preencher_auditoria
before insert or update on public.data_book_inspecoes
for each row execute function public.preencher_campos_auditoria();

drop trigger if exists trg_data_book_itens_preencher_auditoria on public.data_book_itens;
create trigger trg_data_book_itens_preencher_auditoria
before insert or update on public.data_book_itens
for each row execute function public.preencher_campos_auditoria();

drop trigger if exists trg_data_book_inspecoes_registrar_auditoria on public.data_book_inspecoes;
create trigger trg_data_book_inspecoes_registrar_auditoria
after insert or update or delete on public.data_book_inspecoes
for each row execute function public.registrar_auditoria_alteracao();

drop trigger if exists trg_data_book_itens_registrar_auditoria on public.data_book_itens;
create trigger trg_data_book_itens_registrar_auditoria
after insert or update or delete on public.data_book_itens
for each row execute function public.registrar_auditoria_alteracao();

-- Carga inicial do PDF anexado.
with novo_data_book as (
  insert into public.data_book_inspecoes (
    data_book_numero,
    cliente,
    fornecedor,
    mes_referencia,
    periodo_producao,
    quantidade_dormentes,
    produto,
    modelo,
    arquivo_fonte,
    status_geral,
    observacoes
  )
  values (
    '001/26',
    'RUMO BITOLA LARGA FMT',
    'CAVAN Pré Moldado S/A - Unidade Industrial Santa Lúcia/SP',
    'JANEIRO DE 2026',
    '07/01/2026 a 30/01/2026',
    12077,
    'Dormente monobloco de concreto protendido para via de bitola larga com fixações tipo Pandrol Fastclip FC isoladas e trilhos TR68 ou UIC60, com uso de isoladores especiais, na inclinação 1/40.',
    'VCL/DMB-FXPFC-01',
    '001_26 - DB CAVAN SL - RUMO_FMT - JANEIRO(3).pdf',
    'NOK',
    'Carga inicial extraída nesta leitura: 65 campos da planilha Excel. Itens NOK aparecem quando o valor encontrado ficou fora da tolerância da planilha; NA aparece quando o PDF não trouxe evidência objetiva do campo.'
  )
  returning id
)
insert into public.data_book_itens (
  data_book_id,
  ordem,
  origem_excel_linha,
  secao,
  item_numero,
  campo,
  ferramenta,
  tolerancia,
  valor_obtido,
  status,
  paginas_origem,
  evidencia,
  observacoes
)
select
  novo_data_book.id,
  v.ordem,
  v.origem_excel_linha,
  v.secao,
  v.item_numero,
  v.campo,
  v.ferramenta,
  v.tolerancia,
  v.valor_obtido,
  v.status,
  v.paginas_origem,
  v.evidencia,
  v.observacoes
from novo_data_book
cross join (values
    (1, 11, '1 - MONITORAMENTO DE TEMPERATURA', '1.', 'Monitoramento de temperatura - Registrar Curva. PROJETO E DETERMINA POR NORMA NBR 11709', 'Termômetro', '≤60°', 'máx 56,9 °C; mín 23,9 °C; 35 certificados de lote lidos', 'OK', '7-41', 'Todas as leituras de temperatura extraídas dos certificados de qualidade do lote ficaram abaixo de 60 °C.', null),
    (2, 12, '1 - MONITORAMENTO DE TEMPERATURA', '2.', 'Temperatura inicial ≤30ºC até tempo de pega concreto ou tempo de espera =2h, o que for maior.', 'Termômetro', null, 'primeira leitura registrada: mín 23,9 °C; máx 49,9 °C', 'NOK', '7-41', 'A primeira leitura registrada no quadro de temperatura de alguns lotes aparece acima de 30 °C. Atenção: o PDF não traz medição 0h/tempo de pega, então foi usada a primeira leitura disponível.', null),
    (3, 13, '1 - MONITORAMENTO DE TEMPERATURA', '3.', 'Período de aumento máximo de 20ºC/h, em todas as horas.', 'Termômetro', null, 'maior taxa calculada 5,67 °C/h', 'OK', '7-41', 'Cálculo automático entre leituras consecutivas de Início, Meio e Fim; maior taxa encontrada abaixo de 20 °C/h.', null),
    (4, 15, '2 - DOCUMENTAL AGREGADO MIÚDO', '1.', 'Determinação do material mais fino que passa na peneira 75 μm (%)', null, '≥ 0,7% à ≤ 3,0 %', '0,6 %', 'NOK', '249', 'Tabela 1 - Caracterização física do agregado miúdo: teor de material fino que passa #75µm = 0,6%.', null),
    (5, 16, '2 - DOCUMENTAL AGREGADO MIÚDO', '2.', 'Determinação da massa especifica real (Silicosa ou quartzo 2,55 g/cm³ à 2,75 g/cm - Calcários 2,60 g/cm³ à 2,70 g/cm³ - Basáltica 2,90 g/cm³)', null, null, 'Densidade seca 2,62 g/cm³; superfície saturada seca 2,63 g/cm³', 'OK', '249', 'Tabela 1 - densidade do agregado miúdo.', null),
    (6, 17, '2 - DOCUMENTAL AGREGADO MIÚDO', '3.', 'Determinação da densidade do agregado na condição seca (g/cm3)', null, '2,10 à 2,60', '2,62 g/cm³', 'NOK', '249', 'Tabela 1 - densidade na condição seca = 2,62 g/cm³, acima da faixa da planilha 2,10 a 2,60.', null),
    (7, 18, '2 - DOCUMENTAL AGREGADO MIÚDO', '4.', 'Determinação da densidade do agregado na condição saturada superficie seca (g/cm3)', null, null, '2,63 g/cm³', 'OK', '249', 'Tabela 1 - densidade na condição superfície saturada seca.', null),
    (8, 19, '2 - DOCUMENTAL AGREGADO MIÚDO', '5.', 'Determinação da densidade do agregado na absorção de água', null, '≤ 1,0 %', '0,3 %', 'OK', '249', 'Tabela 1 - absorção do agregado miúdo = 0,3%.', null),
    (9, 20, '2 - DOCUMENTAL AGREGADO MIÚDO', '6.', 'Determinação da massa especifica aparente', null, null, 'Não localizado explicitamente no PDF', 'NA', '249-253', 'O relatório externo apresenta densidades e massa unitária, mas não traz campo com este nome específico.', null),
    (10, 21, '2 - DOCUMENTAL AGREGADO MIÚDO', '7.', 'Determinação do volume de vazios no estado solto (%)', null, '35% à 55%', '≈ 38,9 % (calculado com densidade seca 2,62 g/cm³ e massa unitária solta 1600 kg/m³)', 'OK', '249', 'Cálculo: (2620 - 1600) / 2620 x 100.', null),
    (11, 22, '2 - DOCUMENTAL AGREGADO MIÚDO', '8.', 'Determinação do volume de vazios no estado compactado (%)', null, '35% à 55%', '≈ 35,9 % (calculado com densidade seca 2,62 g/cm³ e massa unitária compactada 1680 kg/m³)', 'OK', '249', 'Cálculo: (2620 - 1680) / 2620 x 100.', null),
    (12, 23, '2 - DOCUMENTAL AGREGADO MIÚDO', '9.', 'Determinação da massa unitária do volume de vazios no estado Solto (kg/m3)', null, '1.300 à 1.600 kg/m3', '1600 kg/m³', 'OK', '249', 'Tabela 1 - massa unitária em estado solto = 1600 kg/m³.', null),
    (13, 24, '2 - DOCUMENTAL AGREGADO MIÚDO', '10.', 'Determinação da massa unitária do volume de vazios no estado Compactado (kg/m3)', null, '1800 kg/m3', '1680 kg/m³', 'OK', '249', 'Tabela 1 - massa unitária em estado compactado = 1680 kg/m³.', null),
    (14, 25, '2 - DOCUMENTAL AGREGADO MIÚDO', '11.', 'Material pulverulento', null, '5% - 0,075 mm (# 200)', '0,6 % passante na peneira 75µm', 'OK', '249', 'Mesmo valor documental de material fino/pulverulento indicado na Tabela 1.', null),
    (15, 26, '2 - DOCUMENTAL AGREGADO MIÚDO', '11.', 'Determinação do teor de argila em torrões e materiais friáveis intervalo granulométrico (%)', null, '≥ 1,18 à < 4,75mm', 'Não separado por intervalo; total informado = 0,02 %', 'NA', '249', 'O relatório informa teor total de argilas/friáveis, sem dividir por intervalo granulométrico 1,18 a 4,75 mm.', null),
    (16, 27, '2 - DOCUMENTAL AGREGADO MIÚDO', '12.', 'Determinação do teor de argila em torrões e materiais friáveis intervalo granulométrico (%)', null, '≥ 4,75 à < 9,5 mm', 'Não separado por intervalo; total informado = 0,02 %', 'NA', '249', 'O relatório informa teor total de argilas/friáveis, sem dividir por intervalo granulométrico 4,75 a 9,5 mm.', null),
    (17, 28, '2 - DOCUMENTAL AGREGADO MIÚDO', '13.', 'Determinação do teor de argila e materiais friáveis total', null, '≤ 3,0 %', '0,02 %', 'OK', '249', 'Tabela 1 - teor de argilas em torrões e materiais friáveis = 0,02%.', null),
    (18, 29, '2 - DOCUMENTAL AGREGADO MIÚDO', '14.', 'Determinação de impurezas orgânicas Deverá ser mais clara com limite inferior 300 ppm, mais escura acima 300 ppm deverá realizar ensaios complementares', null, 'Inferior 300ppm', 'Solução mais clara que a solução padrão; ausência de impurezas orgânicas', 'OK', '252', 'Foto 1 / texto do ensaio: amostra apresentou solução mais clara que a solução padrão, indicando ausência de impurezas orgânicas.', null),
    (19, 31, '3 - DOCUMENTAL AGREGADO GRAÚDO', '1.', 'Determinação do material mais fino que passa na peneira 75 μm (%)', null, '≤ 1,0% - 7,0', '0,8 %', 'OK', '257', 'Tabela 2 - teor de material fino que passa #75µm = 0,8%.', null),
    (20, 32, '3 - DOCUMENTAL AGREGADO GRAÚDO', '2.', 'Determinação da massa especifica real', null, '2,5 kg/dm³ à           3,0 kg/dm³', 'Densidade seca 2,88 g/cm³; superfície saturada seca 2,90 g/cm³', 'OK', '257', 'Tabela 2 - densidade do agregado graúdo.', null),
    (21, 33, '3 - DOCUMENTAL AGREGADO GRAÚDO', '3.', 'Determinação da densidade do agregado na condição seca (g/cm3)', null, '2,60 à 2,95', '2,88 g/cm³', 'OK', '257', 'Tabela 2 - densidade na condição seca = 2,88 g/cm³.', null),
    (22, 34, '3 - DOCUMENTAL AGREGADO GRAÚDO', '4.', 'Determinação da densidade do agregado na condição saturada superficie seca (g/cm3)', null, null, '2,90 g/cm³', 'OK', '257', 'Tabela 2 - densidade na condição superfície saturada seca = 2,90 g/cm³.', null),
    (23, 35, '3 - DOCUMENTAL AGREGADO GRAÚDO', '5.', 'Determinação da densidade do agregado na absorção de água', null, '≤ 1,0 %', '0,7 %', 'OK', '257', 'Tabela 2 - absorção = 0,7%.', null),
    (24, 36, '3 - DOCUMENTAL AGREGADO GRAÚDO', '6.', 'Determinação da massa especifica aparente', null, '1,4 à 1,8 kg/dm³', '1,67 kg/dm³ em estado solto; 1,71 kg/dm³ em estado compactado', 'OK', '257', 'Tabela 2 - massa unitária 1670 kg/m³ e 1710 kg/m³, convertida para kg/dm³.', null),
    (25, 37, '3 - DOCUMENTAL AGREGADO GRAÚDO', '7.', 'Determinação do volume de vazios no estado solto (%)', null, '40% à 55%', '≈ 42,0 % (calculado com densidade seca 2,88 g/cm³ e massa unitária solta 1670 kg/m³)', 'OK', '257', 'Cálculo: (2880 - 1670) / 2880 x 100.', null),
    (26, 38, '3 - DOCUMENTAL AGREGADO GRAÚDO', '8.', 'Determinação do volume de vazios no estado compactado (%)', null, '40% à 55%', '≈ 40,6 % (calculado com densidade seca 2,88 g/cm³ e massa unitária compactada 1710 kg/m³)', 'OK', '257', 'Cálculo: (2880 - 1710) / 2880 x 100.', null),
    (27, 39, '3 - DOCUMENTAL AGREGADO GRAÚDO', '9.', 'Determinação da massa unitária do volume de vazios no estado Solto (kg/m3)', null, '1410 à 1550', '1670 kg/m³', 'NOK', '257', 'Tabela 2 - massa unitária em estado solto = 1670 kg/m³, acima da faixa da planilha 1410 a 1550.', null),
    (28, 40, '3 - DOCUMENTAL AGREGADO GRAÚDO', '10.', 'Determinação da massa unitária do volume de vazios no estado Compactado (kg/m3)', null, '1410 à 1550', '1710 kg/m³', 'NOK', '257', 'Tabela 2 - massa unitária em estado compactado = 1710 kg/m³, acima da faixa da planilha 1410 a 1550.', null),
    (29, 41, '3 - DOCUMENTAL AGREGADO GRAÚDO', '11.', 'Material pulverulento', null, '1% - 0,075 mm (# 200)', '0,8 % passante na peneira 75µm', 'OK', '257', 'Mesmo valor documental de material fino/pulverulento indicado na Tabela 2.', null),
    (30, 42, '3 - DOCUMENTAL AGREGADO GRAÚDO', '12.', 'Determinação do teor de argila em torrões e materiais friáveis intervalo granulométrico (%)', null, '≥ 1,18 à < 4,75mm', 'Não localizado no relatório', 'NA', '255-258', 'O relatório de agregado graúdo não apresenta argila/friáveis por intervalo granulométrico.', null),
    (31, 43, '3 - DOCUMENTAL AGREGADO GRAÚDO', '13.', 'Determinação do teor de argila em torrões e materiais friáveis intervalo granulométrico (%)', null, '≥ 4,75 à < 9,5 mm', 'Não localizado no relatório', 'NA', '255-258', 'O relatório de agregado graúdo não apresenta argila/friáveis por intervalo granulométrico.', null),
    (32, 44, '3 - DOCUMENTAL AGREGADO GRAÚDO', '14.', 'Determinação do teor de argila e materiais friáveis total', null, '≤ 1,0 %', 'Não localizado no relatório', 'NA', '255-258', 'O relatório de agregado graúdo não apresenta teor total de argila/friáveis.', null),
    (33, 45, '3 - DOCUMENTAL AGREGADO GRAÚDO', '15.', 'Determinação do índice de forma pelo método do paquímetro "C" comprimento médio', null, null, 'Não localizado separadamente; índice de forma total = 2,3', 'NA', '257', 'A Tabela 2 informa apenas índice de forma consolidado, sem comprimento médio C.', null),
    (34, 46, '3 - DOCUMENTAL AGREGADO GRAÚDO', '16.', 'Determinação do índice de forma pelo método do paquímetro "E" espessura médio', null, null, 'Não localizado separadamente; índice de forma total = 2,3', 'NA', '257', 'A Tabela 2 informa apenas índice de forma consolidado, sem espessura média E.', null),
    (35, 47, '3 - DOCUMENTAL AGREGADO GRAÚDO', '17.', 'Determinação do índice de forma pelo método do paquímetro "I" índice médio', null, '≤ 3,0 %', '2,3', 'OK', '257', 'Tabela 2 - índice de forma = 2,3, abaixo do limite 3,0.', null),
    (36, 48, '3 - DOCUMENTAL AGREGADO GRAÚDO', '18.', 'Ensaios de resistência ao impacto e à abrasão Los Angeles brita 1 Graduação B NBR 16974', null, '<50', '12,6 %', 'OK', '257', 'Tabela 2 - ensaio de abrasão Los Angeles Graduação B = 12,6%, abaixo de 50.', null),
    (37, 50, '4 - DOCUMENTAL AÇO', '1.', 'Aço - Propriedades físicas e mecânicas', null, null, 'Certificados Belgo com propriedades mecânicas/metalúrgicas dentro das especificações; exemplo: resistência à tração 1755 a 1785 MPa nas páginas lidas', 'OK', '52-83', 'Certificados de qualidade dos fios de protensão Belgo, páginas 52 a 83.', null),
    (38, 51, '4 - DOCUMENTAL AÇO', '2.', 'Aço - Teste de relaxação em 1000hs (%)', null, '0.03', 'Não localizado no PDF como ensaio de relaxação 1000 h', 'NA', '52-83', 'Os certificados exibidos tratam propriedades mecânicas/metalúrgicas e dimensionais, mas a busca textual/visual não identificou relaxação em 1000 h.', null),
    (39, 52, '4 - DOCUMENTAL AÇO', '3.', 'Aço dimensional', null, '6mm ±0,5mm', 'Diâmetro nominal 6,000 mm; faixa certificada 5,95 a 6,05 mm', 'OK', '52-83', 'Certificado Belgo página 52: diâmetro 6,000 mm e especificação 5,95 a 6,05 mm.', null),
    (40, 54, '5 - DOCUMENTAL CIMENTO QUÍMICO, FÍSICO E MECÂNICO', '1.', 'Perda ao Fogo PF 950C NM 18/12', null, '≤ 6,5%', '6,36 %', 'OK', '245', 'Relatório ABCP 178608 - Perda ao fogo PF = 6,36%.', null),
    (41, 55, '5 - DOCUMENTAL CIMENTO QUÍMICO, FÍSICO E MECÂNICO', '2.', 'Trióxido de enxofre SO3 NBR 14656', null, '≤ 4,5%', '4,12 %', 'OK', '245', 'Relatório ABCP 178608 - Anidrido sulfúrico SO3 = 4,12%.', null),
    (42, 56, '5 - DOCUMENTAL CIMENTO QUÍMICO, FÍSICO E MECÂNICO', '3.', 'Resíduo insolúvel RI NM 15/12', null, '≤ 3,5%', '1,16 %', 'OK', '245', 'Relatório ABCP 178608 - Resíduo insolúvel RI = 1,16%.', null),
    (43, 57, '5 - DOCUMENTAL CIMENTO QUÍMICO, FÍSICO E MECÂNICO', '4.', 'Óxido magnésio MgO NBR 14656', null, '≤ 6,5%', '4,51 %', 'OK', '245', 'Relatório ABCP 178608 - Óxido de magnésio MgO = 4,51%.', null),
    (44, 58, '5 - DOCUMENTAL CIMENTO QUÍMICO, FÍSICO E MECÂNICO', '5.', 'Óxido de cálcio livre - CaO (livre)', null, '-', '1,43 %', 'OK', '245', 'Relatório ABCP 178608 - Óxido de cálcio livre CaO = 1,43%.', null),
    (45, 59, '5 - DOCUMENTAL CIMENTO QUÍMICO, FÍSICO E MECÂNICO', '6.', 'Anidrido carbônico - CO2', null, '≤ 5,5%', '4,43 %', 'OK', '245', 'Relatório ABCP 178608 - Anidrido carbônico CO2 = 4,43%.', null),
    (46, 60, '5 - DOCUMENTAL CIMENTO QUÍMICO, FÍSICO E MECÂNICO', '7.', 'FINURA # 200 NBR 11.579 (%)', null, '≤ 6,0%', '0,0 %', 'OK', '246', 'Relatório ABCP 178607 - Finura resíduo na peneira 75µm = 0,0%.', null),
    (47, 61, '5 - DOCUMENTAL CIMENTO QUÍMICO, FÍSICO E MECÂNICO', '8.', 'Resistência a compressão 1 dia Mpa NBR 7215', null, '≥ 14,0', '31,0 MPa', 'OK', '246', 'Relatório ABCP 178607 - resistência média à compressão 1 dia = 31,0 MPa.', null),
    (48, 62, '5 - DOCUMENTAL CIMENTO QUÍMICO, FÍSICO E MECÂNICO', '9.', 'Resistência a compressão 3 dias Mpa NBR 7215', null, '≥ 24,0', '40,8 MPa', 'OK', '246', 'Relatório ABCP 178607 - resistência média à compressão 3 dias = 40,8 MPa.', null),
    (49, 63, '5 - DOCUMENTAL CIMENTO QUÍMICO, FÍSICO E MECÂNICO', '10.', 'Resistência a compressão 7 dias Mpa NBR 7215', null, '≥ 34,0', '46,7 MPa', 'OK', '246', 'Relatório ABCP 178607 - resistência média à compressão 7 dias = 46,7 MPa.', null),
    (50, 64, '5 - DOCUMENTAL CIMENTO QUÍMICO, FÍSICO E MECÂNICO', '11.', 'Resistência a compressão 28 dias Mpa NBR 7215', null, 'não se aplica', '50,3 MPa no boletim mensal Votorantim; ensaio 28 dias não aplicável no relatório ABCP 178607', 'NA', '85, 246', 'Planilha marca este item como "não se aplica"; o boletim mensal interno mostra 50,3 MPa.', null),
    (51, 65, '5 - DOCUMENTAL CIMENTO QUÍMICO, FÍSICO E MECÂNICO', '12.', 'Fator água cimento A/C (%)', null, null, 'Não localizado no PDF', 'NA', '85, 245-246', 'Não foi encontrado campo específico de fator água/cimento A/C no boletim ou relatório externo.', null),
    (52, 66, '5 - DOCUMENTAL CIMENTO QUÍMICO, FÍSICO E MECÂNICO', '13.', 'Tempo de pega do cimento NBR 16607', null, '≥ 60 minutos', 'Início de pega 175 min; fim de pega 315 min', 'OK', '246', 'Relatório ABCP 178607 - início de pega = 175 min, acima de 60 min.', null),
    (53, 68, '6 - DOCUMENTAL CONCRETO', '1.', 'Adição ao concreto - Químico (aditivo)', null, 'Validade', 'Aditivo MAXIFLUID H 2080: validade 11/12/2026; certificado Chryso; caracterização externa ABCP com pH 3,40, sólidos 35,94%, massa específica 1,07 g/cm³', 'OK', '87, 260', 'Certificado Chryso e relatório ABCP 175085.', null),
    (54, 69, '6 - DOCUMENTAL CONCRETO', '2.', 'Adição ao concreto - Minerais', null, 'Validade', 'Metacaulim HP ULTRA: fabricação 25/11/2025; validade 4 anos; finura 5,9%; massa específica 2,55 kg/dm³', 'OK', '90', 'Certificado Metacaulim do Brasil U-25-012.', null),
    (55, 70, '6 - DOCUMENTAL CONCRETO', '3.', 'Resistência a compressão do concreto aos 3 ou 7 dias', '7d', null, 'mín 47,56 MPa; média 68,15 MPa; máx 86,76 MPa; n=70', 'OK', '7-41', 'Valores de compressão axial aos 7 dias extraídos dos certificados dos lotes.', null),
    (56, 71, '6 - DOCUMENTAL CONCRETO', '4.', 'Resistência a compressão do concreto aos 7 ou 14 dias', '14d', null, 'mín 53,38 MPa; média 74,51 MPa; máx 92,11 MPa; n=70', 'OK', '7-41', 'Valores de compressão axial aos 14 dias extraídos dos certificados dos lotes.', null),
    (57, 72, '6 - DOCUMENTAL CONCRETO', '5.', 'Resistência a compressão do concreto 28 dias', '28d', '≥ 65 Mpa', 'mín 62,29 MPa; média 82,70 MPa; máx 96,92 MPa; n=70', 'NOK', '7-41', 'Menor valor de compressão aos 28 dias foi 62,29 MPa, abaixo da tolerância da planilha de ≥65 MPa. Lote crítico: 02607, página 40.', null),
    (58, 73, '6 - DOCUMENTAL CONCRETO', '6.', 'Resistência a tração na Flexão aos 7 ou 14 dias', '14d', null, 'mín 6,50 MPa; média 8,08 MPa; máx 8,90 MPa; n=70', 'OK', '7-41', 'Valores de tração na flexão aos 14 dias extraídos dos certificados dos lotes.', null),
    (59, 74, '6 - DOCUMENTAL CONCRETO', '7.', 'Resistência a tração na Flexão aos 28 dias', '28d', '≥ 7,5 Mpa', 'mín 7,10 MPa; média 8,51 MPa; máx 10,20 MPa; n=70', 'NOK', '7-41', 'Menor valor de tração na flexão aos 28 dias foi 7,10 MPa, abaixo da tolerância da planilha de ≥7,5 MPa. Lote crítico: 02547, página 38.', null),
    (60, 75, '6 - DOCUMENTAL CONCRETO', '8.', 'Teste de abatimento de cone', null, null, 'Não localizado no PDF', 'NA', '1-260', 'Busca por abatimento/slump/cone não retornou evidência no PDF.', null),
    (61, 76, '6 - DOCUMENTAL CONCRETO', '9.', 'Ensaio de reatividade alcali agregado - Determinação a expansão em barras de argamassa pelo método acelerado NBR 15577 – Parte 4 (quando não houver uso de sílica ou metacaulim) agregado miudo', null, null, 'Não localizado no PDF', 'NA', '1-260', 'Busca por reatividade álcali-agregado/NBR 15577 não retornou relatório correspondente.', null),
    (62, 77, '6 - DOCUMENTAL CONCRETO', '10.', 'Ensaio de reatividade alcali agregado, análise petrográfica para verificação da potencialidade reativa', null, null, 'Não localizado no PDF', 'NA', '1-260', 'Busca por análise petrográfica não retornou relatório correspondente.', null),
    (63, 78, '6 - DOCUMENTAL CONCRETO', '11.', 'Ensaio de reatividade alcali agregado, determinação da Mitigação da expansão em barras de argamassa pelo método acelerado NBR 15577 – Parte 5 (quando houver uso de sílica ou metacaulim) agregado graúdo', null, null, 'Não localizado no PDF', 'NA', '1-260', 'Busca por mitigação da expansão/NBR 15577 Parte 5 não retornou relatório correspondente.', null),
    (64, 79, '6 - DOCUMENTAL CONCRETO', '12.', 'Ensaio para verificar potencial de formação a DEF', null, null, 'Não localizado no PDF', 'NA', '1-260', 'Busca por DEF/formação de etringita tardia não retornou relatório correspondente.', null),
    (65, 80, '6 - DOCUMENTAL CONCRETO', '13.', 'Caracterização de água destinada à preparação de concreto de cimento portland', null, null, 'Relatório de análise de água: amostra atende aos padrões estabelecidos pela legislação vigente', 'OK', '239-243', 'Página 243 informa que a amostra atende aos padrões da Portaria GM/MS nº 888/2021.', null)
) as v (
  ordem,
  origem_excel_linha,
  secao,
  item_numero,
  campo,
  ferramenta,
  tolerancia,
  valor_obtido,
  status,
  paginas_origem,
  evidencia,
  observacoes
);

-- Conferência rápida após rodar:
-- select status, count(*) from public.data_book_itens group by status order by status;
-- select * from public.data_book_inspecoes order by criado_em desc;
