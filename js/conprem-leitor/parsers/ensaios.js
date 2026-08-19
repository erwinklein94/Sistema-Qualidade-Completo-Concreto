// Parser do "ENSAIO DE DORMENTES".
//
// Este formulário é TRANSPOSTO: cada página traz até 8 lotes lado a lado, em
// colunas, e cada linha é um parâmetro de ensaio. A planilha quer o contrário
// (um lote por linha), então lemos coluna a coluna e transpomos.
//
// As linhas são localizadas pelos rótulos IMPRESSOS do formulário (à esquerda
// das colunas de lote), e não pela ordem em que aparecem: assim uma linha
// totalmente vazia não desalinha todas as seguintes.

import { achar, acharTodos, agruparLinhas, dataBr, numeroBr, valorAoLado } from '../core/grid.js';

export const id = 'ensaios';

export function detectar(texto) {
  return /ENSAIO\s+DE\s+DORMENTES/i.test(texto);
}

/** Onde começam as colunas de lote; à esquerda disso é rótulo ou faixa de especificação. */
const X_MIN_COLUNAS = 270;

/** Bloco superior: o rótulo se repete dentro de cada coluna, colado no valor. */
const CABECALHO = [
  { campo: 'lote', rotulo: /^Lote$/i },
  { campo: 'dataFabricacao', rotulo: /^Data\s*Fab/i, tipo: 'data' },
  { campo: 'turno', rotulo: /^Turno\s*Fab/i },
  { campo: 'dataEnsaio', rotulo: /^Data\s*Ens/i, tipo: 'data' },
  { campo: 'pista', rotulo: /^Pista$/i, tipo: 'numero' },
  { campo: 'molde', rotulo: /^Molde$/i, tipo: 'numero' },
  { campo: 'linha', rotulo: /^Linha$/i, tipo: 'numero' },
];

/**
 * Linhas de ensaio, ancoradas em texto pré-impresso do formulário.
 * `ocorrencia` desempata rótulos que aparecem mais de uma vez (Passa:, Não
 * Passa:, Superior, Inferior), contando de cima para baixo.
 */
