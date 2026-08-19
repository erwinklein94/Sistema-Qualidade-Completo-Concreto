-- =====================================================================
-- PRODUÇÃO — campos do Mapa de Rastreabilidade da CONPREM
--
-- São os dados que o Leitor de Recebidos extrai do PDF FR. 98/00 e que
-- ainda não tinham coluna: ordem de fabricação, cliente, produto, série
-- de concreto, os sequenciais e certificados de cada insumo (aço,
-- cimento, areia, brita, aditivo, adição) e os itens de fixação
-- (grampo, isoladores, palmilhas), além de observações.
--
-- Todas nullable e em texto: o PDF traz números de NF e certificado com
-- zero à esquerda ("031/26", "00281/2026") e às vezes mais de um valor
-- na mesma célula, unidos por "; ". Texto preserva os dois casos.
--
-- Aplicadas nas duas tabelas porque o formulário de Produção é o mesmo
-- para Cavan e Conprem (ver js/area.js). Os lotes já gravados ficam com
-- esses campos vazios: valem como histórico e não são tocados.
-- =====================================================================

do $$
declare
  t text;
  c text;
  colunas text[] := array[
    'ordem_fabricacao', 'cliente', 'produto', 'serie_concreto',
    'aco_seq_nf', 'aco_cert_interno', 'aco_cert_externo',
    'cimento_seq_nf', 'cimento_cert_interno', 'cimento_cert_externo',
    'areia_seq_nf', 'areia_cert_interno', 'areia_cert_externo',
    'brita_seq_nf', 'brita_cert_interno', 'brita_cert_externo',
    'aditivo_seq_nf', 'aditivo_cert_externo',
    'adicao_seq_nf', 'adicao_cert_externo',
    'grampo', 'isolador_frontal', 'isolador_lateral',
    'palmilha_trilho', 'palmilha_usp',
    'observacoes'
  ];
begin
  foreach t in array array['producao_lotes', 'conprem_producao_lotes'] loop
    foreach c in array colunas loop
      execute format('alter table public.%I add column if not exists %I text', t, c);
    end loop;
  end loop;
end $$;

comment on column public.conprem_producao_lotes.serie_concreto is
  'Série de concreto do Mapa de Rastreabilidade da CONPREM. Não confundir com a coluna serie, que é a série de liberação usada no fluxo da Cavan.';
