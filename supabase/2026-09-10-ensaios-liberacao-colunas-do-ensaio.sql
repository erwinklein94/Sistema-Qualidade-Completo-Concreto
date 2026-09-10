-- =====================================================================
-- Ensaios de Liberação — as leituras do ensaio em colunas próprias
--
-- Até aqui a tabela guardava só a DECISÃO da liberação (lote, série,
-- resultado) e o leitor de PDF despejava as 24 leituras do formulário
-- dentro de `observacoes`, como texto corrido. Assim não dava para
-- filtrar, somar nem cruzar por ensaio — "quais lotes passaram de 5,4 na
-- inclinação" ou "média do momento positivo por semana" não tinham
-- resposta.
--
-- Estas colunas são as perguntas do formulário do SafetyCulture
-- (MATERIAIS | DORMENTE CONCRETO - ENSAIO FERRONORTE): numeric no que é
-- medida e text no que é resposta de formulário ("Sim"/"Não",
-- "Aprovado"/"Reprovado"), seguindo o mesmo critério de
-- conprem_ensaios_dormentes.
--
-- Tudo é `add column if not exists` e nada é obrigatório: o lançamento
-- manual continua válido sem preencher nenhuma delas, e os registros
-- antigos ficam com null (a leitura deles segue em `observacoes`).
--
-- Vale para as duas áreas: conprem_ensaios_liberacao foi criada como
-- cópia de ensaios_liberacao e não herda coluna nova sozinha.
-- =====================================================================

do $$
declare
  alvo text;
begin
  foreach alvo in array array['ensaios_liberacao', 'conprem_ensaios_liberacao'] loop
    if to_regclass('public.' || alvo) is null then
      continue;
    end if;

    execute format($f$
      alter table public.%I
        -- identificação que o formulário traz e a tabela ainda não tinha
        add column if not exists formulario_numero text,
        add column if not exists destino text,
        add column if not exists tipo_dormente text,
        add column if not exists molde text,
        add column if not exists cavidade text,
        add column if not exists pista text,
        add column if not exists data_producao date,
        add column if not exists cura_termica text,

        -- ensaios de cargas
        add column if not exists momento_pos_apoio numeric,
        add column if not exists momento_pos_apoio_fissura text,
        add column if not exists momento_neg_apoio numeric,
        add column if not exists momento_neg_apoio_fissura text,
        add column if not exists momento_pos_centro numeric,
        add column if not exists momento_pos_centro_fissura text,
        add column if not exists momento_neg_centro numeric,
        add column if not exists momento_neg_centro_fissura text,
        add column if not exists ancoragem_carga numeric,
        add column if not exists ancoragem_fissura text,
        add column if not exists aderencia_escorregamento numeric,
        add column if not exists arrancamento_ombreira_a numeric,
        add column if not exists arrancamento_ombreira_b numeric,
        add column if not exists arrancamento_ombreira_c numeric,

        -- ensaios dimensionais
        add column if not exists inclinacao_base numeric,
        add column if not exists empeno_transversal numeric,
        add column if not exists torcao_ombreira_a text,
        add column if not exists torcao_ombreira_b text,
        add column if not exists torcao_ombreira_c text,
        add column if not exists comprimento numeric,
        add column if not exists base_testeira numeric,
        add column if not exists altura_entre_ombreiras numeric,
        add column if not exists altura_centro numeric,
        add column if not exists altura_plataforma numeric,
        add column if not exists dist_interna_ombreiras_apoio numeric,
        add column if not exists dist_interna_ombreiras_externas text,
        add column if not exists altura_ombreira text
    $f$, alvo);

    execute format('comment on column public.%I.momento_pos_apoio is %L', alvo,
      'Carga do momento positivo no apoio dos trilhos, em kN. Lida do formulário do ensaio.');
    execute format('comment on column public.%I.aderencia_escorregamento is %L', alvo,
      'Escorregamento do aço na aderência, em mm (máximo 0,025).');
    execute format('comment on column public.%I.inclinacao_base is %L', alvo,
      'Inclinação da base de apoio dos trilhos. A faixa aceita muda por fábrica: Cavan 4,54 a 5,55 e Conprem 0,3 a 1,8.');
    execute format('comment on column public.%I.empeno_transversal is %L', alvo,
      'Empeno transversal (torção) entre as bases de apoio, em mm. Cavan aceita até 1 mm e Conprem de 4,00 a 6,00.');
    execute format('comment on column public.%I.cura_termica is %L', alvo,
      'Resposta de "O dormente foi produzido com cura térmica" — define se o lote entra na regra de acompanhamento de 14 dias.');
  end loop;
end $$;

-- Consultas que passam a ser possíveis (as que motivaram estas colunas):
--   select lote_ensaiado, inclinacao_base from ensaios_liberacao
--    where inclinacao_base > 5.4 order by inclinacao_base desc;
--   select ano, semana, round(avg(momento_pos_apoio), 2) as media_kn
--     from ensaios_liberacao where momento_pos_apoio is not null
--    group by ano, semana order by ano desc, semana desc;

create index if not exists ensaios_liberacao_inclinacao_idx
  on public.ensaios_liberacao (inclinacao_base)
  where inclinacao_base is not null;
create index if not exists ensaios_liberacao_momento_pos_apoio_idx
  on public.ensaios_liberacao (momento_pos_apoio)
  where momento_pos_apoio is not null;