const ENSAIOS = [
  { campos: ['medExtPassa'], rotulo: /^Passa:/i, ocorrencia: 0 },
  { campos: ['medExtNaoPassa'], rotulo: /^N[ãa]o\s+Passa:/i, ocorrencia: 0 },
  { campos: ['medIntPassa'], rotulo: /^Passa:/i, ocorrencia: 1 },
  { campos: ['medIntNaoPassa'], rotulo: /^N[ãa]o\s+Passa:/i, ocorrencia: 1 },
  { campos: ['inclinacao1', 'inclinacao2'], rotulo: /^Inclina/i, ocorrencia: 0 },
  { campos: ['torcaoRelativa'], rotulo: /^Tor[çc][ãa]o\s+relativa/i, ocorrencia: 0, tipo: 'numero' },
  { campos: ['alturaOmbreira1'], rotulo: /Altura\s+da\s+Ombreira\s*-\s*1/i, ocorrencia: 0 },
  { campos: ['alturaOmbreira2'], rotulo: /Altura\s+da\s+Ombreira\s*-\s*2/i, ocorrencia: 0 },
  { campos: ['posicaoInsertos'], rotulo: /Posicionamento\s+dos\s+Insertos/i, ocorrencia: 0 },
  { campos: ['montagemFixacoes'], rotulo: /Montagem\s+das\s+Fixa/i, ocorrencia: 0 },
  { campos: ['comprimento'], rotulo: /^Comprimento$/i, ocorrencia: 0, tipo: 'numero' },
  { campos: ['larguraApoioSup'], rotulo: /^Superior$/i, ocorrencia: 0, tipo: 'numero' },
  { campos: ['larguraApoioInf'], rotulo: /^Inferior$/i, ocorrencia: 0, tipo: 'numero' },
  { campos: ['alturaApoio'], rotulo: /^Altura\s+no\s+apoio$/i, ocorrencia: 0, tipo: 'numero' },
  { campos: ['larguraCentroSup'], rotulo: /^Superior$/i, ocorrencia: 1, tipo: 'numero' },
  { campos: ['larguraCentroInf'], rotulo: /^Inferior$/i, ocorrencia: 1, tipo: 'numero' },
  { campos: ['alturaCentro'], rotulo: /^Altura\s+no\s+centro$/i, ocorrencia: 0, tipo: 'numero' },
  { campos: ['momentoPosApoio'], rotulo: /^Momento\s+Positivo\s+no\s+Apoio/i, ocorrencia: 0 },
  { campos: ['momentoNegApoio'], rotulo: /^Momento\s+Negativo\s+no\s+Apoio/i, ocorrencia: 0 },
  { campos: ['momentoPosCentro'], rotulo: /^Momento\s+Positivo\s+no\s+Centro/i, ocorrencia: 0 },
  { campos: ['momentoNegCentro'], rotulo: /^Momento\s+Negativo\s+no\s+Centro/i, ocorrencia: 0 },
  { campos: ['arrancamentoOmbreiras'], rotulo: /^Arrancamento\s+de\s+Ombreiras/i, ocorrencia: 0 },
  { campos: ['precargaUsp'], rotulo: /^Pr[ée]-carga/i, ocorrencia: 0, tipo: 'numero' },
  { campos: ['cargaMaxUsp'], rotulo: /^Carga\s+M[áa]xima\s+Aplicada/i, ocorrencia: 0, tipo: 'numero' },
  { campos: ['resultadoUsp'], rotulo: /^Resultado:\s*Extraiu/i, ocorrencia: 0 },
  { campos: ['torcaoOmbreiras'], rotulo: /^Tor[çc][ãa]o\s+de\s+Ombreiras/i, ocorrencia: 0 },
  { campos: ['aderenciaCargaFinal'], rotulo: /^Ader[êe]ncia\s+e\s+Carga\s+Final/i, ocorrencia: 0 },
  { campos: ['bitola'], rotulo: /^Ensaio\s+de\s+Bitola/i, ocorrencia: 0 },
  { campos: ['resultadoGeral'], rotulo: /^APROVADO$/i, ocorrencia: 0 },
  { campos: ['executor'], rotulo: /^EXECUTOR$/i, ocorrencia: 0 },
  { campos: ['relatorioFotografico'], rotulo: /RELAT[ÓO]RIO\s+FOTOGR/i, ocorrencia: 0 },
  { campos: ['fiscalizacao'], rotulo: /FISCALIZA[ÇC][ÃA]O/i, ocorrencia: 0 },
  { campos: ['observacoes'], rotulo: /^OBSERVA[ÇC][ÕO]ES/i, ocorrencia: 0 },
];

/** Valores que o Excel de origem emite para célula não preenchida. */
function limpar(texto) {
  const t = String(texto || '').trim();
  return /^#N\/?[AD]$/i.test(t) || t === '#VALOR!' ? '' : t;
}

export function extrair({ paginas }, contexto = {}) {
  const linhas = [];
  let cabecalho = {};

  for (const pagina of paginas) {
    const frags = pagina.fragmentos;
    cabecalho = { ...cabecalho, ...lerCabecalho(frags) };

    const bandas = mapearBandas(frags);
    if (!bandas.length) continue;

    const registros = bandas.map(() => ({}));
    lerCabecalhoDasColunas(frags, bandas, registros);
    lerEnsaios(frags, bandas, registros);

    for (const reg of registros) {
      // colunas reservadas do formulário vêm sem data de fabricação
      if (!reg.lote || !reg.dataFabricacao) continue;
      linhas.push({
        semana: contexto.semana || '',
        ordemFabricacao: cabecalho.ordemFabricacao || '',
        pedido: contexto.pedido || '',
        cliente: cabecalho.cliente || '',
        ...reg,
      });
    }
  }

  return { linhas, contexto: { cliente: cabecalho.cliente || '' } };
}

