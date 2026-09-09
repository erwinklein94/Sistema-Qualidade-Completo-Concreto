# Área de Lastro

`lastro.html` apresenta o dashboard. `lastro-inspecoes.html` apresenta o histórico e o cadastro manual. As duas páginas usam o layout, login e perfis do sistema.

## Histórico

Fonte: `audit_excel_20260909000605UTC.xlsx`, aba `Materiais | Inspeção Pedreira`, linhas 2–72. Foram importados 71 relatórios com auditID único, entre 16/10/2025 e 29/05/2026: 70 concluídos e um rascunho. São 626 respostas Sim, 121 Não, 163 N/D e 13 campos não respondidos.

As 45 colunas originais estão em `dados_originais`, incluindo pontuação, metadados, datas com horário e notas. `fonte_arquivo`, `fonte_linha` e `fonte_sha256` identificam a origem. As datas da planilha não têm fuso explícito: os horários originais são preservados sem conversão, e o filtro usa a data civil declarada.

O script `scripts/importar-historico-lastro.py` lê com openpyxl em modo somente leitura. A carga SQL usa `ON CONFLICT (audit_id) DO NOTHING`: não duplica nem sobrescreve relatórios. Dados do Excel são tratados como conteúdo, nunca como comandos. O arquivo de origem permanece intacto.

## Checklist e indicadores

Os 13 critérios estão em `js/lastro-comum.js`, na mesma ordem do Excel: quatro de pulmão, quatro de ensaios e gestão, três de equipamentos e dois de documentação. Cada resposta tem sua própria nota. Cabeçalho e respostas são gravados atomicamente em `lastro_inspecoes`.

- Respostas positivas: soma de Sim dividida pela soma de Sim + Não, sem N/D nem vazios. Sem denominador, mostra “—”.
- Respostas negativas: contagem de Não, sem inferir reprovação geral ou pendências atuais.
- Rascunhos: podem conter critérios vazios; conclusão exige os 13 preenchidos.
- Nomes: filtros removem espaços externos e ignoram caixa, mantendo unidades e grafias distintas (por exemplo, Minermix e Minermix Capivari).

## Banco e permissões

Estrutura: `supabase/migrations/20260909001841_area_lastro.sql`.
Carga: `supabase/2026-09-09-area-lastro-carga-historico.sql`.

RLS permite leitura aos usuários ativos e criação/edição de registros manuais aos perfis que já podem escrever no sistema. Histórico não possui política de edição. Não há exclusão pelo aplicativo. Usuários anônimos não têm privilégios na tabela. Um trigger valida as respostas e carimba o usuário e horário da alteração. A edição usa `atualizado_em` para detectar conflito de versões.

A listagem busca páginas de 500 registros até concluir, sem depender do limite padrão de resposta do Supabase. Os dados brutos completos são consultados somente ao abrir o detalhe.

## Verificação

- `node --test tests/lastro.test.cjs`: reconciliação com a carga, métricas, filtros, validação e paginação.
- `supabase/tests/lastro.sql`: criação e edição transacionais, bloqueio de conclusão incompleta, proteção do histórico e acesso por perfis. Executa `ROLLBACK`, sem deixar dados fictícios.
- Reconciliação no Supabase: 71 de 71 registros idênticos nos campos originais, respostas e notas.
- Interface verificada em fixture local com os dados extraídos: filtros, detalhes, rascunho e validação de conclusão; revisão visual em largura estreita e desktop.

O advisor não apontou ocorrências novas nos objetos de Lastro. Avisos já existentes em outros objetos do projeto não foram alterados por esta implementação.
