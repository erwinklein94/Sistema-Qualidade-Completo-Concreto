# Visualização 3D do glossário de subcomponentes

O botão é exibido para títulos que contêm o código SAP 127542, no glossário compartilhado das páginas `especificacoes-subcomponentes.html` e `subcomponentes.html`.

- Modelo: `assets/models/sap-127542-ombreira.glb`, cópia do arquivo `ombreira_tampada.glb` fornecido pelo usuário.
- Visualizador: Google model-viewer 4.1.0, distribuído localmente em `js/vendor/model-viewer/`, com licença Apache 2.0 incluída.
- Origem da biblioteca: https://cdn.jsdelivr.net/npm/@google/model-viewer@4.1.0/dist/model-viewer.min.js
- Documentação: https://modelviewer.dev/
- A biblioteca e o modelo só são carregados quando o usuário abre o modal. Nenhuma migração de banco é necessária.
- Publicar os arquivos GLB, JS e CSS junto com as duas páginas HTML. O servidor deve servir JavaScript com MIME apropriado para módulos ES.

O modal oferece rotação, zoom, restauração da câmera, fechamento por Escape e retorno do foco ao botão de origem. O modelo é removido ao fechar o modal. Erros de carregamento exibem uma mensagem e permitem tentar novamente.
