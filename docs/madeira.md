# Área de Dormentes de Madeira

`dormentes-madeira.html` apresenta o dashboard e `madeira-inspecoes.html` apresenta o histórico detalhado. As telas seguem o login, o layout e os filtros das áreas AMV e Lastro.

## Fontes e versões

Os quatro arquivos exportados foram tratados como lotes consecutivos, sem auditID repetido. O quarto arquivo também contém uma segunda aba com um rascunho do modelo “Dormente Lei | Inspeção Fornecedor”.

- Recebimento v1: 58 relatórios, 53 colunas, de 19/08/2025 a 03/11/2025.
- Recebimento v2: 100 relatórios, 55 colunas, de 03/11/2025 a 19/02/2026; acrescenta tipo de dormente.
- Recebimento v3: 100 relatórios, 59 colunas, de 20/02/2026 a 12/05/2026; acrescenta verificação de umidade.
- Recebimento v4: 99 relatórios, 57 colunas, de 13/05/2026 a 08/09/2026; representa o modelo mais recente recebido.
- Dormente de lei — fornecedor: um rascunho com 157 colunas, preservado sem preencher dados ausentes.

No total são 358 relatórios únicos, dos quais 343 estão concluídos. Todas as colunas, notas, metadados e datas com horário permanecem em `dados_originais`. A origem é identificada por arquivo, aba, linha e SHA-256. Os arquivos de origem não são alterados.

## Indicadores

O dashboard usa as colunas normalizadas para filtros e cálculos, mantendo o conteúdo original no detalhe. A quantidade declarada soma `Qtd Entregue` nas versões de recebimento; o modelo de dormente de lei usa `Quantidade Inspecionada`. A taxa consolidada é `soma das quantidades reprovadas ÷ soma das quantidades declaradas`, somente para relatórios que possuem os dois valores. Ela não usa a média simples das taxas.

Os defeitos são mostrados separadamente. Um dormente pode apresentar mais de um defeito, portanto as contagens de podre, esmoado, casca, empeno, resina e rachadura/fendilhamento não representam peças únicas quando somadas. Grafias de fornecedores, projetos e tipos são mantidas como registradas; os filtros ignoram apenas caixa e espaços externos.

Campos adicionados em versões posteriores, como tipo e umidade, aparecem como “não informado” nos relatórios antigos. “N/D” é preservado como resposta declarada e não é convertido em aprovação ou reprovação.

## Banco e segurança

A estrutura está em `supabase/migrations/20260909004921_historico_dormentes_madeira.sql` e a carga idempotente em `supabase/2026-09-09-area-madeira-carga-historico.sql`. Reexecutar a carga não sobrescreve auditIDs existentes.

`madeira_inspecoes` possui RLS. Usuários ativos têm somente leitura; o cliente não recebe privilégios de criação, edição ou exclusão. Usuários inativos e anônimos não veem registros. O dashboard pagina consultas em blocos de 500 e busca `dados_originais` apenas quando o usuário abre um relatório.

## Verificação

- `node --test tests/madeira.test.cjs`: reconcilia versões, colunas, totais, defeitos, taxas, filtros e paginação.
- `supabase/tests/madeira.sql`: verifica 358 registros e acesso somente leitura.
- A interface deve ser revisada em desktop e largura estreita, incluindo filtros, detalhe, tema escuro e ausência de erros no console.

O advisor de segurança não apontou ocorrências nos objetos de Madeira. Avisos existentes em outros objetos do projeto ficam fora deste escopo.
