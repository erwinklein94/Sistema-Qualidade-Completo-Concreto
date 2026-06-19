/* =====================================================================
   Atalho global: Subir Página
   Adiciona um botão discreto no canto inferior esquerdo em todas as páginas.
   ===================================================================== */
(function () {
  function subirAoTopo() {
    const alvo = document.scrollingElement || document.documentElement || document.body;
    if (alvo && typeof alvo.scrollTo === 'function') {
      alvo.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }

  function criarBotaoSubirPagina() {
    if (!document.body || document.getElementById('btnSubirPagina')) return;

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.id = 'btnSubirPagina';
    botao.className = 'subir-pagina-btn';
    botao.title = 'Subir Página';
    botao.setAttribute('aria-label', 'Subir para o topo da página');
    botao.innerHTML = '<span class="subir-pagina-icone" aria-hidden="true">↑</span><span class="subir-pagina-texto">Subir Página</span>';
    botao.addEventListener('click', subirAoTopo);

    document.body.appendChild(botao);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', criarBotaoSubirPagina);
  } else {
    criarBotaoSubirPagina();
  }
})();
