// Parser do "MAPA DE RASTREABILIDADE".
//
// Cada lote ocupa um BLOCO de 6 linhas: uma para cada item de fixação
// (Ombreira, Grampo, Isolador Frontal, Isolador Lateral, Palmilha p/ Trilho,
// Palmilha USP). Os dados do lote ficam na linha do meio, mas certificados que
// não couberam numa célula transbordam para as linhas vizinhas do mesmo bloco.
// Por isso lemos o bloco inteiro e juntamos os valores de cada coluna.

import { achar, acharTodos, agruparLinhas, dataBr, juntarUnicos, numeroBr, valorAoLado } from '../core/grid.js';

export const id = 'rastreabilidade';

export function detectar(texto) {
  return /MAPA\s+DE\s+RASTREABILIDADE/i.test(texto);
}

/** Itens de fixação, na ordem impressa no formulário. */
const FIXACOES = [
  { chave: 'ombreiraLote', rotulo: /^Ombreira/i },
  { chave: 'grampo', rotulo: /^Grampo/i },
  { chave: 'isoladorFrontal', rotulo: /^Isolador\s+Frontal/i },
  { chave: 'isoladorLateral', rotulo: /^Isolador\s+Lateral/i },
  { chave: 'palmilhaTrilho', rotulo: /^Palmilha\s+p\/?\s*Trilho/i },
  { chave: 'palmilhaUsp', rotulo: /^Palmilha\s+USP/i },
];

const RE_LOTE = /^\d+-\d+\/\d+(-\d+)?$/;

export function extrair({ paginas }, contexto = {}) {
  const linhas = [];
  let cabecalho = {};

  for (const pagina of paginas) {
    const doCabecalho = lerCabecalho(pagina.fragmentos);
    // páginas seguintes repetem o cabeçalho; se vier vazio, herda da anterior
    cabecalho = { ...cabecalho, ...doCabecalho };

    const colunas = mapearColunas(pagina.fragmentos);
    if (!colunas) continue;

    for (const bloco of blocosDeLote(pagina.fragmentos, colunas)) {
      const linha = lerBloco(bloco, colunas);
      if (!linha.lote) continue;
      linhas.push({
        semana: contexto.semana || '',
        ordemFabricacao: cabecalho.ordemFabricacao || '',
        pedido: cabecalho.pedido || contexto.pedido || '',
        cliente: cabecalho.cliente || '',
        produto: cabecalho.produto || '',
        ...linha,
        observacoes: '',
      });
    }
  }

  return {
    linhas,
    contexto: {
      pedido: cabecalho.pedido || '',
      cliente: cabecalho.cliente || '',
      produto: cabecalho.produto || '',
    },
  };
}

function lerCabecalho(frags) {
  const pegar = (re) => valorAoLado(frags, achar(frags, re), 4, 620).trim();
  return {
    ordemFabricacao: pegar(/ORDEM\s+FABRICA/i),
    pedido: pegar(/^PEDIDO:/i),
    cliente: pegar(/^CLIENTE:/i),
    produto: pegar(/^PRODUTO:/i),
  };
}

/**
 * Descobre a posição horizontal de cada coluna a partir dos rótulos impressos.
 * Devolve uma lista de âncoras ordenadas; o valor cai na âncora cuja borda
 * esquerda estiver mais perto (os campos são alinhados à esquerda).
 */
