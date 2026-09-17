'use strict';
let DBC_REGISTROS = [], DBC_AREA = ControleDataBooks.AREAS[0].id, DBC_CARREGANDO = false, DBC_ERRO = false;
// Certificados HF da pasta Databook_Cavan por subcomponente + lote (aba Ombreiras).
let DBC_CERTIFICADOS = new Map();
const dbcEl = id => document.getElementById(id);
const dbcEsc = valor => U.esc(String(valor ?? ''));
const dbcTexto = valor => dbcEsc(ControleDataBooks.texto(valor) || '—');
const dbcNum = valor => Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const dbcMaiuscula = valor => valor.charAt(0).toUpperCase() + valor.slice(1);
const dbcDaPasta = r => ControleDataBooks.origemDe(r) === 'pasta';
// Lotes/pedidos mostrados de saída em cada data book; o restante abre em "Mostrar mais".
const DBC_ITENS_VISIVEIS = 24;
const DBC_BUSCA_DICA = {
  dormente_concreto: 'Lote, data book ou fornecedor',
  dormente_madeira: 'Pedido, fornecedor ou laboratório',
  ombreiras: 'Lote, nota fiscal ou certificado',
};
const DBC_ORIGEM = { planilha: 'Planilha Controle Databooks', pasta: 'Pasta Databook_Cavan' };

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  App.montarLayout('ferramenta-data-books', 'Data books', 'Data books por área, com os links dos relatórios no SharePoint');
  App.acoesTopo('<button type="button" class="btn btn-secundario btn-sm" id="atualizarDataBooks">Atualizar</button>');
  dbcEl('atualizarDataBooks').addEventListener('click', carregarDataBooks);
  dbcEl('abasDataBooks').addEventListener('click', e => {
    const aba = e.target.closest('[data-area]');
    if (aba) selecionarAreaDataBooks(aba.dataset.area, true);
  });
  dbcEl('abasDataBooks').addEventListener('keydown', navegarAbasDataBooks);
  dbcEl('filtrosDataBooks').addEventListener('input', renderDataBooks);
  dbcEl('limparDataBooks').addEventListener('click', () => { dbcEl('filtrosDataBooks').reset(); renderDataBooks(); });
  window.addEventListener('hashchange', () => selecionarAreaDataBooks(areaDaUrlDataBooks(), false));
  DBC_AREA = areaDaUrlDataBooks();
  await carregarDataBooks();
});

function areaDaUrlDataBooks() {
  let hash = '';
  try { hash = decodeURIComponent(location.hash.slice(1)); } catch (_) {}
  return ControleDataBooks.area(hash).id;
}

async function carregarDataBooks() {
  if (DBC_CARREGANDO) return;
  DBC_CARREGANDO = true; DBC_ERRO = false;
  dbcEl('estadoDataBooks').textContent = 'Carregando data books…';
  dbcEl('kpisDataBooks').innerHTML = ''; dbcEl('listaDataBooks').innerHTML = ''; dbcEl('fonteDataBooks').textContent = '';
  dbcEl('filtrosDataBooks').querySelectorAll('input,select,button').forEach(el => el.disabled = true);
  dbcEl('atualizarDataBooks').disabled = true;
  renderAbasDataBooks();
  try {
    DBC_REGISTROS = await StoreControleDataBooks.listar();
    DBC_CERTIFICADOS = ControleDataBooks.certificadosPorLote(DBC_REGISTROS);
    dbcEl('estadoDataBooks').textContent = '';
    const { planilha, pasta } = ControleDataBooks.fontes(DBC_REGISTROS);
    const data = iso => new Date(iso).toLocaleDateString('pt-BR');
    dbcEl('fonteDataBooks').textContent = [
      planilha ? `Dados da planilha ${planilha.arquivo}, importados em ${data(planilha.importadoEm)}` : '',
      pasta ? `${pasta.arquivos} arquivos da pasta Databook_Cavan (OneDrive) que não estavam na planilha, adicionados em ${data(pasta.importadoEm)}` : '',
    ].filter(Boolean).join('; ') + (planilha || pasta ? '. Os links abrem os arquivos no SharePoint da Rumo.' : '');
    DBC_CARREGANDO = false;
    selecionarAreaDataBooks(DBC_AREA, false);
  } catch (err) {
    DBC_ERRO = true;
    DBC_REGISTROS = [];
    window.Exportacoes?.registrar(null);
    dbcEl('estadoDataBooks').textContent = StoreControleDataBooks.erro(err) + ' Use Atualizar para tentar novamente.';
  } finally {
    DBC_CARREGANDO = false;
    dbcEl('filtrosDataBooks').querySelectorAll('input,select,button').forEach(el => el.disabled = false);
    dbcEl('atualizarDataBooks').disabled = false;
    renderAbasDataBooks();
  }
}

