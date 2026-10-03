/* Mapa de terreno/ruas, malha ferroviária e camadas operacionais autenticadas. */
(() => {
  let mapa;
  let observador;
  let apresentando = false;
  let malha;
  let rotulosMalha;
  let carregandoMalha = false;
  const brasil = [[-34, -74], [6, -34]];
  const permitido = () => Auth.pode('gerenciarSistema');

  function bloquear() {
    window.MapaOperacional?.limpar();
    mapa?.remove();
    mapa = null;
    malha = null;
    rotulosMalha = null;
    observador?.disconnect();
    apresentando = false;
    document.body.classList.remove('mapa-apresentando');
    document.getElementById('paginaMapa').innerHTML = `
      <section class="card" role="alert">
        <h2>Acesso restrito</h2>
        <p>Somente administradores podem visualizar o mapa de origens.</p>
        <a class="btn btn-secundario" href="index.html">Voltar ao início</a>
      </section>`;
  }

  function carregarLeaflet() {
    if (window.L) return Promise.resolve();
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    css.crossOrigin = '';
    const cssPronto = new Promise((resolve, reject) => {
      css.onload = resolve;
      css.onerror = reject;
    });
    document.head.appendChild(css);
    const jsPronto = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return Promise.all([cssPronto, jsPronto]);
  }

  function apresentar(ativo) {
    apresentando = ativo;
    document.getElementById('mapaPainel').classList.toggle('apresentacao', ativo);
    document.body.classList.toggle('mapa-apresentando', ativo);
    const botao = document.getElementById('mapaApresentar');
    botao.textContent = ativo ? 'Sair da apresentação' : 'Modo apresentação';
    botao.setAttribute('aria-pressed', String(ativo));
    mapa?.invalidateSize();
    botao.focus();
  }

  async function alternarMalha() {
    if (!permitido() || !mapa || carregandoMalha) return;
    const botao = document.getElementById('mapaMalha');
    const status = document.getElementById('malhaStatus');
    if (!malha) {
      carregandoMalha = true;
      botao.disabled = true;
      status.textContent = 'Carregando os pontos da malha Rumo...';
      try {
        const resposta = await fetch('assets/data/malha-rumo.geojson?v=20261003-v1');
        if (!resposta.ok) throw new Error('Falha ao buscar a malha');
        const dados = await resposta.json();
        if (!permitido() || !mapa) return;
        malha = L.geoJSON(dados, {
          // Canvas evita milhares de elementos SVG ao exibir a malha completa.
          renderer: L.canvas({ padding: 0.5 }),
          pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
            radius: 4, color: '#003865', weight: 1, fillColor: '#32A6E6', fillOpacity: 0.9
          }),
          onEachFeature(feature, layer) {
            layer.on('click', () => MapaOperacional.abrirMalha(feature));
          }
        });
      } catch (erro) {
        console.error('Erro ao carregar malha', erro);
        status.textContent = 'Não foi possível carregar a malha Rumo. Clique em Mostrar malha Rumo para tentar novamente.';
        return;
      } finally {
        carregandoMalha = false;
        botao.disabled = false;
      }
    }
    const exibir = !mapa.hasLayer(malha);
    if (exibir) malha.addTo(mapa);
    else mapa.removeLayer(malha);
    atualizarRotulosMalha();
    botao.textContent = exibir ? 'Ocultar malha Rumo' : 'Mostrar malha Rumo';
    botao.setAttribute('aria-pressed', String(exibir));
    document.getElementById('mapaEnquadrarMalha').disabled = !exibir;
    status.textContent = exibir
      ? `${malha.getLayers().length.toLocaleString('pt-BR')} pontos da malha Rumo. Siglas visíveis automaticamente; aproxime para ver mais identificações. Clique para consultar os detalhes.`
      : 'Malha Rumo oculta.';
  }

  function atualizarRotulosMalha() {
    rotulosMalha?.clearLayers();
    if (!mapa || !malha || !mapa.hasLayer(malha)) return;
    if (!rotulosMalha) rotulosMalha = L.layerGroup().addTo(mapa);
    const limites = mapa.getBounds();
    const ocupados = new Set();
    // Apenas rótulos na área visível, com espaço para leitura entre vizinhos.
    // Os pontos permanecem todos visíveis; o zoom revela mais identificações.
    malha.eachLayer(layer => {
      const posicao = layer.getLatLng();
      if (!limites.contains(posicao)) return;
      const pixel = mapa.latLngToContainerPoint(posicao);
      const coluna = Math.floor(pixel.x / 24);
      const linha = Math.floor(pixel.y / 12);
      for (let x = coluna - 1; x <= coluna + 1; x++) {
        for (let y = linha - 1; y <= linha + 1; y++) {
          if (ocupados.has(`${x}:${y}`)) return;
        }
      }
      ocupados.add(`${coluna}:${linha}`);
      const nome = String(layer.feature.properties.nome || '').trim();
      const rotulo = document.createElement('span');
      rotulo.textContent = nome.split(/\s+-\s+/)[0] || 'Ponto';
      L.tooltip({
        permanent: true, direction: 'top', offset: [0, -5],
        className: 'mapa-sigla-malha', opacity: 1, interactive: false
      }).setLatLng(posicao).setContent(rotulo).addTo(rotulosMalha);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!await Auth.exigirLogin()) return;
    if (!permitido()) { bloquear(); return; }
    App.montarLayout('ferramenta-mapa', 'Mapa de origens', 'Visão territorial · Acesso exclusivo do administrador');
    document.getElementById('paginaMapa').innerHTML = `
      <section class="mapa-painel" id="mapaPainel" aria-label="Mapa de origens em terreno">
        <div class="mapa-barra">
          <div><h2>Visão do território</h2><p>Malha Rumo · Fornecedores · Origem dos relatórios</p></div>
          <div class="mapa-acoes">
            <label class="mapa-modo">Visualização<select id="mapaModo" disabled><option value="terreno">Terreno</option><option value="ruas">Mapa de ruas</option></select></label>
            <button class="btn btn-secundario" type="button" id="mapaBrasil" disabled>Centralizar no Brasil</button>
            <button class="btn btn-secundario" type="button" id="mapaMalha" aria-pressed="false" disabled>Mostrar malha Rumo</button>
            <button class="btn btn-secundario" type="button" id="mapaEnquadrarMalha" disabled>Enquadrar malha</button>
            <button class="btn btn-primario" type="button" id="mapaApresentar" aria-pressed="false" disabled>Modo apresentação</button>
          </div>
        </div>
        <section id="mapaDadosPainel" class="mapa-dados-painel" aria-label="Camadas de fornecedores e relatórios"></section>
        <div id="mapaStatus" class="mapa-status" role="status">Carregando o mapa de terreno...</div>
        <div id="malhaStatus" class="mapa-status" role="status">Malha Rumo oculta. Ative a camada para visualizar os pontos do arquivo fornecido.</div>
        <div id="mapaTerreno" class="mapa-canvas" role="region" aria-label="Mapa interativo de terreno. Use as setas para navegar e os botões para ajustar o zoom."></div>
        <div class="mapa-rodape"><span class="mapa-legenda-ponto" aria-hidden="true"></span> Malha Rumo: pontos originais do arquivo KMZ. Arraste para explorar e use + / − para aproximar. Na apresentação, pressione Esc para sair.</div>
      </section>`;
    window.addEventListener('auth:perfilAtualizado', () => { if (!permitido()) bloquear(); });
    try {
      await carregarLeaflet();
      // O perfil pode mudar enquanto a biblioteca externa carrega.
      if (!permitido()) { bloquear(); return; }
      mapa = L.map('mapaTerreno', { minZoom: 3, maxZoom: 17 }).fitBounds(brasil);
      mapa.on('moveend zoomend resize', atualizarRotulosMalha);
      const status = document.getElementById('mapaStatus');
      const terreno = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Dados: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Mapa: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
      });
      const ruas = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      });
      let baseAtiva = terreno;
      for (const camada of [terreno, ruas]) {
        let falhou = false;
        camada.on('loading', () => { falhou = false; if (camada === baseAtiva) status.textContent = 'Carregando o mapa...'; });
        camada.on('tileerror', () => {
          falhou = true;
          if (camada === baseAtiva) status.textContent = 'Parte do mapa não carregou. Verifique a conexão ou alterne a visualização.';
        });
        camada.on('load', () => { if (!falhou && camada === baseAtiva) status.textContent = ''; });
      }
      terreno.addTo(mapa);
      document.getElementById('mapaModo').disabled = false;
      document.getElementById('mapaModo').addEventListener('change', ev => {
        mapa.removeLayer(baseAtiva);
        baseAtiva = ev.target.value === 'ruas' ? ruas : terreno;
        status.textContent = '';
        baseAtiva.addTo(mapa);
        document.getElementById('mapaTerreno').setAttribute('aria-label', `Mapa interativo: ${ev.target.value === 'ruas' ? 'ruas' : 'terreno'}`);
      });
      MapaOperacional.iniciar(mapa);
      L.control.scale({ imperial: false }).addTo(mapa);
      document.getElementById('mapaBrasil').disabled = false;
      document.getElementById('mapaApresentar').disabled = false;
      document.getElementById('mapaMalha').disabled = false;
      document.getElementById('mapaMalha').addEventListener('click', alternarMalha);
      document.getElementById('mapaEnquadrarMalha').addEventListener('click', () => {
        if (malha && mapa.hasLayer(malha)) mapa.fitBounds(malha.getBounds(), { padding: [24, 24] });
      });
      document.getElementById('mapaBrasil').addEventListener('click', () => mapa.fitBounds(brasil));
      document.getElementById('mapaApresentar').addEventListener('click', () => apresentar(!apresentando));
      document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && apresentando) apresentar(false); });
      if (window.ResizeObserver) {
        observador = new ResizeObserver(() => mapa?.invalidateSize());
        observador.observe(document.getElementById('mapaTerreno'));
      }
    } catch (erro) {
      console.error('Erro ao carregar mapa', erro);
      const status = document.getElementById('mapaStatus');
      if (status) status.textContent = 'Não foi possível carregar o mapa. Verifique sua conexão e recarregue a página para tentar novamente.';
    }
  });
})();
