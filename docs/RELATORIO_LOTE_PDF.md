# Padrão de PDF para lotes de dormentes de concreto

O botão **Exportar PDF** na ficha de um lote da Produção abre o relatório A4 com a identidade visual do arquivo de referência `Lote-2838-FN-Cavan-Santa-Lucia.pdf`. O navegador abre a impressão para salvar em PDF; o botão **Salvar PDF / imprimir** permite repetir a operação.

## Onde está o padrão

- `css/relatorio-lote.css`: A4, cores, cabeçalho Rumo, indicadores, seções numeradas, tabelas, barras comparativas, quebras e rodapé com página/total.
- `js/relatorio-lote.js`: estrutura do documento, textos dinâmicos, formatação, vínculos e tratamento de consultas indisponíveis.
- `js/producao.js`: botão da Produção Cavan.
- `js/conprem-producao.js` e `js/conprem-tela.js`: botão da Produção Conprem, usando os campos próprios de rastreabilidade dessa área.

O conteúdo do PDF de referência descreve apenas o lote 2838 e **não é uma regra de negócio**. O modelo reutiliza a apresentação, calcula os indicadores a partir do lote aberto e não transfere números, alertas ou conclusões do 2838 para outros lotes.

## Fontes do relatório Cavan

Produção, pedidos e ensaios vêm dos registros já carregados pela tela. Reprovados, inspeções de pista e de concretagem são consultados pelo número exato do lote. Para Reprovados, o vínculo por ID do lote de produção tem preferência; quando não existe, usa número exato e fornecedor. RNC e aviso do painel só aparecem quando mencionam o código exato do lote. Comparações incluem apenas registros carregados do mesmo fornecedor, projeto, pista e período operacional.

Se uma consulta falhar, o relatório mostra **consulta indisponível**. Campos em branco são mostrados como **não informado**. Dados importados em texto livre, como parte dos relatórios iAuditor, podem não ter todos os campos estruturados para análise automática.

O número de páginas pode crescer quando há mais registros. As quebras principais da Cavan começam nas seções 2, 5 e 8, como nas quatro partes do PDF de referência.
