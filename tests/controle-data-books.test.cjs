const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raiz = path.join(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const DataBooks = require('../js/controle-data-books-comum.js');

function menuPara(admin) {
  const contexto = {
    window: { Auth: { pode: acao => admin && (acao === 'gerenciarSistema' || acao === 'gerenciarUsuarios') } },
    ICN: new Proxy({}, { get: () => '<svg></svg>' }),
    console,
  };
  vm.createContext(contexto);
  vm.runInContext(`${ler('js/comum.js')}\n;globalThis.__App=App;`, contexto);
  return contexto.__App.menuPermitido();
}

const registro = campos => ({
  ano: null, mes: null, fornecedor: null, inspecionado_por: null, numero_pedido: null, lote: null, subcomponente: null,
  data_referencia: null, nota_fiscal: null, certificado: null, quantidade: null, data_book: null, link: null, ...campos,
});
const DB1 = 'https://empresa.sharepoint.com/:b:/s/site/IQ1?e=a';
const DB2 = 'https://empresa.sharepoint.com/:b:/s/site/IQ2?e=b';
const amostra = [
  registro({ area: 'dormente_concreto', ano: 2025, mes: 'Janeiro', fornecedor: 'Cavan - SP', lote: '1368', data_book: '002_25 DB.pdf', link: DB1, fonte_linha: 3 }),
  registro({ area: 'dormente_concreto', ano: 2025, mes: 'Janeiro', fornecedor: 'Cavan - SP', lote: '1371', data_book: '002_25 DB.pdf', link: DB1, fonte_linha: 4 }),
  registro({ area: 'dormente_concreto', ano: 2025, mes: 'Janeiro', fornecedor: 'Cavan - SP', lote: '1371', data_book: '002_25 DB.pdf', link: DB1, fonte_linha: 5 }),
  registro({ area: 'dormente_concreto', ano: 2025, mes: 'Fevereiro', fornecedor: 'Cavan - SP', lote: '1400', data_book: '002_25 DB.pdf', link: DB1, fonte_linha: 6 }),
  registro({ area: 'dormente_concreto', ano: 2025, mes: 'Setembro', fornecedor: 'Conprem - MG', lote: '1-09/25-2', fonte_linha: 7 }),
  registro({ area: 'dormente_madeira', ano: 2024, mes: 'Março', fornecedor: 'Tres Guri', inspecionado_por: 'UFV', numero_pedido: '4501794690', link: DB2, fonte_linha: 3 }),
  registro({ area: 'ombreiras', lote: 'M115', subcomponente: 'HFOB08', data_referencia: '2025-04-28', nota_fiscal: '152703', certificado: '372/25', quantidade: 14990, fonte_linha: 2 }),
  registro({ area: 'ombreiras', lote: 'N008', subcomponente: 'HFOB02', data_referencia: '2026-01-14', nota_fiscal: '165350-165351', certificado: '009/26', quantidade: 5000, fonte_linha: 3 }),
];

test('Data books aparece em Ferramentas para todos os perfis', () => {
  for (const admin of [false, true]) {
    const item = menuPara(admin).find(i => i.k === 'ferramenta-data-books');
    assert.ok(item, `menu ${admin ? 'admin' : 'não admin'} sem Data books`);
    assert.equal(item.t, 'Data books');
    assert.equal(item.href, 'controle-data-books.html');
    assert.equal(item.group, 'ferramentas');
    assert.ok(!item.adminOnly);
    assert.ok(!item.external);
  }
});

test('página exige login, sem restrição de perfil, e carrega os scripts da área', () => {
  const html = ler('controle-data-books.html');
  const pagina = ler('js/controle-data-books-pagina.js');
  assert.match(pagina, /await Auth\.exigirLogin\(\)/);
  assert.doesNotMatch(pagina, /Auth\.pode\(/);
  for (const arquivo of ['js/controle-data-books-comum.js', 'js/store-controle-data-books-supabase.js', 'js/controle-data-books-pagina.js', 'css/controle-data-books.css']) {
    assert.ok(html.includes(arquivo), `${arquivo} não carregado`);
  }
});

test('tabela é somente leitura para usuários ativos', () => {
  const sql = ler('supabase/migrations/20260916130018_controle_data_books.sql');
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.controle_data_books from anon, authenticated/);
  assert.match(sql, /grant select on table public\.controle_data_books to authenticated/);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all)/i);
  assert.match(sql, /for select to authenticated\s+using \(\(select public\.usuario_ativo\(\)\)\)/);
  assert.match(sql, /link ~ '\^https:\/\//);
});

