# Validação — Aplicação da Identidade Visual Rumo

Projeto: Sistema de Qualidade Completo — Concreto / DM de Concreto.

## Alterações aplicadas

- Paleta oficial da Rumo centralizada em tokens CSS: `#003865`, `#32A6E6`, `#1E9F7F`, `#7FE06C`, `#FBD300`, `#F78344`, `#9F4BB9` e cinzas institucionais.
- Fonte configurada como `"Cera Pro", Verdana, Geneva, Tahoma, sans-serif`.
- Removido carregamento da fonte externa Inter dos HTMLs, mantendo fallback oficial Verdana.
- Logos oficiais copiados para `assets/rumo/logos/` e aplicados também nos caminhos legados de `assets/brand/` para preservar compatibilidade.
- Ícones oficiais copiados para `assets/rumo/icones/` e mapeados para os caminhos legados principais.
- Sidebar, topo, cards, KPIs, filtros, tabelas, botões, badges, login e tema escuro refinados com a linguagem visual Rumo: azul dominante, acentos verde/azul claro, amarelo apenas pontual e grafismos discretos de movimento.
- Cores antigas aproximadas (`#8DC63F`, `#A9E56D`, `#00A8E9`, `#FFD401`) normalizadas para os tons oficiais.
- Configuração visual dos gráficos ajustada para usar a família tipográfica da Rumo.

## Observação sobre fonte

A Cera Pro é uma fonte licenciada. O projeto **não embute arquivos de fonte**. A declaração CSS usa Cera Pro apenas caso esteja licenciada/instalada no ambiente; caso contrário, cai para Verdana, fallback indicado no manual.

## Glossário de defeitos (aba Reprovados) — jun/2026

Novo componente "Glossário de defeitos" na página de Reprovados, mantendo o padrão Rumo
**reaproveitando os tokens e classes já existentes** (sem cor nova hardcoded):

- Página suspensa (`.glossario-overlay` / `.glossario-painel`) com cabeçalho em azul âncora
  `var(--azul-escuro)` e texto branco, kicker em verde-claro como acento — contraste AA/AAA.
- Cards de defeito reutilizam `--cinza-card`, `--cinza-borda`, `--raio-sm`, `--sombra`/`--sombra-hover`,
  com cantos de raio sutil e sombra tingida de azul, no mesmo padrão dos demais cards.
- Botão "Adicionar defeito" em verde (`btn-verde`) sobre o cabeçalho azul (confirmação/ação),
  botão "Glossário de defeitos" em `btn-secundario`; tema escuro espelha o tratamento de `.card`.
- Sem novos arquivos de fonte; tipografia herda a família Rumo já declarada.

## Checklist

- [x] Azul `#003865` como cor dominante.
- [x] Verde, azul claro e verde claro usados como acentos.
- [x] Amarelo restrito a alertas/destaques.
- [x] Roxo não usado como cor dominante.
- [x] Logo oficial preservado sem distorção.
- [x] Fonte Cera Pro declarada sem redistribuir arquivo proprietário.
- [x] Contraste preservado em tema claro e escuro.
