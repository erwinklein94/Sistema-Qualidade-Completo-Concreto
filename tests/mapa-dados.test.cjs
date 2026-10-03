const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/mapa-dados.js');
const cidades = [['Santa Lúcia', 'SP', -21.685, -48.088], ['São Paulo', 'SP', -23.55, -46.63], ['Santa Lúcia', 'PR', -25.4, -53.5]];

test('extrai coordenadas do relatório e rejeita valores vazios ou inválidos', () => {
  assert.deepEqual(D.extrairCoordenadas('Rua, SP, Brasil\n(-22.02393, -47.895622)'), [-22.02393, -47.895622]);
  assert.equal(D.extrairCoordenadas('Rua 100, km 25'), null);
  assert.equal(D.coordenadas('', ''), null);
  assert.equal(D.coordenadas(91, -47), null);
  assert.deepEqual(D.coordenadas('-23,5', '-46,6'), [-23.5, -46.6]);
});
test('municípios homônimos exigem UF; endereços não são confundidos com localização exata', () => {
  const indice = D.indiceMunicipios(cidades);
  assert.equal(D.municipio('Santa Lúcia', indice), null);
  assert.deepEqual(D.municipio('Santa Lúcia -SP', indice), [-21.685, -48.088]);
  assert.deepEqual(D.municipio('Rua Exemplo, 10 - Bairro, São Paulo - SP, Brasil', indice), [-23.55, -46.63]);
  assert.equal(D.municipio('Sansão - SC', indice), null);
});
test('origem da inspeção é separada da sede do fornecedor; localização da unidade é identificada', () => {
  const base = {
    empresas_subcomponentes: [{ id: 'f1', nome: 'CAVAN', cidade: 'Santa Lúcia - SP' }],
    madeira_inspecoes: [{ id: 'r1', fornecedor: 'Madeireira X', localizacao: '(-22, -47)' }],
    inspecoes_subcomponentes: [{ id: 'r2', empresa_nome: 'Fornecedor Y', local: 'CAVAN' }]
  };
  const d = D.montar(base, cidades);
  assert.deepEqual(d.relatorios[0].posicao, [-22, -47]);
  assert.equal(d.fornecedores.find(f => f.nome === 'Madeireira X').posicao, null);
  assert.deepEqual(d.relatorios[1].posicao, [-21.685, -48.088]);
  assert.match(d.relatorios[1].precisao, /unidade CAVAN/);
  assert.match(d.relatorios[0].pagina, /madeira-inspecoes.html\?id=r1/);
});
test('correção salva prevalece sobre localização aproximada e não modifica dados de origem', () => {
  const r = { id: '1', nome: 'CAVAN', cidade: 'Santa Lúcia - SP' };
  const ajustes = new Map([['fornecedor.1', { lat: -21.7, lng: -48.1, endereco: 'Fábrica' }]]);
  const d = D.montar({ empresas_subcomponentes: [r] }, cidades, ajustes);
  assert.deepEqual(d.fornecedores[0].posicao, [-21.7, -48.1]);
  assert.equal(r.cidade, 'Santa Lúcia - SP');
});
test('links de relatório rejeitam protocolos executáveis', () => {
  assert.equal(D.urlSegura('javascript:alert(1)'), null);
  assert.equal(D.urlSegura('data:text/html,<script>'), null);
  assert.equal(D.urlSegura('https://example.com/relatorio'), 'https://example.com/relatorio');
});
test('camada de dados recusa consulta e gravação sem admin', async () => {
  global.window = { Auth: { pode: () => false } };
  await assert.rejects(D.carregar(), /Acesso restrito/);
  await assert.rejects(D.salvarLocalizacao('x', -23, -46, ''), /Acesso restrito/);
  delete global.window;
});

test('consulta paginada preserva registros acima de 500 e informa fontes que falharam', async () => {
  const originalFetch = global.fetch;
  const registros = Array.from({ length: 501 }, (_, i) => ({ id: String(i), fornecedor: 'Fornecedor', localizacao: '(-22,-47)' }));
  const intervalos = [];
  const cliente = { from(tabela) {
    let inicio, fim;
    const q = { select: () => q, order: () => q, like: () => q,
      range(a, b) { inicio = a; fim = b; return q; },
      then(resolve) {
        if (tabela === 'madeira_inspecoes') intervalos.push([inicio, fim]);
        return Promise.resolve(tabela === 'lastro_inspecoes' ? { error: new Error('offline') } : { data: tabela === 'madeira_inspecoes' ? registros.slice(inicio, fim + 1) : [], error: null }).then(resolve);
      }
    }; return q;
  } };
  global.Auth = { pode: () => true, cliente: () => cliente }; global.window = { Auth: global.Auth };
  global.fetch = async () => ({ ok: true, json: async () => ({ municipios: cidades }) });
  try {
    const dados = await D.carregar();
    assert.equal(dados.relatorios.length, 501);
    assert.deepEqual(intervalos, [[0, 499], [500, 999]]);
    assert.deepEqual(dados.erros, ['lastro_inspecoes']);
  } finally { global.fetch = originalFetch; delete global.Auth; delete global.window; }
});

test('grava uma localização por entidade e rejeita coordenadas inválidas antes da escrita', async () => {
  const gravacoes = [];
  global.Auth = { pode: () => true, cliente: () => ({ from: () => ({ upsert: async p => { gravacoes.push(p); return { error: null }; } }) }) };
  global.window = { Auth: global.Auth };
  try {
    await assert.rejects(D.salvarLocalizacao('fornecedor.1', '', '', ''), /Informe latitude/);
    assert.equal(gravacoes.length, 0);
    await D.salvarLocalizacao('fornecedor.1', '-23,5', '-46,6', 'Fábrica');
    assert.equal(gravacoes[0].chave, 'mapa.localizacao.fornecedor.1');
    assert.deepEqual(JSON.parse(gravacoes[0].valor), { lat: -23.5, lng: -46.6, endereco: 'Fábrica' });
  } finally { delete global.Auth; delete global.window; }
});
