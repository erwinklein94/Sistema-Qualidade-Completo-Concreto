# Ficha do Lote + Revisão do Painel de Séries (Fluxo de Liberação)

## O que mudou

### Ficha completa do lote (novo)
- Qualquer chip de lote do Painel de Séries (na Linha de fluxo e no Mapa por projeto) agora é clicável e abre a **Ficha do lote** em modal, no mesmo padrão visual do "ver detalhe" da Produção.
- A ficha mostra tudo o que o site sabe sobre o lote: identificação, série e posição no fluxo, idade atual em dias, datas de cura 14/28, período/semana, USP/ombreiras, temperaturas, slump, desprotensão, resistências (CP 1 / CP 2), resultado do lançamento e motivo.
- Seção **Vínculos no site**: busca no Supabase as inspeções de pista, inspeções de concretagem e reprovas daquele lote, com contagem, registros recentes e link do relatório quando existir. Cada bloco tem o botão "Abrir página filtrada" (deep link `?lote=`). Resultado fica em cache durante a sessão do painel.
- Seção **Lotes da mesma série**: navega entre as fichas dos lotes irmãos sem fechar o modal.
- Botão "Abrir na Produção" leva direto ao lote.
- Fecha com Esc, clique fora ou botão; chips respondem a Enter/Espaço (acessibilidade).

### Deep link `?lote=` (novo)
- `producao.html`, `ensaios-liberacao.html`, `inspecao-pista.html`, `inspecao-concretagem.html` e `reprovados.html` aceitam `?lote=NUMERO` e abrem com a busca já preenchida.
- Em Reprovados, quando a página chega via `?lote=`, o período padrão de última semana não é aplicado (para não esconder reprovas antigas do lote).

## Correções nesta revisão

1. **"Próxima série a abrir" com filtros ativos** — a numeração passou a ser calculada sobre todas as séries do painel, não apenas as visíveis no filtro. Antes, filtrar por status podia sugerir um número de série já existente.
2. **Classificação de fase 14/28 dos ensaios** — a detecção deixou de varrer observações com `includes('28')` (uma observação como "concretado em 28/05" classificava o ensaio como 28 dias). Agora só o campo de fase/tipo conta, com fronteira de número; sem fase explícita, vale a idade real do ensaio.
3. **Desempenho do render** — o mapa de projetos era montado duas vezes por render (exportação + tela); agora é calculado uma vez. A busca ganhou debounce de 200 ms e os selects deixaram de registrar o mesmo render em `input` e `change`.
4. **Duplicações removidas** — a tabela de prioridade de status agora vem só do motor (`FluxoLiberacao.prioridadeStatus`), e a página passou a entregar as linhas cruas do Supabase direto ao motor (que já normaliza snake_case), eliminando os mapeadores duplicados. Isso também é o que permite a ficha mostrar todos os campos sem nenhuma consulta extra.
5. **Card da série mais informativo** — mostra a contagem regressiva da cura ("Faltam X dia(s)...", "venceram há X dia(s)") e qual ensaio liberou ou travou a série, com link do relatório.

## Arquivos alterados
- `js/fluxo-liberacao-core.js` — fase 14/28 robusta; exporta `prioridadeStatus`.
- `js/fluxo-liberacao.js` — ficha do lote, vínculos, numeração global, debounce, countdown, liberadoPor/travadoPor.
- `fluxo-liberacao.html` — markup do modal da ficha; versões dos scripts.
- `css/style.css` — estilos dos chips clicáveis e do bloco de vínculos (tokens existentes do tema, claro e escuro).
- `js/producao.js`, `js/ensaios-liberacao.js`, `js/inspecao-pista.js`, `js/inspecao-concretagem.js`, `js/reprovados.js` — pré-preenchem a busca a partir de `?lote=`.
- Páginas correspondentes — versões de cache dos scripts atualizadas.

## Observações
- Os vínculos buscam o lote por igualdade exata do texto (`eq` no Supabase). Se houver lotes cadastrados com espaços ou grafias diferentes entre abas, o vínculo pode não aparecer — padronizar o número do lote resolve.
- Comportamento alterado de propósito: ensaios sem fase explícita e sem "14/28" no campo de fase passam a ser classificados pela idade real (antes, um "28" solto nas observações forçava fase 28).