function lerCabecalho(frags) {
  const of = valorAoLado(frags, achar(frags, /ORDEM\s+DE\s+FABRICA/i), 4, X_MIN_COLUNAS);
  const cliente = achar(frags, /CLIENTE:/i);
  return {
    ordemFabricacao: limpar(of),
    cliente: cliente ? cliente.texto.replace(/.*CLIENTE:\s*/i, '').trim() : '',
  };
}

/** Uma banda horizontal por lote, a partir dos rótulos "Lote" repetidos. */
function mapearBandas(frags) {
  const rotulos = acharTodos(frags, /^Lote$/i)
    .filter((f) => f.x >= X_MIN_COLUNAS)
    .sort((a, b) => a.x - b.x);
  if (!rotulos.length) return [];

  const passo =
    rotulos.length > 1
      ? (rotulos[rotulos.length - 1].x - rotulos[0].x) / (rotulos.length - 1)
      : 60;

  return rotulos.map((f, i) => ({
    x0: f.x - 8,
    x1: i + 1 < rotulos.length ? rotulos[i + 1].x - 8 : f.x + passo - 8,
  }));
}

const naBanda = (f, b) => f.x >= b.x0 && f.x < b.x1;

function converter(texto, tipo) {
  const t = limpar(texto);
  if (!t) return tipo === 'numero' || tipo === 'data' ? null : '';
  if (tipo === 'data') return dataBr(t);
  if (tipo === 'numero') return numeroBr(t);
  return t;
}

function lerCabecalhoDasColunas(frags, bandas, registros) {
  for (const item of CABECALHO) {
    const rotulo = frags.find((f) => f.x >= X_MIN_COLUNAS && item.rotulo.test(f.texto));
    if (!rotulo) continue;

    const daLinha = frags.filter((f) => Math.abs(f.y - rotulo.y) <= 3.5 && f.x >= X_MIN_COLUNAS);
    bandas.forEach((banda, i) => {
      const valores = daLinha
        .filter((f) => naBanda(f, banda) && !item.rotulo.test(f.texto))
        .sort((a, b) => a.x - b.x);
      registros[i][item.campo] = converter(valores.map((f) => f.texto).join(' '), item.tipo);
    });
  }
}

function lerEnsaios(frags, bandas, registros) {
  const esquerda = frags.filter((f) => f.x < X_MIN_COLUNAS);

  for (const item of ENSAIOS) {
    const ocorrencias = esquerda
      .filter((f) => item.rotulo.test(f.texto))
      .sort((a, b) => a.y - b.y);
    const rotulo = ocorrencias[item.ocorrencia || 0];
    if (!rotulo) continue;

    const daLinha = frags.filter((f) => Math.abs(f.y - rotulo.y) <= 3.5 && f.x >= X_MIN_COLUNAS);

    bandas.forEach((banda, i) => {
      const valores = daLinha.filter((f) => naBanda(f, banda)).sort((a, b) => a.x - b.x);
      item.campos.forEach((campo, k) => {
        // com um só campo o conteúdo da célula pode estar quebrado em vários
        // fragmentos; com dois (Inclinação 1 e 2) cada fragmento é um valor
        const bruto =
          item.campos.length === 1
            ? valores.map((f) => f.texto).join(' ')
            : (valores[k]?.texto ?? '');
        registros[i][campo] = converter(bruto, item.tipo);
      });
    });
  }

  // O formulário rotula a linha de resultado como "APROVADO" e marca OK na
  // coluna do lote; a planilha registra a palavra.
  for (const reg of registros) {
    const v = String(reg.resultadoGeral || '').toUpperCase();
    if (v === 'OK') reg.resultadoGeral = 'APROVADO';
  }
}
