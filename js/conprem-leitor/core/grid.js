// Utilidades geométricas para remontar tabelas a partir de fragmentos soltos.
//
// A ideia é sempre a mesma: agrupar fragmentos por proximidade vertical para
// formar linhas, e por sobreposição horizontal para decidir a qual coluna cada
// valor pertence. Isso sobrevive a células mescladas e a quebras de linha
// dentro da célula, que é onde a extração linear falha.

/** Centro horizontal de um fragmento. */
export const centroX = (f) => f.x + f.w / 2;

/** Fim horizontal de um fragmento. */
export const fimX = (f) => f.x + f.w;

/**
 * Agrupa fragmentos em linhas visuais.
 * @param {Array} frags
 * @param {number} tol tolerância vertical em pontos (padrão: meia altura de fonte)
 * @returns {Array<{y:number, itens:Array}>}
 */
export function agruparLinhas(frags, tol = 3.2) {
  const ordenados = [...frags].sort((a, b) => a.y - b.y || a.x - b.x);
  const linhas = [];

  for (const f of ordenados) {
    const ultima = linhas[linhas.length - 1];
    if (ultima && Math.abs(f.y - ultima.y) <= tol) {
      ultima.itens.push(f);
      // média corrida evita que a linha "escorregue" com fragmentos oblíquos
      ultima.y = (ultima.y * (ultima.itens.length - 1) + f.y) / ultima.itens.length;
    } else {
      linhas.push({ y: f.y, itens: [f] });
    }
  }

  for (const l of linhas) l.itens.sort((a, b) => a.x - b.x);
  return linhas;
}

/** Concatena o texto de uma lista de fragmentos, da esquerda para a direita. */
export function textoDe(itens) {
  return [...itens]
    .sort((a, b) => a.x - b.x)
    .map((f) => f.texto)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Primeiro fragmento cujo texto casa com o padrão. */
export function achar(frags, padrao) {
  const re = padrao instanceof RegExp ? padrao : new RegExp(escaparRe(padrao), 'i');
  return frags.find((f) => re.test(f.texto)) || null;
}

/** Todos os fragmentos cujo texto casa com o padrão. */
export function acharTodos(frags, padrao) {
  const re = padrao instanceof RegExp ? padrao : new RegExp(escaparRe(padrao), 'i');
  return frags.filter((f) => re.test(f.texto));
}

export function escaparRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Fragmentos contidos numa janela retangular. */
export function naJanela(frags, { x0 = -Infinity, x1 = Infinity, y0 = -Infinity, y1 = Infinity }) {
  return frags.filter((f) => {
    const cx = centroX(f);
    return cx >= x0 && cx <= x1 && f.y >= y0 && f.y <= y1;
  });
}

/**
 * Valor à direita de um rótulo, na mesma linha.
 * @param {Array} frags universo de busca (idealmente só a página do rótulo)
 * @param {Object} rotulo fragmento do rótulo
 * @param {number} tolY tolerância vertical
 */
export function valorAoLado(frags, rotulo, tolY = 4, limiteX = Infinity) {
  if (!rotulo) return '';
  const candidatos = frags.filter(
    (f) =>
      f !== rotulo &&
      f.pagina === rotulo.pagina &&
      Math.abs(f.y - rotulo.y) <= tolY &&
      f.x >= fimX(rotulo) - 1 &&
      f.x < limiteX,
  );
  return textoDe(candidatos);
}

/**
 * Alinha valores a cabeçalhos pela sobreposição horizontal.
 * Para cada cabeçalho, devolve os fragmentos da janela `y` cujo centro cai mais
 * perto dele do que de qualquer outro cabeçalho.
 * @param {Array} cabecalhos fragmentos usados como âncora de coluna
 * @param {Array} valores fragmentos a distribuir
 * @returns {Map<Object, Array>} cabeçalho -> fragmentos
 */
export function distribuirPorColuna(cabecalhos, valores) {
  const mapa = new Map(cabecalhos.map((c) => [c, []]));
  if (!cabecalhos.length) return mapa;

  for (const v of valores) {
    const cx = centroX(v);
    let melhor = null;
    let menor = Infinity;
    for (const c of cabecalhos) {
      const d = Math.abs(cx - centroX(c));
      if (d < menor) {
        menor = d;
        melhor = c;
      }
    }
    if (melhor) mapa.get(melhor).push(v);
  }

  for (const lista of mapa.values()) lista.sort((a, b) => a.y - b.y || a.x - b.x);
  return mapa;
}

/**
 * Converte número em formato brasileiro ("2.604", "1,26") para Number.
 * Devolve null se não houver dígito.
 */
export function numeroBr(s) {
  if (typeof s === 'number') return s;
  if (!s) return null;
  const limpo = String(s).replace(/[^\d.,-]/g, '');
  if (!/\d/.test(limpo)) return null;
  // "2.604,5" -> ponto é milhar; "1,26" -> vírgula é decimal
  const normal = limpo.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** Converte "29/07/2026" (ou "29/07/26") para Date, senão null. */
export function dataBr(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const [, d, mes, a] = m;
  const ano = a.length === 2 ? 2000 + Number(a) : Number(a);
  const dt = new Date(Date.UTC(ano, Number(mes) - 1, Number(d)));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Semana ISO no formato usado na planilha: "2026-S33". */
export function semanaIso(data) {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  // quinta-feira da mesma semana define o ano ISO
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const ano = d.getUTCFullYear();
  const inicio = new Date(Date.UTC(ano, 0, 1));
  const semana = Math.ceil(((d - inicio) / 86400000 + 1) / 7);
  return `${ano}-S${String(semana).padStart(2, '0')}`;
}

/** Junta valores repetidos preservando ordem e descartando vazios/duplicatas. */
export function juntarUnicos(valores, sep = '; ') {
  const vistos = new Set();
  const saida = [];
  for (const v of valores) {
    const t = String(v ?? '').trim();
    if (!t || vistos.has(t)) continue;
    vistos.add(t);
    saida.push(t);
  }
  return saida.join(sep);
}
