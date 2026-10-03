const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const fonte = fs.readFileSync(path.join(__dirname, '../js/mapa-origens.js'), 'utf8');

function ambiente({ login = true, admin = false, biblioteca = true } = {}) {
  const eventos = {};
  const elementos = new Map();
  const criados = [];
  const classes = () => ({ add() {}, remove() {}, toggle() {} });
  const elemento = id => {
    if (!elementos.has(id)) elementos.set(id, {
      innerHTML: '', textContent: '', classList: classes(), disabled: true,
      addEventListener(tipo, fn) { this[tipo] = fn; }, setAttribute() {}, focus() {}
    });
    return elementos.get(id);
  };
  const chamadas = { mapas: 0, removidos: 0, centralizados: 0, tamanhos: 0 };
  const camadas = new Set();
  const mapa = {
    on() {}, getBounds: () => ({ contains: () => true }),
    fitBounds() { chamadas.centralizados++; return this; },
    invalidateSize() { chamadas.tamanhos++; }, remove() { chamadas.removidos++; },
    hasLayer: layer => camadas.has(layer), removeLayer: layer => camadas.delete(layer)
  };
  const tiles = { eventos: {}, on(tipo, fn) { this.eventos[tipo] = fn; }, addTo() {} };
  const L = {
    map() { chamadas.mapas++; return mapa; }, tileLayer() { return tiles; },
    control: { scale: () => ({ addTo() {} }) }, canvas: () => ({}),
    layerGroup: () => ({ addTo() { return this; }, clearLayers() {} }),
    geoJSON: dados => ({
      addTo() { camadas.add(this); }, getLayers: () => dados.features, getBounds: () => [], eachLayer() {}
    })
  };
  const contexto = {
    console: { error() {} },
    fetch: async () => {
      chamadas.fetch = (chamadas.fetch || 0) + 1;
      return { ok: true, json: async () => ({ features: [{}, {}] }) };
    },
    Auth: { exigirLogin: async () => login, pode: () => admin },
    App: { montarLayout() {} },
    document: {
      body: { classList: classes() },
      getElementById: elemento,
      addEventListener(tipo, fn) { eventos[tipo] = fn; },
      createElement: () => ({}), head: { appendChild(el) { criados.push(el); } }
    },
    addEventListener(tipo, fn) { eventos[tipo] = fn; }
  };
  if (biblioteca) contexto.L = L;
  contexto.window = contexto;
  vm.runInNewContext(fonte, contexto);
  return { eventos, elemento, chamadas, criados, tiles, revogar() { admin = false; } };
}

test('não carrega mapa ou dependências sem sessão e para perfis não admin', async () => {
  for (const config of [{ login: false }, { admin: false }]) {
    const a = ambiente(config);
    await a.eventos.DOMContentLoaded();
    assert.equal(a.chamadas.mapas, 0);
    assert.equal(a.criados.length, 0);
    if (config.admin === false) assert.match(a.elemento('paginaMapa').innerHTML, /Acesso restrito/);
  }
});

test('admin navega, centraliza e sai da apresentação com Escape', async () => {
  const a = ambiente({ admin: true });
  await a.eventos.DOMContentLoaded();
  assert.equal(a.chamadas.mapas, 1);
  a.elemento('mapaBrasil').click();
  assert.equal(a.chamadas.centralizados, 2);
  a.elemento('mapaApresentar').click();
  assert.equal(a.elemento('mapaApresentar').textContent, 'Sair da apresentação');
  a.eventos.keydown({ key: 'Escape' });
  assert.equal(a.elemento('mapaApresentar').textContent, 'Modo apresentação');
});

test('revogação do perfil remove o mapa já aberto', async () => {
  const a = ambiente({ admin: true });
  await a.eventos.DOMContentLoaded();
  a.revogar();
  a.eventos['auth:perfilAtualizado']();
  assert.equal(a.chamadas.removidos, 1);
  assert.match(a.elemento('paginaMapa').innerHTML, /Acesso restrito/);
});

test('confere novamente a permissão após o carregamento externo', async () => {
  const a = ambiente({ admin: true, biblioteca: false });
  const pronto = a.eventos.DOMContentLoaded();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(a.criados.length, 2);
  a.revogar();
  a.criados.forEach(el => el.onload());
  await pronto;
  assert.equal(a.chamadas.mapas, 0);
  assert.match(a.elemento('paginaMapa').innerHTML, /Acesso restrito/);
});

test('informa falhas de biblioteca e de imagens do terreno', async () => {
  const a = ambiente({ admin: true, biblioteca: false });
  const pronto = a.eventos.DOMContentLoaded();
  await new Promise(resolve => setImmediate(resolve));
  a.criados[0].onerror(new Error('offline'));
  await pronto;
  assert.match(a.elemento('mapaStatus').textContent, /Não foi possível/);
  const b = ambiente({ admin: true });
  await b.eventos.DOMContentLoaded();
  b.tiles.eventos.loading();
  b.tiles.eventos.tileerror();
  b.tiles.eventos.load();
  assert.match(b.elemento('mapaStatus').textContent, /Parte do terreno/);
  b.tiles.eventos.loading();
  b.tiles.eventos.load();
  assert.equal(b.elemento('mapaStatus').textContent, '');
});

test('item Ferramentas é visível somente para admin', () => {
  const comum = fs.readFileSync(path.join(__dirname, '../js/comum.js'), 'utf8');
  for (const admin of [false, true]) {
    const ctx = { window: { Auth: { pode: () => admin } }, ICN: new Proxy({}, { get: () => '' }) };
    vm.runInNewContext(`${comum}\nglobalThis.menu = App.menuPermitido();`, ctx);
    const item = ctx.menu.find(item => item.k === 'ferramenta-mapa');
    assert.equal(!!item, admin);
    if (item) { assert.equal(item.href, 'mapa-origens.html'); assert.equal(item.group, 'ferramentas'); }
  }
});

test('malha carrega sob demanda uma vez e alterna sem refazer download', async () => {
  const a = ambiente({ admin: true });
  await a.eventos.DOMContentLoaded();
  assert.equal(a.chamadas.fetch, undefined);
  await a.elemento('mapaMalha').click();
  assert.equal(a.chamadas.fetch, 1);
  assert.match(a.elemento('malhaStatus').textContent, /2 pontos/);
  assert.equal(a.elemento('mapaEnquadrarMalha').disabled, false);
  a.elemento('mapaEnquadrarMalha').click();
  assert.equal(a.chamadas.centralizados, 2);
  await a.elemento('mapaMalha').click();
  assert.equal(a.elemento('malhaStatus').textContent, 'Malha Rumo oculta.');
  assert.equal(a.elemento('mapaEnquadrarMalha').disabled, true);
  await a.elemento('mapaMalha').click();
  assert.equal(a.chamadas.fetch, 1);
  assert.equal(a.elemento('mapaMalha').textContent, 'Ocultar malha Rumo');
});

test('GeoJSON preserva a quantidade informada e contém somente pontos válidos', () => {
  const dados = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/data/malha-rumo.geojson'), 'utf8'));
  assert.equal(dados.features.length, 10444);
  assert.equal(dados.metadata.totalPontos, dados.features.length);
  for (const feature of dados.features) {
    assert.equal(feature.geometry.type, 'Point');
    const [lon, lat] = feature.geometry.coordinates;
    assert.ok(Number.isFinite(lon) && lon >= -180 && lon <= 180);
    assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90);
    assert.equal(typeof feature.properties.nome, 'string');
  }
});