function selecionarAreaDataBooks(id, atualizarUrl) {
  const area = ControleDataBooks.area(id);
  if (area.id !== DBC_AREA) dbcEl('filtrosDataBooks').reset();
  DBC_AREA = area.id;
  if (atualizarUrl && location.hash !== `#${area.hash}`) history.replaceState(null, '', `#${area.hash}`);
  prepararFiltrosDataBooks();
  renderDataBooks();
}

function navegarAbasDataBooks(e) {
  const areas = ControleDataBooks.AREAS;
  const atual = areas.findIndex(a => a.id === DBC_AREA);
  const destino = { ArrowRight: (atual + 1) % areas.length, ArrowLeft: (atual - 1 + areas.length) % areas.length, Home: 0, End: areas.length - 1 }[e.key];
  if (destino === undefined) return;
  e.preventDefault();
  selecionarAreaDataBooks(areas[destino].id, true);
  dbcEl(`aba-${areas[destino].hash}`)?.focus();
}

// O número de cada aba conta os arquivos (data books, relatórios ou certificados) da área.
function renderAbasDataBooks() {
  dbcEl('abasDataBooks').innerHTML = ControleDataBooks.AREAS.map(a => {
    const ativa = a.id === DBC_AREA;
    const arquivos = ControleDataBooks.resumo(DBC_REGISTROS.filter(r => r.area === a.id)).documentos;
    const total = DBC_CARREGANDO || DBC_ERRO ? '' : `<span class="dbc-aba-total" title="${dbcNum(arquivos)} arquivos">${dbcNum(arquivos)}</span>`;
    return `<button type="button" role="tab" class="dbc-aba" id="aba-${a.hash}" data-area="${a.id}" aria-selected="${ativa}" aria-controls="painelDataBooks" tabindex="${ativa ? 0 : -1}">${dbcEsc(a.titulo)}${total}</button>`;
  }).join('');
}

function prepararFiltrosDataBooks() {
  const area = ControleDataBooks.area(DBC_AREA);
  const daArea = DBC_REGISTROS.filter(r => r.area === area.id);
  const ombreiras = area.id === 'ombreiras';
  const temPasta = daArea.some(dbcDaPasta);
  dbcEl('rotuloFornecedorDataBooks').textContent = ombreiras ? 'Subcomponente' : 'Fornecedor';
  dbcEl('campoInspecaoDataBooks').hidden = area.id !== 'dormente_madeira';
  dbcEl('campoOrigemDataBooks').hidden = !temPasta;
  if (!temPasta) dbcEl('origemDataBooks').value = '';
  dbcEl('buscaDataBooks').placeholder = DBC_BUSCA_DICA[area.id];
  preencherSelectDataBooks('anoDataBooks', ControleDataBooks.opcoes(daArea, 'ano'));
  preencherSelectDataBooks('mesDataBooks', ControleDataBooks.opcoes(daArea, 'mes'));
  preencherSelectDataBooks('fornecedorDataBooks', ControleDataBooks.opcoes(daArea, ombreiras ? 'subcomponente' : 'fornecedor'));
  preencherSelectDataBooks('inspecaoDataBooks', ControleDataBooks.opcoes(daArea, 'inspecionado_por'));
  dbcEl('painelDataBooks').setAttribute('aria-labelledby', `aba-${area.hash}`);
}

function preencherSelectDataBooks(id, opcoes) {
  const el = dbcEl(id), atual = el.value;
  el.innerHTML = '<option value="">Todos</option>' + opcoes.map(o => `<option value="${dbcEsc(o.valor)}">${dbcEsc(o.rotulo)}</option>`).join('');
  if (opcoes.some(o => o.valor === atual)) el.value = atual;
}

