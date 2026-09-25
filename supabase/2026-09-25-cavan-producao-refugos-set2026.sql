-- Produção e refugo da Cavan de 01 a 23/09/2026 (Ferro Norte e Malha Paulista
-- Bitola Mista), conforme a planilha Producao_Refugo_RUMO_Set2026.xlsx enviada
-- pela Cavan. Só entra o que o site ainda não tinha; reprovas já lançadas
-- (mesmo lote, molde e cavidade) ficam como estão.
--
-- Fica de fora de propósito:
--   * a coluna PEDIDO da planilha: os valores crescem com a quantidade do lote
--     (~55 por dormente) e não são números de pedido da Rumo (45xxxxxxxx);
--   * STATUS CURADO/EM CURA: o site segue o fluxo de liberação;
--   * datas de fabricação: o site guarda data e hora da concretagem.
--
-- Idempotente: pode rodar de novo sem duplicar nada.

begin;

-- Quantidade produzida por lote (a planilha divide 3320, 3331, 3108 e 3110 em
-- mais de uma linha; aqui vai a soma do lote).
update public.producao_lotes p
   set total_produzido = v.qtd
  from (values
    ('3329', 270), ('3330', 270), ('3331', 265),
    ('3332', 265), ('3333', 265), ('3334', 270)
  ) as v(lote, qtd)
 where p.fornecedor = 'Cavan SP'
   and p.projeto = 'FERRO NORTE'
   and p.lote = v.lote
   and p.total_produzido is distinct from v.qtd;

-- O lote 3098 é Bitola Mista UIC-60 (pista 3, Série 22 - MPBM), mas estava com
-- o tipo da Ferro Norte.
update public.producao_lotes
   set tipo_dormente = 'Bitola Mista MP - USP'
 where fornecedor = 'Cavan SP'
   and projeto = 'MALHA PAULISTA BITOLA MISTA'
   and lote = '3098'
   and tipo_dormente = 'Bitola Larga FN';

