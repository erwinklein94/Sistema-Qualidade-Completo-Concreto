/* Mapa de apresentação. Nenhum dado operacional é consultado nesta etapa. */
(() => {
  let mapa;
  let observador;
  let apresentando = false;
  let malha;
  let carregandoMalha = false;
  const brasil = [[-34, -74], [6, -34]];
  const permitido = () => Auth.pode('gerenciarSistema');

  function bloquear() {
    mapa?.remove();
    mapa = null;
    malha = null;
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
            radius: 3, color: '#003865', weight: 1, fillColor: '#FBD300', fillOpacity: 0.9
          }),
          onEachFeature(feature, layer) {
            const conteudo = document.createElement('div');
            const titulo = document.createElement('strong');
            titulo.textContent = feature.properties.nome || 'Ponto da malha Rumo';
            const descricao = document.createElement('p');
            descricao.textContent = feature.properties.descricao || 'Ponto informado no arquivo da malha.';
            conteudo.appendChild(titulo);
            conteudo.appendChild(descricao);
            layer.bindPopup(conteudo);
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
    botao.textContent = exibir ? 'Ocultar malha Rumo' : 'Mostrar malha Rumo';
    botao.setAttribute('aria-pressed', String(exibir));
    document.getElementById('mapaEnquadrarMalha').disabled = !exibir;
    status.textContent = exibir
      ? `${malha.getLayers().length.toLocaleString('pt-BR')} pontos da malha Rumo visíveis. Clique em um ponto para consultar sua identificação.`
      : 'Malha Rumo oculta.';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!await Auth.exigirLogin()) return;
    if (!permitido()) { bloquear(); return; }
    App.montarLayout('ferramenta-mapa', 'Mapa de origens', 'Visão territorial · Acesso exclusivo do administrador');
    document.getElementById('paginaMapa').innerHTML = `
      <section class="mapa-painel" id="mapaPainel" aria-label="Mapa de origens em terreno">
        <div class="mapa-barra">
          <div><h2>Visão do território</h2><p>Terreno · Brasil · Malha ferroviária Rumo</p></div>
          <div class="mapa-acoes">
            <button class="btn btn-secundario" type="button" id="mapaBrasil" disabled>Centralizar no Brasil</button>
            <button class="btn btn-secundario" type="button" id="mapaMalha" aria-pressed="false" disabled>Mostrar malha Rumo</button>
            <button class="btn btn-secundario" type="button" id="mapaEnquadrarMalha" disabled>Enquadrar malha</button>
            <button class="btn btn-primario" type="button" id="mapaApresentar" aria-pressed="false" disabled>Modo apresentação</button>
          </div>
        </div>
        <div id="mapaStatus" class="mapa-status" role="status">Carregando o mapa de terreno...</div>
        <div id="malhaStatus" class="mapa-status" role="status">Malha Rumo oculta. Ative a camada para visualizar os pontos do arquivo fornecido.</div>
        <div id="mapaTerreno" class="mapa-canvas" role="region" aria-label="Mapa interativo de terreno. Use as setas para navegar e os botões para ajustar o zoom."></div>
        <div class="mapa-rodape"><span class="mapa-legenda-ponto" aria-hidden="true"></span> Malha Rumo: pontos originais do arquivo KMZ. Arraste para explorar e use + / − para aproximar. Na apresentação, pressione Esc para sair.</div>
      </section>
      <section class="mapa-futuro" aria-label="Próximas integrações">
        <p><strong>Origem dos relatórios</strong>Em breve, visualize de onde vêm as informações registradas no sistema.</p>
        <p><strong>Localização dos fornecedores</strong>Os pontos serão adicionados quando os endereços ou coordenadas forem vinculados.</p>
      </section>`;
    window.addEventListener('auth:perfilAtualizado', () => { if (!permitido()) bloquear(); });
    try {
      await carregarLeaflet();
      // O perfil pode mudar enquanto a biblioteca externa carrega.
      if (!permitido()) { bloquear(); return; }
      mapa = L.map('mapaTerreno', { minZoom: 3, maxZoom: 17 }).fitBounds(brasil);
      const status = document.getElementById('mapaStatus');
      let falhou = false;
      const terreno = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Dados: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Mapa: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
      });
      terreno.on('loading', () => { falhou = false; status.textContent = 'Carregando o terreno...'; });
      terreno.on('tileerror', () => {
        falhou = true;
        status.textContent = 'Parte do terreno não carregou. Verifique sua conexão ou recarregue a página para tentar novamente.';
      });
      terreno.on('load', () => { if (!falhou) status.textContent = ''; });
      terreno.addTo(mapa);
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
