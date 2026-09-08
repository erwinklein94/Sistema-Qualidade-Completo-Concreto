/* =====================================================================
   AREA-EM-CONSTRUCAO.JS — Telas das áreas novas (Dormentes de Madeira,
   Lastro e AMV)

   As três áreas nascem vazias: por enquanto só existem no menu e nesta
   tela de espera, que monta o mesmo cabeçalho das demais páginas para o
   sistema continuar inteiro. Cada página declara o que exibir em
   data-menu / data-titulo / data-subtitulo no <body>; quando a área
   ganhar módulos de verdade, é só trocar este script pelo da área.
   ===================================================================== */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;

  const cfg = document.body.dataset;
  const titulo = cfg.titulo || 'Área nova';
  App.montarLayout(cfg.menu || '', titulo, cfg.subtitulo || '');
  App.acoesTopo('');

  const alvo = document.getElementById('paginaArea');
  if (!alvo) return;

  alvo.innerHTML = `
    <div class="card area-vazia">
      <div class="card-titulo"><span class="acento">${U.esc(titulo)}</span></div>
      <div class="vazio">
        ${window.ICN?.vazioBox || ''}
        <h3>Área ainda sem conteúdo</h3>
        <p>Nenhum módulo foi cadastrado para ${U.esc(titulo)} até agora.</p>
      </div>
      <p class="txt-mini txt-cinza">Estrutura pronta para receber as telas da área — produção, ensaios, inspeções, especificações e indicadores — na mesma organização usada em Dormentes de Concreto.</p>
    </div>`;
});