test('links internos do SharePoint não entram no repositório', () => {
  const arquivos = [];
  const varrer = dir => {
    for (const nome of fs.readdirSync(path.join(raiz, dir), { withFileTypes: true })) {
      const rel = path.join(dir, nome.name);
      if (nome.isDirectory()) varrer(rel);
      else if (/\.(sql|js|html|md)$/.test(nome.name)) arquivos.push(rel);
    }
  };
  ['js', 'supabase', 'docs'].forEach(varrer);
  arquivos.push('controle-data-books.html');
  for (const arquivo of arquivos) assert.doesNotMatch(ler(arquivo), /rumolog(-my)?\.sharepoint\.com\/(:b:|sites\/|personal\/)/, arquivo);
});

test('só endereços https viram link', () => {
  assert.equal(DataBooks.linkSeguro(` ${DB1} `), DB1);
  assert.equal(DataBooks.linkSeguro('javascript:alert(1)'), '');
  assert.equal(DataBooks.linkSeguro('http://empresa.sharepoint.com/a'), '');
  assert.equal(DataBooks.linkSeguro('https://empresa.sharepoint.com/a b'), '');
  assert.equal(DataBooks.linkSeguro('https://x.com/"><script>'), '');
  assert.equal(DataBooks.linkSeguro(null), '');
});

test('agrupa as linhas de um data book por mês, na ordem da planilha, contando repetições', () => {
  const grupos = DataBooks.agrupar(amostra.filter(r => r.area === 'dormente_concreto'));
  assert.deepEqual(grupos.map(g => `${g.mes}/${g.ano}`), ['Setembro/2025', 'Fevereiro/2025', 'Janeiro/2025']);
  const janeiro = grupos[2];
  assert.equal(janeiro.registros.length, 3);
  assert.deepEqual(janeiro.itens, [{ valor: '1368', vezes: 1 }, { valor: '1371', vezes: 2 }]);
  assert.equal(janeiro.link, DB1);
  assert.equal(grupos[0].link, '');
  assert.equal(grupos[0].data_book, '');
});

test('filtra por área, ano, mês, fornecedor, laboratório, subcomponente e busca', () => {
  const contar = f => DataBooks.filtrar(amostra, f).length;
  assert.equal(contar({ area: 'dormente_concreto' }), 5);
  assert.equal(contar({ area: 'dormente_concreto', mes: 'janeiro' }), 3);
  assert.equal(contar({ area: 'dormente_concreto', fornecedor: DataBooks.chave('CONPREM - mg') }), 1);
  assert.equal(contar({ area: 'dormente_madeira', mes: 'marco', inspecionado_por: 'ufv' }), 1);
  assert.equal(contar({ area: 'ombreiras', ano: '2026' }), 1);
  assert.equal(contar({ area: 'ombreiras', subcomponente: 'hfob08' }), 1);
  assert.equal(contar({ area: 'dormente_concreto', busca: '1371' }), 2);
  assert.equal(contar({ area: 'dormente_concreto', busca: 'cavan 1400' }), 1);
  assert.equal(contar({ area: 'ombreiras', busca: '14/01/2026' }), 1);
  assert.equal(contar({ area: 'dormente_madeira', busca: 'inexistente' }), 0);
});

const CERT1 = 'https://empresa.sharepoint.com/personal/x/Documents/Databook_Cavan/Certificados_HF/LD_HFOB08_NF159954-55-COMP.pdf';
const CERT2 = 'https://empresa.sharepoint.com/personal/x/Documents/Databook_Cavan/Certificados_HF/LD_HFOB08_NF162079-84-COMP.pdf';
const pasta = [
  registro({ area: 'dormente_concreto', origem: 'pasta', ano: 2026, mes: 'Junho', fornecedor: 'Cavan - SP', data_book: '027_26 - DB CAVAN SL - RUMO_FERRONORTE - JUNHO.pdf', link: DB2, fonte_caminho: '2026/027_26.pdf' }),
  registro({ area: 'ombreiras', origem: 'pasta', subcomponente: 'HFOB08', lote: 'M182', nota_fiscal: '159954-55', data_book: 'LD_HFOB08_NF159954-55-COMP.pdf', link: CERT1 }),
  registro({ area: 'ombreiras', origem: 'pasta', subcomponente: 'HFOB08', lote: 'M182', nota_fiscal: '162079-84', data_book: 'LD_HFOB08_NF162079-84-COMP.pdf', link: CERT2 }),
  registro({ area: 'ombreiras', origem: 'pasta', subcomponente: 'HFOB08', lote: 'M-115', nota_fiscal: '159954-55', data_book: 'LD_HFOB08_NF159954-55-COMP.pdf', link: CERT1 }),
  registro({ area: 'ombreiras', origem: 'pasta', subcomponente: 'HFOB08', lote: 'M234' }),
];