function filtrosDataBooks() {
  const area = ControleDataBooks.area(DBC_AREA);
  const ombreiras = area.id === 'ombreiras';
  const selecionado = dbcEl('fornecedorDataBooks').value;
  return {
    area: area.id,
    busca: dbcEl('buscaDataBooks').value,
    ano: dbcEl('anoDataBooks').value,
    mes: dbcEl('mesDataBooks').value,
    fornecedor: ombreiras ? '' : selecionado,
    subcomponente: ombreiras ? selecionado : '',
    inspecionado_por: area.id === 'dormente_madeira' ? dbcEl('inspecaoDataBooks').value : '',
    origem: dbcEl('campoOrigemDataBooks').hidden ? '' : dbcEl('origemDataBooks').value,
  };
}

function renderDataBooks() {
  renderAbasDataBooks();
  if (DBC_CARREGANDO || DBC_ERRO) return;
  const area = ControleDataBooks.area(DBC_AREA);
  const daArea = DBC_REGISTROS.filter(r => r.area === area.id);
  const f = filtrosDataBooks();
  const lista = ControleDataBooks.filtrar(DBC_REGISTROS, f);
  const termos = ControleDataBooks.termosBusca(f.busca);
  dbcEl('kpisDataBooks').innerHTML = kpisDataBooks(area, lista)
    .map(([rotulo, valor, extra, cls]) => `<div class="kpi ${cls}"><div class="rotulo">${rotulo}</div><div class="valor">${valor}</div><div class="extra">${extra}</div></div>`).join('');
  dbcEl('tituloListaDataBooks').textContent = area.titulo;
  dbcEl('contadorDataBooks').textContent = contadorDataBooks(area, lista, daArea);
  dbcEl('notaDataBooks').textContent = notaDataBooks(area, daArea);
  if (!daArea.length) dbcEl('listaDataBooks').innerHTML = vazioDataBooks('Nenhum registro nesta área', 'A planilha importada não tem linhas preenchidas para esta área.');
  else if (!lista.length) dbcEl('listaDataBooks').innerHTML = vazioDataBooks('Nenhum resultado encontrado', 'Ajuste a busca ou os filtros.');
  else dbcEl('listaDataBooks').innerHTML = area.agrupa ? tabelaGruposDataBooks(area, lista, termos) : ombreirasDataBooks(area, lista, termos);
  registrarExportacaoDataBooks(area, lista);
}

function vazioDataBooks(titulo, texto) {
  return `<div class="vazio"><h3>${dbcEsc(titulo)}</h3><p>${dbcEsc(texto)}</p></div>`;
}

function contadorDataBooks(area, lista, daArea) {
  if (area.id === 'ombreiras') {
    const certificados = ControleDataBooks.resumo(lista).documentos;
    return `${dbcNum(lista.filter(r => !dbcDaPasta(r)).length)} de ${dbcNum(daArea.filter(r => !dbcDaPasta(r)).length)} registros · ${dbcNum(certificados)} certificados`;
  }
  const campo = area.campoItem;
  const comItem = linhas => linhas.filter(r => ControleDataBooks.texto(r[campo])).length;
  return `${dbcNum(comItem(lista))} de ${dbcNum(comItem(daArea))} ${area.item[1]} · ${dbcNum(ControleDataBooks.resumo(lista).documentos)} ${area.documento[1]}`;
}

function notaDataBooks(area, daArea) {
  if (area.id === 'ombreiras' && daArea.some(dbcDaPasta)) {
    return 'Os certificados HF são da pasta Certificados_HF (Databook_Cavan) e estão ligados aos lotes pela planilha "Lotes ombreiras HFOB08_Cavan" dessa pasta. A planilha Controle Databooks não tem links para ombreiras.';
  }
  if (area.id === 'ombreiras') return 'A aba OMBREIRAS da planilha ainda não tem links de relatório preenchidos.';
  if (daArea.some(dbcDaPasta)) {
    return 'Os data books que estão só na pasta Databook_Cavan aparecem sem lotes: os lotes ficam dentro dos PDFs e ainda não foram lançados na planilha Controle Databooks.';
  }
  return '';
}

