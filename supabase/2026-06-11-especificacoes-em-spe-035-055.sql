-- =====================================================================
-- ESPECIFICAÇÕES — Campos extraídos das normas Rumo:
--   EM-SPE-035 rev.10 (09/09/2025) — Dormente de concreto monobloco
--                                    para bitola larga — Malha Paulista
--   EM-SPE-055 rev.05 (06/10/2025) — Palmilha para dormente de concreto
--                                    (under sleeper pad)
-- Complementa a tabela public.especificacoes_dormentes criada em
-- supabase/2026-05-31-especificacoes-e-equipamentos.sql.
-- Idempotente: pode ser executado mais de uma vez.
-- =====================================================================

alter table public.especificacoes_dormentes
  -- Parâmetros de projeto (EM-SPE-035, itens 6.1.1.x)
  add column if not exists carga_eixo_projeto text,              -- 32,5 t/eixo
  add column if not exists velocidade_maxima_projeto text,       -- 80 km/h
  add column if not exists espacamento_dormentes text,           -- máx. 600 mm
  add column if not exists peso_maximo_dormente text,            -- ≤ 400 kg
  add column if not exists inclinacao_trilho text,               -- 1:40
  add column if not exists pressao_max_lastro text,              -- ≤ 1,00 MPa
  add column if not exists bitola_grade_montada text,            -- 1600 +2/-1 mm
  add column if not exists dist_centro_eixo_via text,            -- tol. 12 mm

  -- Momentos fletores de projeto p/ ensaio (EM-SPE-035, Tabela 1, kN·m)
  add column if not exists momento_fletor_positivo_apoio text,   -- 30,6 kN·m
  add column if not exists momento_fletor_negativo_apoio text,   -- 21,4 kN·m
  add column if not exists momento_fletor_negativo_centro text,  -- 24,4 kN·m
  add column if not exists momento_fletor_positivo_centro text,  -- 17,1 kN·m

  -- Protensão, acabamento e danos (EM-SPE-035, itens 11.3 e 12.1)
  add column if not exists fio_protensao text,                   -- CP 170/175 RB E
  add column if not exists posicionamento_fios_protensao text,   -- ±3 / ±6 mm
  add column if not exists superficie_apoio_trilho text,         -- irreg. ≤ 1 mm
  add column if not exists danos_admissiveis_movimentacao text,  -- 10x150x25 mm

  -- Palmilha USP (EM-SPE-055 e EM-SPE-035 item 12)
  add column if not exists usp_distancia_bordos text,            -- 10 a 20 mm
  add column if not exists usp_imersao_elastomero text,          -- ≥ 2 mm
  add column if not exists usp_espessura_elastomero_externo text,-- 7 a 20 mm
  add column if not exists usp_planicidade text,                 -- ≤ 2 mm / 1380 mm
  add column if not exists usp_rigidez_estatica text,            -- Cstat ≥ 0,22 N/mm³
  add column if not exists usp_area_contato text,                -- ≥ 18 %
  add column if not exists usp_resistencia_arrancamento text,    -- ≥ 0,3 N/mm²
  add column if not exists usp_resistencia_tracao text;          -- ≥ 2,5 N/mm²

-- RLS, triggers de auditoria e índices já existem na tabela e cobrem
-- as novas colunas automaticamente. Após rodar, atualize o schema cache
-- (Settings → API → Reload schema) se o front acusar coluna inexistente.
