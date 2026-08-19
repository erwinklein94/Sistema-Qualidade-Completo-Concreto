-- =====================================================================
-- DORMENTES REPROVADOS — campos do Resumo Semanal CONPREM
--
-- O resumo fecha a semana inteira: quanto foi fabricado, quantos ensaios
-- foram feitos, o refugo por tipo, a taxa e o planejamento da semana
-- seguinte. Até aqui o Leitor quebrava esse resumo em uma linha por
-- motivo; agora grava uma linha por semana com o quadro completo.
--
-- Semana, ano, periodo_inicio, periodo_fim e total_refugos já existiam e
-- continuam sendo usados; as 18 colunas abaixo são as que faltavam.
--
-- Aplicadas nas duas tabelas porque a tela de Reprovados é a mesma para
-- Cavan e Conprem (ver js/area.js). As reprovas já registradas ficam com
-- esses campos vazios: valem como histórico e não são tocadas.
-- =====================================================================

do $$
declare
  t text;
  c text;
  colunas_texto text[] := array[
    'numero_resumo', 'unidade', 'produto_material', 'pedido_local'
  ];
  colunas_data text[] := array[
    'data_emissao', 'planejamento_inicio', 'planejamento_fim'
  ];
  colunas_int text[] := array[
    'qtd_fabricada', 'ensaios_realizados', 'qtd_planejada',
    'refugo_fissuras', 'refugo_vazios', 'refugo_ombreiras', 'refugo_quebras',
    'refugo_usp', 'refugo_falhas_fabricacao', 'refugo_outros'
  ];
  colunas_num text[] := array['taxa_refugo', 'ensaios_por_mil'];
begin
  foreach t in array array['reprovados', 'conprem_reprovados'] loop
    foreach c in array colunas_texto loop
      execute format('alter table public.%I add column if not exists %I text', t, c);
    end loop;
    foreach c in array colunas_data loop
      execute format('alter table public.%I add column if not exists %I date', t, c);
    end loop;
    foreach c in array colunas_int loop
      execute format('alter table public.%I add column if not exists %I integer', t, c);
    end loop;
    foreach c in array colunas_num loop
      execute format('alter table public.%I add column if not exists %I numeric', t, c);
    end loop;
  end loop;
end $$;

comment on column public.conprem_reprovados.taxa_refugo is
  'Taxa de refugo da semana, como fração (0,0065 = 0,65%), igual ao Resumo Semanal CONPREM.';