function kpisDataBooks(area, lista) {
  if (area.id === 'ombreiras') {
    const planilha = ControleDataBooks.resumo(lista.filter(r => !dbcDaPasta(r)));
    const pasta = lista.filter(dbcDaPasta);
    const lotes = comLink => new Set(pasta.filter(r => !!ControleDataBooks.linkSeguro(r.link) === comLink).map(r => ControleDataBooks.normalizarLote(r.lote)).filter(Boolean)).size;
    const mesAno = iso => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
    return [
      ['Registros', dbcNum(planilha.registros), `${dbcNum(planilha.lotes)} lotes distintos na planilha`, 'escuro'],
      ['Quantidade', dbcNum(planilha.quantidade), 'Soma da coluna Quantidade', ''],
      ['Certificados HF', dbcNum(ControleDataBooks.resumo(pasta).documentos), `${dbcNum(lotes(true))} lotes com certificado · ${dbcNum(lotes(false))} sem certificado`, ''],
      ['Período', planilha.dataMin ? `${mesAno(planilha.dataMin)} – ${mesAno(planilha.dataMax)}` : '—', 'Pela coluna Data', 'amarelo'],
    ];
  }
  const r = ControleDataBooks.resumo(lista);
  const contagem = new Map();
  lista.forEach(i => { const nome = ControleDataBooks.texto(i.fornecedor); if (nome) contagem.set(nome, (contagem.get(nome) || 0) + 1); });
  const principal = [...contagem].sort((a, b) => b[1] - a[1])[0];
  const periodo = r.anoMin ? (r.anoMin === r.anoMax ? String(r.anoMin) : `${r.anoMin} – ${r.anoMax}`) : '—';
  const [item, itens] = area.item;
  const madeira = area.id === 'dormente_madeira';
  const extraDocumentos = [
    r.documentosPasta ? `${dbcNum(r.documentosPasta)} só na pasta Databook_Cavan` : '',
    r.semLink ? `${dbcNum(r.semLink)} ${r.semLink === 1 ? item : itens} sem link` : '',
  ].filter(Boolean).join(' · ') || 'Todos com link';
  return [
    [dbcMaiuscula(area.documento[1]), dbcNum(r.documentos), extraDocumentos, 'escuro'],
    [dbcMaiuscula(itens), dbcNum(madeira ? r.registros : r.comLote), `${dbcNum(madeira ? r.pedidos : r.lotes)} números distintos`, ''],
    ['Fornecedores', dbcNum(r.fornecedores), principal ? `Mais ${itens}: ${dbcEsc(principal[0])}` : '—', ''],
    ['Período', periodo, `Anos dos ${area.documento[1]}`, 'amarelo'],
  ];
}