function mapearColunas(frags) {
  const porX = (a, b) => a.x - b.x;
  const seqNf = acharTodos(frags, /^SEQ\.?\s*NF/i).sort(porX);
  const interno = acharTodos(frags, /^INTERNO$/i).sort(porX);
  const externo = acharTodos(frags, /^EXTERNO$/i).sort(porX);
  const certExterno = acharTodos(frags, /^CERT\.?\s*QUAL\.?\s*EXTERNO/i).sort(porX);

  // aço, cimento, areia, brita, aditivo, adição e fixação
  if (seqNf.length < 7 || interno.length < 4 || externo.length < 4 || certExterno.length < 2) {
    return null;
  }

  const ancora = (chave, f) => (f ? { chave, x: f.x } : null);
  const lista = [
    ancora('lote', achar(frags, /^NUM\/LOTE/i)),
    ancora('dataFabricacao', achar(frags, /^DATA\s+FABRICA/i)),
    ancora('qtdDormentes', achar(frags, /^QTDE\s+DE/i)),
    ancora('serieConcreto', achar(frags, /^CONCRETO$/i)),
    ancora('acoSeqNf', seqNf[0]),
    ancora('acoCertInterno', interno[0]),
    ancora('acoCertExterno', externo[0]),
    ancora('cimentoSeqNf', seqNf[1]),
    ancora('cimentoCertInterno', interno[1]),
    ancora('cimentoCertExterno', externo[1]),
    ancora('areiaSeqNf', seqNf[2]),
    ancora('areiaCertInterno', interno[2]),
    ancora('areiaCertExterno', externo[2]),
    ancora('britaSeqNf', seqNf[3]),
    ancora('britaCertInterno', interno[3]),
    ancora('britaCertExterno', externo[3]),
    ancora('aditivoSeqNf', seqNf[4]),
    ancora('aditivoCertExterno', certExterno[0]),
    ancora('adicaoSeqNf', seqNf[5]),
    ancora('adicaoCertExterno', certExterno[1]),
    // a coluna de rótulos da seção de fixação entra como âncora só para
    // "absorver" os textos Ombreira/Grampo/... e não sujar as colunas de dados
    ancora('_rotuloFixacao', achar(frags, /^Ombreira/i)),
    ancora('_fixacaoSeqNf', seqNf[6]),
    ancora('_fixacaoInterno', interno[4]),
    ancora('_fixacaoExterno', externo[4]),
  ].filter(Boolean);

  lista.sort(porX);
  return lista;
}

/** Âncora mais próxima da borda esquerda do fragmento. */
function colunaDe(colunas, frag) {
  let melhor = colunas[0];
  for (const c of colunas) {
    if (Math.abs(frag.x - c.x) < Math.abs(frag.x - melhor.x)) melhor = c;
  }
  return melhor.chave;
}

/**
 * Divide a página em blocos de lote. Cada bloco começa na linha "Ombreira" da
 * coluna de rótulos de fixação e termina onde começa o próximo.
 */
function blocosDeLote(frags, colunas) {
  const rotulo = colunas.find((c) => c.chave === '_rotuloFixacao');
  if (!rotulo) return [];

  const inicios = frags
    .filter((f) => Math.abs(f.x - rotulo.x) < 12 && /^Ombreira/i.test(f.texto))
    .sort((a, b) => a.y - b.y);

  return inicios.map((f, i) => {
    const y0 = f.y - 3;
    const y1 = i + 1 < inicios.length ? inicios[i + 1].y - 3 : f.y + 45;
    return frags.filter((x) => x.y >= y0 && x.y < y1);
  });
}

function lerBloco(bloco, colunas) {
  const porColuna = new Map();
  for (const f of bloco) {
    const chave = colunaDe(colunas, f);
    if (!porColuna.has(chave)) porColuna.set(chave, []);
    porColuna.get(chave).push(f);
  }
  for (const lista of porColuna.values()) lista.sort((a, b) => a.y - b.y || a.x - b.x);

  const juntar = (chave) => juntarUnicos((porColuna.get(chave) || []).map((f) => f.texto));

  const linha = {
    lote: (porColuna.get('lote') || []).map((f) => f.texto).find((t) => RE_LOTE.test(t)) || '',
    dataFabricacao: dataBr(juntar('dataFabricacao')),
    qtdDormentes: numeroBr(juntar('qtdDormentes')),
    serieConcreto: juntar('serieConcreto'),
  };

  for (const chave of [
    'acoSeqNf', 'acoCertInterno', 'acoCertExterno',
    'cimentoSeqNf', 'cimentoCertInterno', 'cimentoCertExterno',
    'areiaSeqNf', 'areiaCertInterno', 'areiaCertExterno',
    'britaSeqNf', 'britaCertInterno', 'britaCertExterno',
    'aditivoSeqNf', 'aditivoCertExterno',
    'adicaoSeqNf', 'adicaoCertExterno',
  ]) {
    linha[chave] = juntar(chave);
  }

  // Cada item de fixação tem sua própria linha dentro do bloco; a planilha
  // guarda só o Seq./NF de cada um.
  const rotulos = porColuna.get('_rotuloFixacao') || [];
  const seqFixacao = porColuna.get('_fixacaoSeqNf') || [];
  for (const item of FIXACOES) {
    const rot = rotulos.find((f) => item.rotulo.test(f.texto));
    linha[item.chave] = rot
      ? (seqFixacao.find((f) => Math.abs(f.y - rot.y) <= 3)?.texto || '')
      : '';
  }

  return linha;
}
