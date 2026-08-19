// Parser do "RESUMO SEMANAL CONPREM - RUMO".
//
// É o mais simples dos três: um formulário de rótulo à esquerda e valor à
// direita, mais um bloco de refugos em que os números ficam numa linha abaixo
// dos títulos. Gera exatamente UMA linha para a aba "Resumo Semanal".

import {
  achar,
  acharTodos,
  agruparLinhas,
  dataBr,
  numeroBr,
  semanaIso,
  textoDe,
  valorAoLado,
} from '../core/grid.js';

export const id = 'resumo';

export function detectar(texto) {
  return /RESUMO\s+SEMANAL/i.test(texto);
}

/** Rótulos do bloco de refugos, na ordem em que aparecem no formulário. */
const REFUGOS = [
  { chave: 'fissuras', rotulo: /^Fissuras/i },
  { chave: 'vazios', rotulo: /^Vazios/i },
  { chave: 'ombreiras', rotulo: /^Ombreiras/i },
  { chave: 'quebras', rotulo: /^Quebras/i },
  { chave: 'usp', rotulo: /^USP$/i },
  { chave: 'falhasFabricacao', rotulo: /^Falhas/i },
  { chave: 'outros', rotulo: /^Outros/i },
];

export function extrair({ paginas }) {
  const frags = paginas.flatMap((p) => p.fragmentos);
  const linha = {};

  // --- cabeçalho: rótulo à esquerda, valor à direita ---
  const numFrag = achar(frags, /N[ºo°]\s*\d/i);
  linha.numeroResumo = numFrag ? numeroBr(numFrag.texto.replace(/^\D+/, '')) : null;

  const dataEmissao = dataBr(valorAoLado(frags, achar(frags, /^Data$/i)));
  linha.dataEmissao = dataEmissao;

  const periodos = acharTodos(frags, /^Per[íi]odo$/i);
  if (periodos[0]) {
    const t = valorAoLado(frags, periodos[0]);
    const datas = t.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/g) || [];
    linha.periodoInicio = dataBr(datas[0]);
    linha.periodoFim = dataBr(datas[1]);
  }

  linha.unidade = valorAoLado(frags, achar(frags, /^Unidade$/i));
  linha.produto = valorAoLado(frags, achar(frags, /^Produto\s*-\s*Material$/i));
  linha.pedidoLocal = valorAoLado(frags, achar(frags, /^Pedido$/i));
  linha.qtdFabricada = numeroBr(valorAoLado(frags, achar(frags, /^Quantidade\s+Fabricada$/i)));
  linha.ensaiosRealizados = numeroBr(
    valorAoLado(frags, achar(frags, /^Quantidade\s+Ensaios\s+Realizados$/i)),
  );
  const refugosDeclarado = numeroBr(
    valorAoLado(frags, achar(frags, /^Quantidade\s+Refugos$/i)),
  );

  // --- bloco de refugos: números alinhados sob os títulos ---
  Object.assign(linha, extrairRefugos(frags));

  const soma = REFUGOS.reduce((acc, r) => acc + (linha[r.chave] || 0), 0);
  linha.totalRefugos = refugosDeclarado ?? soma;

  linha.taxaRefugo = linha.qtdFabricada ? linha.totalRefugos / linha.qtdFabricada : null;
  linha.ensaiosPorMil = linha.qtdFabricada
    ? (linha.ensaiosRealizados / linha.qtdFabricada) * 1000
    : null;

  // --- planejamento de produção ---
  const tituloPlan = achar(frags, /Planejamento\s+de\s+Produ/i);
  if (tituloPlan) {
    const abaixo = frags.filter((f) => f.y > tituloPlan.y && f.y < tituloPlan.y + 45);
    const datas = textoDe(abaixo).match(/\d{1,2}\/\d{1,2}\/\d{2,4}/g) || [];
    linha.planejamentoInicio = dataBr(datas[0]);
    linha.planejamentoFim = dataBr(datas[1]);
    const qtd = abaixo.find((f) => /dormentes/i.test(f.texto));
    linha.qtdPlanejada = qtd ? numeroBr(qtd.texto) : null;
  }

  linha.semana = dataEmissao ? semanaIso(dataEmissao) : '';

  return { linhas: [linha], contexto: contextoDe(linha) };
}

/**
 * Casa cada número do bloco de refugos com o título mais próximo na horizontal.
 * Números faltando simplesmente ficam zerados, sem deslocar as outras colunas.
 */
function extrairRefugos(frags) {
  const saida = Object.fromEntries(REFUGOS.map((r) => [r.chave, 0]));

  const ancoras = [];
  for (const r of REFUGOS) {
    const f = frags.find((x) => r.rotulo.test(x.texto));
    if (f) ancoras.push({ chave: r.chave, x: f.x + f.w / 2, y: f.y });
  }
  if (ancoras.length < 2) return saida;

  const yTitulos = Math.max(...ancoras.map((a) => a.y));

  // a linha de valores é a primeira abaixo dos títulos formada só por números
  const candidatas = agruparLinhas(frags.filter((f) => f.y > yTitulos + 3 && f.y < yTitulos + 40));
  const linhaValores = candidatas.find(
    (l) => l.itens.length >= 2 && l.itens.every((f) => /^\d+$/.test(f.texto)),
  );
  if (!linhaValores) return saida;

  for (const f of linhaValores.itens) {
    const cx = f.x + f.w / 2;
    let melhor = ancoras[0];
    for (const a of ancoras) {
      if (Math.abs(cx - a.x) < Math.abs(cx - melhor.x)) melhor = a;
    }
    saida[melhor.chave] = numeroBr(f.texto) ?? 0;
  }
  return saida;
}

/** Dados que os outros PDFs da mesma semana podem reaproveitar. */
function contextoDe(linha) {
  const pedido = String(linha.pedidoLocal || '').match(/\d{6,}/);
  return {
    semana: linha.semana || '',
    pedido: pedido ? pedido[0] : '',
    produto: linha.produto || '',
  };
}
