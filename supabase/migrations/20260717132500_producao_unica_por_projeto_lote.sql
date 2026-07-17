-- Impede que sincronizações simultâneas do SafetyCulture criem o mesmo
-- lote mais de uma vez dentro do mesmo projeto. A chave ignora diferenças
-- de caixa, espaços, pontuação e o prefixo opcional "Lote".

create unique index if not exists uq_producao_lotes_projeto_lote_normalizado
  on public.producao_lotes (
    upper(regexp_replace(trim(projeto), '[^A-Za-z0-9]', '', 'g')),
    upper(regexp_replace(
      regexp_replace(trim(lote), '(^|[^A-Za-z0-9])LOTE([^A-Za-z0-9]|$)', '\1\2', 'gi'),
      '[^A-Za-z0-9]',
      '',
      'g'
    ))
  )
  where btrim(projeto) <> '' and btrim(lote) <> '';

comment on index public.uq_producao_lotes_projeto_lote_normalizado is
  'Um lote pode existir em projetos diferentes, mas não pode se repetir dentro do mesmo projeto.';
