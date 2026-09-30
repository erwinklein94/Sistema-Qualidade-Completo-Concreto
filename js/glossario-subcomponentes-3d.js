(function () {
  'use strict';
  let biblioteca;
  let origem;
  let sessao = 0;
  let tentativa = 0;
  const modal = document.createElement('dialog');
  modal.id = 'glosSub3D';
  modal.className = 'glos-sub-3d';
  modal.setAttribute('aria-labelledby', 'glosSub3DTitulo');
  modal.innerHTML = `
    <div class="glossario-cab">
      <div><div class="topo-kicker">Visualização em 3D</div>
        <h2 id="glosSub3DTitulo">SAP 127542 Ombreira E CLIP HFOB02</h2></div>
      <button type="button" class="fechar-modal glossario-fechar" aria-label="Fechar visualização 3D" autofocus>⨯</button>
    </div>
    <div class="glos-sub-3d-corpo">
      <p id="glosSub3DAjuda">Arraste para girar. Use a roda do mouse ou o gesto de pinça para ampliar. Com o modelo em foco, use as setas para girar.</p>
      <p class="glos-sub-3d-status" role="status" aria-live="polite"></p>
      <div class="glos-sub-3d-cena"></div>
      <div class="glos-sub-acoes">
        <button type="button" class="btn btn-secundario btn-sm" data-reset disabled>Restaurar vista</button>
        <button type="button" class="btn btn-secundario btn-sm" data-retry hidden>Tentar novamente</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const status = modal.querySelector('[role="status"]');
  const cena = modal.querySelector('.glos-sub-3d-cena');
  const reset = modal.querySelector('[data-reset]');
  const retry = modal.querySelector('[data-retry]');
  modal.querySelector('.fechar-modal').onclick = () => modal.close();
  modal.addEventListener('click', e => {
    if (e.target !== modal) return;
    const rect = modal.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) modal.close();
  });
  modal.addEventListener('close', () => {
    sessao++;
    cena.replaceChildren();
    origem?.focus();
  });
  function carregarBiblioteca() {
    if (!biblioteca) {
      biblioteca = import('./vendor/model-viewer/model-viewer.min.js').catch(err => {
        biblioteca = null;
        throw err;
      });
    }
    return biblioteca;
  }
  async function carregar() {
    const atual = ++sessao;
    cena.replaceChildren();
    reset.disabled = true;
    retry.hidden = true;
    status.textContent = 'Carregando modelo 3D...';
    const falhar = () => {
      if (atual !== sessao || !modal.open) return;
      status.textContent = 'Não foi possível exibir o modelo 3D. Verifique sua conexão e se o navegador permite gráficos 3D.';
      reset.disabled = true;
      retry.hidden = false;
    };
    try {
      await carregarBiblioteca();
      if (atual !== sessao || !modal.open) return;
      const viewer = document.createElement('model-viewer');
      viewer.setAttribute('alt', 'Modelo 3D da SAP 127542 Ombreira E CLIP HFOB02');
      viewer.setAttribute('aria-describedby', 'glosSub3DAjuda');
      viewer.setAttribute('camera-controls', '');
      viewer.setAttribute('camera-orbit', '35deg 65deg auto');
      viewer.setAttribute('shadow-intensity', '1');
      viewer.setAttribute('loading', 'eager');
      viewer.setAttribute('interaction-prompt', 'none');
      viewer.addEventListener('load', () => {
        if (atual !== sessao || !modal.open) return;
        status.textContent = 'Modelo pronto para explorar.';
        reset.disabled = false;
      });
      viewer.addEventListener('error', falhar);
      viewer.src = 'assets/models/sap-127542-ombreira.glb' + (tentativa ? '?tentativa=' + tentativa : '');
      cena.appendChild(viewer);
      reset.onclick = () => {
        viewer.cameraOrbit = '35deg 65deg auto';
        viewer.cameraTarget = 'auto auto auto';
        viewer.fieldOfView = 'auto';
        viewer.jumpCameraToGoal();
      };
    } catch (err) {
      console.error('Erro no visualizador 3D', err);
      falhar();
    }
  }
  retry.onclick = () => {
    tentativa++;
    carregar();
  };
  window.abrirModeloGlosSub = function (botao) {
    origem = botao;
    if (!modal.open) modal.showModal();
    carregar();
  };
})();
