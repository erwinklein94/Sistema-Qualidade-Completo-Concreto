/* =====================================================================
   TREM FUJÃO — tela de login
   Locomotiva SVG nas cores Rumo que foge do cursor/toque.
   - pointer-events: none → nunca atrapalha o formulário.
   - Fica atrás do card de login (z-index 0) e acima do fundo.
   - Respeita prefers-reduced-motion (fica parado, sem animação).
   ===================================================================== */
(function () {
  'use strict';

  var pagina = document.querySelector('.login-page');
  if (!pagina) return;

  var LARGURA = 130;   // largura visual do trem (px)
  var ALTURA = 66;
  var RAIO_FUGA = 180; // distância em que ele começa a fugir
  var FORCA = 2.6;     // impulso máximo de fuga
  var ATRITO = 0.94;
  var MARGEM = 8;

  var wrapper = document.createElement('div');
  wrapper.className = 'login-trem';
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML =
    '<svg viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">' +
      '<g class="trem-corpo">' +
        '<rect x="8" y="14" width="96" height="34" rx="8" fill="#003865"/>' +
        '<path d="M104 14 h10 c12 0 18 10 18 20 v10 c0 2.2-1.8 4-4 4 h-24 z" fill="#003865"/>' +
        '<rect x="8" y="40" width="124" height="8" rx="4" fill="#002D51"/>' +
        '<rect x="8" y="30" width="96" height="5" fill="#1E9F7F"/>' +
        '<rect x="16" y="19" width="16" height="12" rx="3" fill="#32A6E6"/>' +
        '<rect x="38" y="19" width="16" height="12" rx="3" fill="#32A6E6"/>' +
        '<rect x="60" y="19" width="16" height="12" rx="3" fill="#32A6E6"/>' +
        '<rect x="106" y="20" width="14" height="11" rx="3" fill="#7FE06C"/>' +
        '<circle cx="129" cy="38" r="3.5" fill="#FBD300"/>' +
        '<circle cx="28" cy="54" r="8" fill="#002D51"/><circle cx="28" cy="54" r="3" fill="#32A6E6"/>' +
        '<circle cx="58" cy="54" r="8" fill="#002D51"/><circle cx="58" cy="54" r="3" fill="#32A6E6"/>' +
        '<circle cx="88" cy="54" r="8" fill="#002D51"/><circle cx="88" cy="54" r="3" fill="#32A6E6"/>' +
        '<circle cx="114" cy="54" r="8" fill="#002D51"/><circle cx="114" cy="54" r="3" fill="#32A6E6"/>' +
      '</g>' +
    '</svg>';
  pagina.appendChild(wrapper);

  var corpo = wrapper.querySelector('.trem-corpo');

  // Posição inicial: canto inferior esquerdo
  var x = 40;
  var y = window.innerHeight - ALTURA - 60;
  var vx = 0, vy = 0;
  var mouseX = -9999, mouseY = -9999;
  var viradoEsquerda = false;

  function aplicar() {
    wrapper.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
  }

  var reduzirMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduzirMovimento) { aplicar(); return; }

  document.addEventListener('pointermove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });
  document.addEventListener('pointerdown', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  function limites() {
    var maxX = window.innerWidth - LARGURA - MARGEM;
    var maxY = window.innerHeight - ALTURA - MARGEM;
    if (x < MARGEM) { x = MARGEM; vx = Math.abs(vx) * 0.6; }
    if (x > maxX)   { x = maxX;   vx = -Math.abs(vx) * 0.6; }
    if (y < MARGEM) { y = MARGEM; vy = Math.abs(vy) * 0.6; }
    if (y > maxY)   { y = maxY;   vy = -Math.abs(vy) * 0.6; }
  }

  function passo() {
    var cx = x + LARGURA / 2;
    var cy = y + ALTURA / 2;
    var dx = cx - mouseX;
    var dy = cy - mouseY;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < RAIO_FUGA && dist > 0.001) {
      var forca = ((RAIO_FUGA - dist) / RAIO_FUGA) * FORCA;
      vx += (dx / dist) * forca;
      vy += (dy / dist) * forca;
    }

    vx *= ATRITO;
    vy *= ATRITO;
    x += vx;
    y += vy;
    limites();

    // Vira o trem para o lado em que está correndo
    if (vx < -0.3 && !viradoEsquerda) {
      corpo.setAttribute('transform', 'translate(140,0) scale(-1,1)');
      viradoEsquerda = true;
    } else if (vx > 0.3 && viradoEsquerda) {
      corpo.removeAttribute('transform');
      viradoEsquerda = false;
    }

    aplicar();
    requestAnimationFrame(passo);
  }

  window.addEventListener('resize', limites);
  aplicar();
  requestAnimationFrame(passo);
})();
