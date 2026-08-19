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
  const refugos = extrairRefugos(frags);
  Object.assign(linha, refugos.valores);
  const avisos = refugos.avisos;

  const soma = REFUGOS.reduce((acc, r) => acc + (linha[r.chave] || 0), 0);
  linha.totalRefugos = refugosDeclarado ?? soma;

  // O formulário declara o total de refugos num campo e o detalha por tipo em
  // outro. Se os dois não fecham, alguma coluna foi lida errado — e é melhor
  // dizer isso ao usuário do que gravar um detalhamento que contradiz o total.
  if (refugosDeclarado != null && soma !== refugosDeclarado) {
    avisos.push(
      `Resumo Semanal: o campo "Quantidade Refugos" diz ${refugosDeclarado}, mas os tipos somam ${soma} `
      + `(${REFUGOS.map((r) => `${r.chave} ${linha[r.chave] || 0}`).join(', ')}). `
      + 'Confira o bloco "Dormentes Refugados" antes de gravar.',
    );
  }

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

  return { linhas: [linha], contexto: contextoDe(linha), avisos };
}

/**
 * Casa cada número do bloco "Dormentes Refugados" com a coluna a que pertence.
 *
 * O bloco é uma tabela sem grade: os títulos ficam numa faixa e os números
 * numa linha abaixo, alinhados por baixo de cada título. A ligação é
 * geométrica, e é aí que dá errado com facilidade — por isso a função devolve
 * também os avisos do que não deu para casar com segurança, em vez de gravar
 * um número na coluna errada calada.
 *
 * @returns {{valores: Object, avisos: string[]}}
 */
function extrairRefugos(frags) {
  const valores = Object.fromEntries(REFUGOS.map((r) => [r.chave, 0]));
  const avisos = [];

  const ancoras = montarAncoras(frags);
  const faltando = REFUGOS.filter((r) => !ancoras.some((a) => a.chave === r.chave));
  if (ancoras.length < 2) {
    avisos.push('Não encontrei o bloco "Dormentes Refugados" no PDF: os refugos por tipo ficaram zerados.');
    return { valores, avisos };
  }
  if (faltando.length) {
    avisos.push(`Coluna(s) de refugo não encontrada(s) no bloco: ${faltando.map((r) => r.chave).join(', ')}.`);
  }

  const numeros = linhaDeValores(frags, ancoras);
  if (!numeros.length) {
    avisos.push('Encontrei os títulos dos refugos, mas nenhuma linha de números abaixo deles.');
    return { valores, avisos };
  }

  // Tolerância: metade do menor espaçamento entre colunas vizinhas. Mais que
  // isso e o número está sob outra coluna — melhor não adivinhar.
  const centros = ancoras.map((a) => a.x).sort((a, b) => a - b);
  const menorVao = centros.slice(1).reduce((m, x, i) => Math.min(m, x - centros[i]), Infinity);
  const tolerancia = Number.isFinite(menorVao) ? Math.max(menorVao / 2, 12) : 60;

  const usadas = new Map();
  for (const f of numeros) {
    const cx = f.x + f.w / 2;
    const perto = ancoras
      .map((a) => ({ a, d: Math.abs(cx - a.x) }))
      .sort((p, q) => p.d - q.d)[0];

    if (!perto || perto.d > tolerancia) {
      avisos.push(`O número "${f.texto}" do bloco de refugos não ficou sob nenhuma coluna reconhecível e foi ignorado.`);
      continue;
    }
    if (usadas.has(perto.a.chave)) {
      avisos.push(`Dois números caíram sob a coluna "${perto.a.chave}" ("${usadas.get(perto.a.chave)}" e "${f.texto}"): confira o bloco de refugos.`);
      continue;
    }
    usadas.set(perto.a.chave, f.texto);
    valores[perto.a.chave] = numeroBr(f.texto) ?? 0;
  }

  return { valores, avisos };
}

/**
 * Um título por coluna, com o centro horizontal real. Título quebrado em duas
 * linhas ("Falhas de" / "Fabricação") vira uma âncora só, senão o centro sai
 * deslocado e o número da coluna vizinha é atribuído a ela.
 */
function montarAncoras(frags) {
  const ancoras = [];
  for (const r of REFUGOS) {
    const f = frags.find((x) => r.rotulo.test(x.texto));
    if (!f) continue;

    // pedaços do mesmo título: logo acima ou abaixo, com sobreposição horizontal
    const partes = [f].concat(frags.filter((x) => {
      if (x === f) return false;
      if (Math.abs(x.y - f.y) > 16 || Math.abs(x.y - f.y) < 3) return false;
      if (/\d/.test(x.texto)) return false;
      return x.x < f.x + f.w && x.x + x.w > f.x;
    }));

    const esq = Math.min(...partes.map((p) => p.x));
    const dir = Math.max(...partes.map((p) => p.x + p.w));
    ancoras.push({ chave: r.chave, x: (esq + dir) / 2, y: Math.max(...partes.map((p) => p.y)) });
  }
  return ancoras;
}

/**
 * Os números do bloco. Pega a linha abaixo dos títulos com mais números — e
 * não a primeira formada só por números, que some inteira quando o formulário
 * traz um traço no lugar de um zero ou um valor com separador de milhar.
 */
function linhaDeValores(frags, ancoras) {
  const yTitulos = Math.max(...ancoras.map((a) => a.y));
  const abaixo = frags.filter((f) => f.y > yTitulos + 3 && f.y < yTitulos + 45);

  const linhas = agruparLinhas(abaixo)
    .map((l) => l.itens.filter((f) => ehNumeroDeRefugo(f.texto)))
    .filter((itens) => itens.length >= 2)
    .sort((a, b) => b.length - a.length);

  return linhas[0] || [];
}

/** "0", "11", "1.234" contam; "17/08/2026" e "992 dormentes" não. */
function ehNumeroDeRefugo(texto) {
  return /^\d{1,3}(\.\d{3})*$/.test(String(texto).trim());
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