-- Reprovas que faltavam. Motivos no padrão já usado no site para os mesmos
-- motivos da Cavan: "Falha na retirada da régua" -> Trinca; "Excesso de vazio
-- na região de apoio do trilho" -> Vazios na região da ombreira.
-- Lote 3309: a Cavan informa 58 refugos; o site tinha 46 peças com molde e
-- cavidade, a planilha traz mais 3, e as 9 restantes vão numa linha sem molde.
insert into public.reprovados (
  producao_lote_id, fornecedor, semana, ano, periodo_inicio, periodo_fim,
  data_producao, lote, projeto, bitola, tipo, molde, cavidade,
  motivo_detalhado, motivo_indicador, total_refugos
)
select p.id, p.fornecedor, v.semana, 2026, v.ini::date, v.fim::date,
       v.data::date, v.lote, p.projeto, p.bitola, p.tipo_dormente, v.molde, v.cavidade,
       v.detalhe, v.indicador, v.qtd
  from (values
    ('2026-09-02', '3309', '49'::text, '2'::text, 'Trinca', 'Trincas', 1, 36, '2026-08-27', '2026-09-02'),
    ('2026-09-02', '3309', '48', '5', 'Trinca', 'Trincas', 1, 36, '2026-08-27', '2026-09-02'),
    ('2026-09-02', '3309', '19', '5', 'Trinca', 'Trincas', 1, 36, '2026-08-27', '2026-09-02'),
    ('2026-09-02', '3309', null, null, 'Trinca', 'Trincas', 9, 36, '2026-08-27', '2026-09-02'),
    ('2026-09-09', '3097', '5', '5', 'Trinca', 'Trincas', 1, 37, '2026-09-03', '2026-09-09'),
    ('2026-09-09', '3097', '5', '6', 'Trinca', 'Trincas', 1, 37, '2026-09-03', '2026-09-09'),
    ('2026-09-09', '3097', '26', '6', 'Trinca', 'Trincas', 1, 37, '2026-09-03', '2026-09-09'),
    ('2026-09-09', '3097', '48', '1', 'Trinca', 'Trincas', 1, 37, '2026-09-03', '2026-09-09'),
    ('2026-09-09', '3320', '32', '2', 'Trinca', 'Trincas', 1, 37, '2026-09-03', '2026-09-09'),
    ('2026-09-10', '3098', '4', '6', 'Trinca', 'Trincas', 1, 38, '2026-09-10', '2026-09-16'),
    ('2026-09-11', '3323', '53', '2', 'Trinca', 'Trincas', 1, 38, '2026-09-10', '2026-09-16'),
    ('2026-09-11', '3323', '53', '3', 'Trinca', 'Trincas', 1, 38, '2026-09-10', '2026-09-16'),
    ('2026-09-11', '3323', '21', '5', 'Trinca', 'Trincas', 1, 38, '2026-09-10', '2026-09-16'),
    ('2026-09-14', '3326', '5', '5', 'Trinca', 'Trincas', 1, 38, '2026-09-10', '2026-09-16'),
    ('2026-09-15', '3328', '23', '5', 'Trinca', 'Trincas', 1, 38, '2026-09-10', '2026-09-16'),
    ('2026-09-16', '3329', '44', '2', 'Vazios na região da ombreira', 'Vazios', 1, 38, '2026-09-10', '2026-09-16'),
    ('2026-09-22', '3111', '22', '3', 'Trinca', 'Trincas', 1, 39, '2026-09-17', '2026-09-23'),
    ('2026-09-22', '3111', '22', '4', 'Trinca', 'Trincas', 1, 39, '2026-09-17', '2026-09-23'),
    ('2026-09-22', '3111', '22', '5', 'Trinca', 'Trincas', 1, 39, '2026-09-17', '2026-09-23'),
    ('2026-09-22', '3111', '34', '4', 'Trinca', 'Trincas', 1, 39, '2026-09-17', '2026-09-23'),
    ('2026-09-22', '3111', '46', '6', 'Trinca', 'Trincas', 1, 39, '2026-09-17', '2026-09-23'),
    ('2026-09-22', '3111', '12', '2', 'Trinca', 'Trincas', 1, 39, '2026-09-17', '2026-09-23'),
    ('2026-09-22', '3111', '12', '3', 'Trinca', 'Trincas', 1, 39, '2026-09-17', '2026-09-23'),
    ('2026-09-22', '3111', '12', '4', 'Trinca', 'Trincas', 1, 39, '2026-09-17', '2026-09-23'),
    ('2026-09-22', '3111', '12', '6', 'Trinca', 'Trincas', 1, 39, '2026-09-17', '2026-09-23'),
    ('2026-09-22', '3111', '38', '1', 'Trinca', 'Trincas', 1, 39, '2026-09-17', '2026-09-23'),
    ('2026-09-22', '3111', '16', '1', 'Trinca', 'Trincas', 1, 39, '2026-09-17', '2026-09-23'),
    ('2026-09-22', '3111', '19', '4', 'Trinca', 'Trincas', 1, 39, '2026-09-17', '2026-09-23'),
    ('2026-09-22', '3333', '47', '2', 'Vazios na região da ombreira', 'Vazios', 1, 39, '2026-09-17', '2026-09-23')
  ) as v(data, lote, molde, cavidade, detalhe, indicador, qtd, semana, ini, fim)
  join public.producao_lotes p
    on p.fornecedor = 'Cavan SP'
   and p.projeto in ('FERRO NORTE', 'MALHA PAULISTA BITOLA MISTA')
   and p.lote = v.lote
 where not exists (
   select 1 from public.reprovados r
    where r.fornecedor = 'Cavan SP'
      and r.lote = v.lote
      and coalesce(r.molde, '') = coalesce(v.molde, '')
      and coalesce(r.cavidade, '') = coalesce(v.cavidade, '')
 );

-- Conferência com os totais da planilha antes de gravar.
do $$
declare
  fn int; mp int; refugo int; refugo_3309 int;
begin
  select sum(total_produzido) into fn from public.producao_lotes
   where fornecedor = 'Cavan SP' and projeto = 'FERRO NORTE'
     and lote in ('3307','3309','3311','3312','3314','3316','3318','3320','3321','3323',
                  '3325','3326','3328','3329','3330','3331','3332','3333','3334');
  select sum(total_produzido) into mp from public.producao_lotes
   where fornecedor = 'Cavan SP' and projeto = 'MALHA PAULISTA BITOLA MISTA'
     and lote in ('3093','3094','3095','3096','3097','3098','3099','3100','3101','3104',
                  '3106','3108','3110','3111','3112');
  select sum(total_refugos) into refugo from public.reprovados
   where fornecedor = 'Cavan SP' and projeto in ('FERRO NORTE', 'MALHA PAULISTA BITOLA MISTA')
     and data_producao between '2026-09-01' and '2026-09-23';
  select sum(total_refugos) into refugo_3309 from public.reprovados
   where fornecedor = 'Cavan SP' and lote = '3309';

  -- Planilha: Ferro Norte 5130, Bitola Mista 4950, refugo 100. O site fica com
  -- 101 porque já tinha uma quebra a mais no lote 3307 (molde 36/1).
  if fn <> 5130 or mp <> 4950 or refugo <> 101 or refugo_3309 <> 58 then
    raise exception 'Conferencia falhou: FN %, MP %, refugo %, lote 3309 %', fn, mp, refugo, refugo_3309;
  end if;
end $$;

commit;
