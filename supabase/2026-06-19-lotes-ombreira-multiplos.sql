-- =====================================================================
-- MIGRAÇÃO — Produção de Dormentes: múltiplos lotes de ombreira
-- Rode no Supabase > SQL Editor.
--
-- Motivo:
-- Um lote de dormente pode ter usado MAIS DE UM lote de ombreira. Até aqui
-- isso ficava num único campo de texto (lote_ombreira), digitado tudo junto
-- (ex.: "M222 e N999", "2854/2855", "3000, 3001"). Por causa disso, a tela de
-- Rastreabilidade não conseguia cruzar cada lote de ombreira com a sua
-- inspeção em Inspeções Subcomponentes.
--
-- O que esta migração faz:
-- 1) cria a coluna lotes_ombreira (jsonb) — a lista de lotes de ombreira;
-- 2) faz o backfill: separa o texto antigo (lote_ombreira) nessa lista,
--    sem apagar o campo antigo (que continua guardando os lotes juntos).
--
-- Separadores usados no histórico: "/", espaço, vírgula e a palavra "e".
-- Lotes de ombreira são códigos curtos sem "/" nem espaço internos, então
-- esses separadores nunca quebram um lote legítimo no meio.
--
-- Idempotente: pode rodar de novo sem problema. O backfill só preenche
-- registros cuja lista ainda está vazia, então listas já ajustadas à mão
-- (ou já salvas pelo site) não são sobrescritas.
-- =====================================================================

alter table public.producao_lotes
  add column if not exists lotes_ombreira jsonb not null default '[]'::jsonb;

update public.producao_lotes
set lotes_ombreira = (
  select coalesce(jsonb_agg(s.tok order by s.ord), '[]'::jsonb)
  from (
    select trim(t) as tok, ord
    from regexp_split_to_table(coalesce(lote_ombreira, ''), '[[:space:],;/+&]+')
      with ordinality as x(t, ord)
  ) s
  where s.tok <> '' and lower(s.tok) <> 'e'
)
where (lotes_ombreira is null or lotes_ombreira = '[]'::jsonb)
  and coalesce(lote_ombreira, '') <> '';
