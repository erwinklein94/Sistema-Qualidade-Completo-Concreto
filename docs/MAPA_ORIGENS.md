# Mapa de origens

Disponível em Ferramentas, somente para administradores. Camadas independentes de malha Rumo, fornecedores e origem dos relatórios; bases Terreno (OpenTopoMap) e Ruas (OpenStreetMap).

## Fontes e localização

`js/mapa-dados.js` consulta as tabelas existentes com a sessão do usuário, em páginas de 500 registros. Inclui empresas de subcomponentes, fornecedores das listas de configuração e fornecedores citados nos relatórios. Os relatórios incluem Madeira, Lastro, AMV, Subcomponentes, Madeira de Lei, inspeções e ensaios de Cavan/Conprem. A lista `FONTES` identifica exatamente as tabelas e páginas atendidas. Uma fonte indisponível não impede as demais e aparece no aviso de carregamento parcial.

Prioridade de localização:

1. Coordenadas confirmadas pelo administrador para o registro.
2. Coordenadas presentes no próprio registro, inclusive no campo textual `localizacao`.
3. Referência municipal, com correspondência exata de município/UF e indicação explícita de posição aproximada. Nomes de municípios homônimos sem UF não são resolvidos.
4. Unidade declarada no campo local, ou fábrica específica do módulo, identificada como referência da unidade.

O local de uma inspeção **não** é usado como sede do fornecedor. Fornecedores sem endereço confiável ficam na lista de pendentes. O modal permite salvar coordenadas, sem alterar o cadastro/relatório original. As correções usam uma chave por entidade em `configuracoes_sistema` (`mapa.localizacao.<entidade>`). Essa tabela já permite escrita somente a administradores via RLS; sua política de leitura existente permite usuários ativos. Nenhuma política foi ampliada por esta implementação.

A referência de municípios é pública e versionada localmente em `assets/data/municipios-mapa.json`, derivada de <https://github.com/kelvins/municipios-brasileiros>, com licença MIT preservada em `municipios-LICENSE.txt`. Não são enviados endereços do sistema para geocodificação externa. Dados operacionais são consultados em tempo de execução, não incorporados a arquivos públicos.

## Interação

Pontos coincidentes da mesma camada são agrupados, com acesso a todos os registros pelo modal. Fornecedores e relatórios usam ícones distintos e deslocamentos visuais para manter ambos clicáveis na mesma coordenada. Busca e filtros estão na lista de registros. Os links abrem a página de origem; Madeira, Lastro e AMV suportam a abertura por ID, e telas de concreto com filtro de lote recebem esse parâmetro quando disponível. Outros módulos abrem sua respectiva página/aba.

Modais exibem detalhes, campos originais, links HTTP/HTTPS válidos e relatórios relacionados. O modal da malha lista registros em até 50 km, sem afirmar relação operacional. Escape fecha primeiro o modal e depois o modo apresentação. A revogação do perfil limpa dados e modais da tela.

## Verificação

`node --test tests/mapa-dados.test.cjs tests/mapa-origens.test.cjs tests/menu-painel-sites.test.cjs`

Os testes de navegador usam sessão e dados simulados, sem gravações de teste no banco de produção. Esquemas, políticas e amostras de localização foram conferidos no projeto Supabase configurado. Locais ausentes ou inválidos precisam ser confirmados pelo administrador.