test('origem separa planilha e pasta Databook_Cavan', () => {
  const todos = [...amostra, ...pasta];
  assert.equal(DataBooks.origemDe(amostra[0]), 'planilha');
  assert.equal(DataBooks.origemDe(pasta[0]), 'pasta');
  assert.equal(DataBooks.filtrar(todos, { area: 'dormente_concreto', origem: 'pasta' }).length, 1);
  assert.equal(DataBooks.filtrar(todos, { area: 'dormente_concreto', origem: 'planilha' }).length, 5);
  const concreto = DataBooks.resumo(todos.filter(r => r.area === 'dormente_concreto'));
  assert.equal(concreto.documentos, 2);
  assert.equal(concreto.documentosPasta, 1);
  assert.equal(concreto.comLote, 5);
  const grupos = DataBooks.agrupar(todos.filter(r => r.area === 'dormente_concreto'));
  assert.equal(grupos[0].data_book, '027_26 - DB CAVAN SL - RUMO_FERRONORTE - JUNHO.pdf');
  assert.deepEqual(grupos[0].itens, [{ valor: '', vezes: 1 }]);
  const fontes = DataBooks.fontes([...amostra, ...pasta].map((r, i) => ({ ...r, importado_em: `2026-09-1${i % 2 ? 6 : 7}T10:00:00+00:00`, fonte_arquivo: r.origem === 'pasta' ? 'Pasta Databook_Cavan (OneDrive)' : 'Controle Databooks.xlsx' })));
  assert.equal(fontes.planilha.arquivo, 'Controle Databooks.xlsx');
  assert.equal(fontes.pasta.arquivos, 3);
});

test('certificados HF ligam ao lote da planilha pelo subcomponente e pelo lote sem hífen', () => {
  const mapa = DataBooks.certificadosPorLote(pasta);
  const m182 = DataBooks.certificadosDoRegistro(mapa, registro({ area: 'ombreiras', subcomponente: 'HFOB08', lote: 'M182' }));
  assert.deepEqual(m182.map(c => c.nota_fiscal), ['159954-55', '162079-84']);
  assert.equal(DataBooks.certificadosDoRegistro(mapa, registro({ area: 'ombreiras', subcomponente: 'HFOB08', lote: 'M115' })).length, 1);
  assert.equal(DataBooks.certificadosDoRegistro(mapa, registro({ area: 'ombreiras', subcomponente: 'HFOB02', lote: 'M182' })).length, 0);
  assert.equal(DataBooks.certificadosDoRegistro(mapa, registro({ area: 'ombreiras', subcomponente: 'HFOB08', lote: 'M234' })).length, 0);
  assert.equal(DataBooks.normalizarLote(' n-008 '), 'N008');
});

test('migração da origem mantém planilha rastreável e protege a carga da pasta', () => {
  const sql = ler('supabase/migrations/20260917112056_controle_data_books_origem_pasta.sql');
  assert.match(sql, /check \(origem in \('planilha', 'pasta'\)\)/);
  assert.match(sql, /origem = 'planilha' and fonte_linha is not null and fonte_sha256 is not null/);
  assert.match(sql, /origem = 'pasta' and fonte_caminho is not null/);
  const script = ler('scripts/importar-controle-data-books.ps1');
  assert.match(script, /delete from public\.controle_data_books where origem = 'planilha';/);
  assert.doesNotMatch(script, /delete from public\.controle_data_books;/);
});

test('resumo e opções de filtro', () => {
  const concreto = DataBooks.resumo(amostra.filter(r => r.area === 'dormente_concreto'));
  assert.equal(concreto.registros, 5);
  assert.equal(concreto.documentos, 1);
  assert.equal(concreto.semLink, 1);
  assert.equal(concreto.fornecedores, 2);
  assert.equal(concreto.lotes, 4);
  assert.deepEqual([concreto.anoMin, concreto.anoMax], [2025, 2025]);
  const ombreiras = DataBooks.resumo(amostra.filter(r => r.area === 'ombreiras'));
  assert.equal(ombreiras.quantidade, 19990);
  assert.deepEqual([ombreiras.dataMin, ombreiras.dataMax], ['2025-04-28', '2026-01-14']);
  assert.deepEqual(DataBooks.opcoes(amostra.filter(r => r.area === 'dormente_concreto'), 'mes').map(o => o.rotulo), ['Janeiro', 'Fevereiro', 'Setembro']);
  assert.deepEqual(DataBooks.opcoes(amostra.filter(r => r.area === 'ombreiras'), 'ano').map(o => o.valor), ['2026', '2025']);
  assert.deepEqual(DataBooks.ordenarPorData(amostra.filter(r => r.area === 'ombreiras')).map(r => r.lote), ['N008', 'M115']);
});
