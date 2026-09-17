'use strict';
/* Página Data books: regras sem DOM (áreas, agrupamento, filtros e resumo). */
const ControleDataBooks = (() => {
  const MESES = Object.freeze(['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']);

  // Uma aba da planilha "Controle Databooks" por área. `campoItem` é a coluna
  // que muda entre as linhas de um mesmo data book (lote ou número do pedido).
  const AREAS = Object.freeze([
    Object.freeze({
      id: 'dormente_concreto', hash: 'concreto', titulo: 'Dormentes de Concreto', aba: 'DORMENTE CONCRETO',
      campoItem: 'lote', item: ['lote', 'lotes'], documento: ['data book', 'data books'], agrupa: true,
    }),
    Object.freeze({
      id: 'dormente_madeira', hash: 'madeira', titulo: 'Dormentes de Madeira', aba: 'DORMENTE MADEIRA',
      campoItem: 'numero_pedido', item: ['pedido', 'pedidos'], documento: ['relatório', 'relatórios'], agrupa: true,
    }),
    Object.freeze({
      id: 'ombreiras', hash: 'ombreiras', titulo: 'Ombreiras', aba: 'OMBREIRAS',
      campoItem: 'lote', item: ['registro', 'registros'], documento: ['relatório', 'relatórios'], agrupa: false,
    }),
  ]);

  const CAMPOS_BUSCA = ['fornecedor', 'inspecionado_por', 'numero_pedido', 'lote', 'subcomponente', 'nota_fiscal', 'certificado', 'data_book', 'mes'];

  function area(idOuHash) {
    return AREAS.find(a => a.id === idOuHash || a.hash === idOuHash) || AREAS[0];
  }

  const texto = valor => String(valor ?? '').trim();
  const chave = valor => texto(valor).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

  // Só endereços https absolutos viram link: o valor vai para um href.
  function linkSeguro(valor) {
    const url = texto(valor);
    if (!/^https:\/\/[^\s"<>]+$/i.test(url)) return '';
    try { return new URL(url).protocol === 'https:' ? url : ''; } catch (_) { return ''; }
  }

  function mesNumero(mes) {
    const k = chave(mes);
    return MESES.findIndex(m => chave(m) === k) + 1;
  }

  // Ombreiras não têm ano/mês na planilha: vêm da coluna Data.
  function anoDe(r) {
    if (Number.isInteger(r?.ano)) return r.ano;
    const ano = Number(String(r?.data_referencia || '').slice(0, 4));
    return ano > 0 ? ano : null;
  }

  function mesDe(r) {
    if (texto(r?.mes)) return texto(r.mes);
    const mes = Number(String(r?.data_referencia || '').slice(5, 7));
    return mes >= 1 && mes <= 12 ? MESES[mes - 1] : '';
  }

  function dataBR(iso) {
    const p = String(iso || '').slice(0, 10).split('-');
    return p.length === 3 && p[0] ? `${p[2]}/${p[1]}/${p[0]}` : '';
  }

  // planilha: linha da planilha Controle Databooks; pasta: arquivo da pasta Databook_Cavan.
  const origemDe = r => (r?.origem === 'pasta' ? 'pasta' : 'planilha');

  // Lotes grafados como "M-182" (planilha de lotes HF) e "M182" (Controle Databooks) são o mesmo lote.
  const normalizarLote = valor => texto(valor).replace(/[^0-9A-Za-z]/g, '').toUpperCase();

  // Certificados da pasta (linhas de ombreiras com link) por subcomponente + lote, sem repetir arquivo.
  function certificadosPorLote(registros) {
    const mapa = new Map();
    for (const r of registros || []) {
      if (r.area !== 'ombreiras' || origemDe(r) !== 'pasta' || !linkSeguro(r.link) || !normalizarLote(r.lote)) continue;
      const k = `${chave(r.subcomponente)}|${normalizarLote(r.lote)}`;
      if (!mapa.has(k)) mapa.set(k, []);
      if (!mapa.get(k).some(c => c.link === r.link)) mapa.get(k).push({ data_book: texto(r.data_book), nota_fiscal: texto(r.nota_fiscal), link: texto(r.link) });
    }
    mapa.forEach(lista => lista.sort((a, b) => comparar(a.nota_fiscal, b.nota_fiscal)));
    return mapa;
  }

  function certificadosDoRegistro(mapa, r) {
    return mapa.get(`${chave(r?.subcomponente)}|${normalizarLote(r?.lote)}`) || [];
  }

  function termosBusca(busca) {
    return chave(busca).split(' ').filter(Boolean);
  }

  function contemTermos(valor, termos) {
    const alvo = chave(valor);
    return termos.every(t => alvo.includes(t));
  }

  function textoBusca(r) {
    return [...CAMPOS_BUSCA.map(c => r[c]), anoDe(r), dataBR(r.data_referencia)].map(texto).filter(Boolean).join(' ');
  }

  // Filtros por chave normalizada: ignoram caixa, acento e espaços extras.
  function filtrar(registros, f = {}) {
    const termos = termosBusca(f.busca);
    return (registros || []).filter(r => (!f.area || r.area === f.area)
      && (!f.origem || origemDe(r) === f.origem)
      && (!f.ano || String(anoDe(r)) === String(f.ano))
      && (!f.mes || chave(mesDe(r)) === chave(f.mes))
      && (!f.fornecedor || chave(r.fornecedor) === f.fornecedor)
      && (!f.inspecionado_por || chave(r.inspecionado_por) === f.inspecionado_por)
      && (!f.subcomponente || chave(r.subcomponente) === f.subcomponente)
      && (!termos.length || contemTermos(textoBusca(r), termos)));
  }

  const comparar = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });

  // Junta as linhas que só diferem no lote/pedido: cada grupo é um data book
  // num mesmo mês, com os itens na ordem da planilha e a contagem de repetições.
  function agrupar(registros) {
    const grupos = new Map();
    for (const r of registros || []) {
      const cfg = area(r.area);
      const k = [r.area, anoDe(r), mesDe(r), r.fornecedor, r.inspecionado_por, r.data_book, r.link].map(texto).join('');
      if (!grupos.has(k)) {
        grupos.set(k, {
          chave: k, area: r.area, ano: anoDe(r), mes: mesDe(r), fornecedor: texto(r.fornecedor),
          inspecionado_por: texto(r.inspecionado_por), data_book: texto(r.data_book), link: texto(r.link),
          registros: [], itens: [],
        });
      }
      const g = grupos.get(k);
      g.registros.push(r);
      const valor = texto(r[cfg.campoItem]);
      const existente = g.itens.find(i => i.valor === valor);
      if (existente) existente.vezes++;
      else g.itens.push({ valor, vezes: 1 });
    }
    return [...grupos.values()].sort((a, b) => (b.ano || 0) - (a.ano || 0)
      || mesNumero(b.mes) - mesNumero(a.mes)
      || comparar(a.data_book || a.fornecedor, b.data_book || b.fornecedor)
      || comparar(a.fornecedor, b.fornecedor));
  }

  function ordenarPorData(registros) {
    return [...(registros || [])].sort((a, b) => String(b.data_referencia || '').localeCompare(String(a.data_referencia || ''))
      || comparar(a.lote, b.lote) || (a.fonte_linha || 0) - (b.fonte_linha || 0));
  }

  function distintos(registros, campo) {
    return new Set((registros || []).map(r => chave(typeof campo === 'function' ? campo(r) : r[campo])).filter(Boolean)).size;
  }

  function resumo(registros) {
    const lista = registros || [];
    const anos = lista.map(anoDe).filter(Boolean);
    const datas = lista.map(r => String(r.data_referencia || '').slice(0, 10)).filter(Boolean).sort();
    return {
      registros: lista.length,
      comLote: lista.filter(r => texto(r.lote)).length,
      documentos: distintos(lista, r => r.data_book || r.link),
      documentosPasta: distintos(lista.filter(r => origemDe(r) === 'pasta'), r => r.data_book || r.link),
      comLink: lista.filter(r => linkSeguro(r.link)).length,
      semLink: lista.filter(r => !linkSeguro(r.link)).length,
      fornecedores: distintos(lista, 'fornecedor'),
      lotes: distintos(lista, 'lote'),
      pedidos: distintos(lista, 'numero_pedido'),
      certificados: distintos(lista, 'certificado'),
      quantidade: lista.reduce((soma, r) => soma + (Number(r.quantidade) || 0), 0),
      anoMin: anos.length ? Math.min(...anos) : null,
      anoMax: anos.length ? Math.max(...anos) : null,
      dataMin: datas[0] || '',
      dataMax: datas[datas.length - 1] || '',
    };
  }

  // Opções de filtro: valor = chave normalizada, rótulo = primeira grafia encontrada.
  function opcoes(registros, campo) {
    const mapa = new Map();
    for (const r of registros || []) {
      const rotulo = campo === 'ano' ? String(anoDe(r) || '') : campo === 'mes' ? mesDe(r) : texto(r[campo]);
      const valor = campo === 'ano' ? rotulo : chave(rotulo);
      if (valor && !mapa.has(valor)) mapa.set(valor, rotulo);
    }
    const lista = [...mapa].map(([valor, rotulo]) => ({ valor, rotulo }));
    if (campo === 'ano') return lista.sort((a, b) => Number(b.valor) - Number(a.valor));
    if (campo === 'mes') return lista.sort((a, b) => mesNumero(a.rotulo) - mesNumero(b.rotulo));
    return lista.sort((a, b) => comparar(a.rotulo, b.rotulo));
  }

  // Última carga de cada origem: arquivo/pasta, data da carga e quantos arquivos com link vieram dela.
  function fontes(registros) {
    const saida = {};
    for (const r of registros || []) {
      const o = origemDe(r);
      if (!saida[o]) saida[o] = { arquivo: '', importadoEm: '', links: new Set() };
      if (r.importado_em && r.importado_em > saida[o].importadoEm) Object.assign(saida[o], { arquivo: texto(r.fonte_arquivo), importadoEm: r.importado_em });
      if (linkSeguro(r.link)) saida[o].links.add(r.link);
    }
    Object.values(saida).forEach(f => { f.arquivos = f.links.size; delete f.links; });
    return saida;
  }

  return {
    MESES, AREAS, area, texto, chave, linkSeguro, mesNumero, anoDe, mesDe, dataBR, origemDe, normalizarLote,
    certificadosPorLote, certificadosDoRegistro, termosBusca, contemTermos, filtrar, agrupar, ordenarPorData,
    resumo, opcoes, fontes,
  };
})();
if (typeof window !== 'undefined') window.ControleDataBooks = ControleDataBooks;
if (typeof module !== 'undefined') module.exports = ControleDataBooks;