function tabelaGruposDataBooks(area, lista, termos) {
  const concreto = area.id === 'dormente_concreto';
  const cabecalho = concreto
    ? '<th>Período</th><th>Fornecedor</th><th>Data book</th><th>Lotes</th><th>Link</th>'
    : '<th>Período</th><th>Fornecedor</th><th>Inspecionado por</th><th>Pedidos</th><th>Relatório</th>';
  return `<div class="tabela-wrap"><table class="tabela tabela-dbc tabela-dbc--${area.hash}"><thead><tr>${cabecalho}</tr></thead><tbody>${ControleDataBooks.agrupar(lista).map(g => `<tr>
    <td class="nowrap">${dbcEsc(g.mes && g.ano ? `${g.mes}/${g.ano}` : g.ano || g.mes || '—')}</td>
    <td>${dbcTexto(g.fornecedor)}</td>
    <td>${concreto ? `<span class="dbc-nome">${dbcTexto(g.data_book)}</span>` : dbcTexto(g.inspecionado_por)}</td>
    <td>${itensDataBooks(area.item, g, termos)}</td>
    <td>${linkDataBooks(concreto ? 'Abrir data book' : 'Abrir relatório', g)}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

function itensDataBooks([item, itens], grupo, termos) {
  if (!grupo.itens.some(i => i.valor)) {
    const daPasta = grupo.registros.every(dbcDaPasta);
    return `<div class="dbc-itens"><span class="dbc-sem-itens">${dbcMaiuscula(itens)} não informados${daPasta ? ' · arquivo da pasta Databook_Cavan' : ''}</span></div>`;
  }
  // Com busca ativa, os lotes/pedidos encontrados vêm primeiro e destacados.
  const achados = termos.length ? grupo.itens.filter(i => termos.some(t => ControleDataBooks.chave(i.valor).includes(t))) : [];
  const lista = achados.length ? [...achados, ...grupo.itens.filter(i => !achados.includes(i))] : grupo.itens;
  const chip = i => `<span class="dbc-chip${achados.includes(i) ? ' dbc-chip--achado' : ''}">${dbcEsc(i.valor || 'sem número')}${i.vezes > 1 ? `<small title="Aparece ${i.vezes} vezes na planilha">×${i.vezes}</small>` : ''}</span>`;
  const visiveis = lista.slice(0, DBC_ITENS_VISIVEIS), resto = lista.slice(DBC_ITENS_VISIVEIS);
  const total = grupo.registros.length;
  return `<div class="dbc-itens"><div class="dbc-itens-total">${dbcNum(total)} ${total === 1 ? item : itens}</div>
    <div class="dbc-chips">${visiveis.map(chip).join('')}</div>
    ${resto.length ? `<details class="dbc-mais"><summary>Mostrar mais ${dbcNum(resto.length)}</summary><div class="dbc-chips">${resto.map(chip).join('')}</div></details>` : ''}</div>`;
}

function botaoLinkDataBooks(url, rotulo, arquivo) {
  const titulo = arquivo ? `Abrir ${arquivo} no SharePoint` : 'Abrir no SharePoint';
  return `<a class="btn btn-secundario btn-sm dbc-link" href="${dbcEsc(url)}" target="_blank" rel="noopener noreferrer" title="${dbcEsc(titulo)}">${ICN.olho}<span>${dbcEsc(rotulo)}</span></a>`;
}

function linkDataBooks(rotulo, registro, discreto = false) {
  const url = ControleDataBooks.linkSeguro(registro.link);
  if (!url) return discreto ? '—' : '<span class="badge badge-amarelo">Sem link na planilha</span>';
  return botaoLinkDataBooks(url, rotulo, registro.data_book);
}

// Aba Ombreiras: registros da planilha (com os certificados do lote) e a lista de certificados HF da pasta.
function ombreirasDataBooks(area, lista, termos) {
  const planilha = lista.filter(r => !dbcDaPasta(r));
  const pasta = lista.filter(dbcDaPasta);
  return [
    planilha.length ? `<h3 class="dbc-secao">Registros da planilha Controle Databooks</h3>${tabelaOmbreirasDataBooks(planilha)}` : '',
    pasta.length ? `<h3 class="dbc-secao">Certificados HF · pasta Databook_Cavan</h3>${tabelaCertificadosDataBooks(pasta, termos)}` : '',
  ].join('');
}

function tabelaOmbreirasDataBooks(lista) {
  return `<div class="tabela-wrap"><table class="tabela tabela-dbc tabela-dbc--ombreiras"><thead><tr><th>Data</th><th>Subcomponente</th><th>Lote</th><th>Nota fiscal</th><th>Certificado</th><th class="right">Quantidade</th><th>Certificados HF</th></tr></thead><tbody>${ControleDataBooks.ordenarPorData(lista).map(r => `<tr>
    <td class="nowrap">${dbcEsc(ControleDataBooks.dataBR(r.data_referencia) || '—')}</td>
    <td>${dbcTexto(r.subcomponente)}</td>
    <td><strong>${dbcTexto(r.lote)}</strong></td>
    <td>${dbcTexto(r.nota_fiscal)}</td>
    <td>${dbcTexto(r.certificado)}</td>
    <td class="right">${r.quantidade == null ? '—' : dbcNum(r.quantidade)}</td>
    <td>${certificadosDoLoteDataBooks(r)}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

function certificadosDoLoteDataBooks(r) {
  const certificados = ControleDataBooks.certificadosDoRegistro(DBC_CERTIFICADOS, r);
  if (!certificados.length) return linkDataBooks('Abrir relatório', r, true);
  return `<div class="dbc-certificados">${certificados.map(c => botaoLinkDataBooks(c.link, `NF ${c.nota_fiscal}`, c.data_book)).join('')}</div>`;
}

function tabelaCertificadosDataBooks(lista, termos) {
  // Certificados com arquivo primeiro; o grupo sem arquivo reúne os lotes "Não encontrado" da planilha HF.
  const grupos = ControleDataBooks.agrupar(lista).sort((a, b) => (!a.link) - (!b.link));
  return `<div class="tabela-wrap"><table class="tabela tabela-dbc tabela-dbc--certificados"><thead><tr><th>Certificado</th><th>Subcomponente</th><th>Lotes</th><th>Link</th></tr></thead><tbody>${grupos.map(g => {
    const nf = ControleDataBooks.texto(g.registros[0].nota_fiscal);
    const certificado = g.data_book
      ? `<span class="dbc-nome">${nf ? `NF ${dbcEsc(nf)}` : dbcTexto(g.data_book)}</span><small class="dbc-arquivo">${dbcTexto(g.data_book)}</small>`
      : '<span class="badge badge-amarelo">Certificado não encontrado</span><small class="dbc-arquivo">Lotes marcados como "Não encontrado" na planilha de lotes HF</small>';
    return `<tr>
      <td>${certificado}</td>
      <td>${dbcTexto(g.registros[0].subcomponente)}</td>
      <td>${itensDataBooks(['lote', 'lotes'], g, termos)}</td>
      <td>${linkDataBooks('Abrir certificado', g, true)}</td>
    </tr>`;
  }).join('')}</tbody></table></div>`;
}

// Excel/PDF do topo: linhas filtradas da área. O link vai só no Excel.
function registrarExportacaoDataBooks(area, lista) {
  if (!window.Exportacoes) return;
  const colunas = {
    dormente_concreto: [['ano', 'Ano'], ['mes', 'Mês'], ['lote', 'Lote'], ['fornecedor', 'Fornecedor'], ['data_book', 'Data book'], ['origem', 'Origem']],
    dormente_madeira: [['ano', 'Ano'], ['mes', 'Mês'], ['inspecionado_por', 'Inspecionado por'], ['numero_pedido', 'Número do pedido'], ['fornecedor', 'Fornecedor']],
    ombreiras: [['subcomponente', 'Subcomponente'], ['lote', 'Lote'], ['data', 'Data'], ['nota_fiscal', 'Nota fiscal'], ['certificado', 'Certificado'], ['quantidade', 'Quantidade'], ['certificados', 'Certificados HF'], ['origem', 'Origem']],
  }[area.id].map(([key, label]) => ({ key, label }));
  const filtros = [{ campo: 'Área', valor: area.titulo }, ...[...dbcEl('filtrosDataBooks').querySelectorAll('.campo')].filter(c => !c.hidden).map(c => {
    const campo = c.querySelector('input, select');
    const valor = campo.tagName === 'SELECT' ? (campo.value ? campo.selectedOptions[0].textContent : '') : campo.value.trim();
    return { campo: c.querySelector('label').textContent.trim(), valor: valor || 'Todos' };
  })];
  Exportacoes.registrar({
    titulo: `Data books · ${area.titulo}`,
    filtros,
    secoes: [{
      titulo: area.titulo,
      columns: colunas,
      xlsxColumns: [...colunas, { key: 'link', label: 'Link' }],
      rows: lista.map(r => ({
        ...r,
        ano: ControleDataBooks.anoDe(r),
        mes: ControleDataBooks.mesDe(r),
        data: ControleDataBooks.dataBR(r.data_referencia),
        origem: DBC_ORIGEM[ControleDataBooks.origemDe(r)],
        certificados: dbcDaPasta(r) ? ControleDataBooks.texto(r.data_book) : ControleDataBooks.certificadosDoRegistro(DBC_CERTIFICADOS, r).map(c => c.data_book).join('; '),
        link: ControleDataBooks.linkSeguro(r.link),
      })),
    }],
    observacao: 'Fonte: planilha Controle Databooks e pasta Databook_Cavan, importadas no Supabase. Exportação gerada somente a partir dos filtros aplicados na tela.',
  });
}
