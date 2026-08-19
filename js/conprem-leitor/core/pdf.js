// Extração de texto posicionado a partir de um PDF, via pdf.js.
//
// Os formulários da CONPREM usam células mescladas e blocos flutuantes: o texto
// linear (tipo `pdftotext`) perde o alinhamento entre rótulo e valor. Por isso
// trabalhamos sempre com as coordenadas de cada fragmento e reconstruímos a
// tabela geometricamente em `grid.js`.

import * as pdfjs from '../../../vendor/pdfjs/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  '../../../vendor/pdfjs/pdf.worker.min.mjs',
  import.meta.url,
).href;

/**
 * @typedef {Object} Fragmento
 * @property {string} texto   conteúdo já normalizado (sem espaços duplicados)
 * @property {number} x       borda esquerda, em pontos, origem no canto sup. esq.
 * @property {number} y       linha de base, crescendo para baixo
 * @property {number} w       largura ocupada
 * @property {number} alt     altura da fonte
 * @property {number} pagina  1-based
 */

/**
 * @typedef {Object} Pagina
 * @property {number} numero
 * @property {number} largura
 * @property {number} altura
 * @property {Fragmento[]} fragmentos
 */

/** Descarta fragmentos que são só espaço em branco e normaliza o conteúdo. */
function normalizar(texto) {
  return texto.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Lê um PDF inteiro e devolve os fragmentos de texto com posição.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{paginas: Pagina[], fragmentos: Fragmento[]}>}
 */
export async function lerPdf(buffer) {
  const doc = await pdfjs.getDocument({
    data: buffer,
    // Os formulários são gerados por Excel/Word e não trazem fontes exóticas;
    // desligar o carregamento externo evita depender de rede.
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;

  const paginas = [];
  const fragmentos = [];

  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const viewport = pagina.getViewport({ scale: 1 });
      const conteudo = await pagina.getTextContent();
      const daPagina = [];

      for (const item of conteudo.items) {
        if (typeof item.str !== 'string') continue;
        const texto = normalizar(item.str);
        if (!texto) continue;

        // `viewport.transform` converte do espaço do PDF (origem embaixo) para
        // o espaço de tela (origem no topo), já respeitando rotação de página.
        const m = pdfjs.Util.transform(viewport.transform, item.transform);
        const alt = Math.hypot(m[2], m[3]) || item.height || 0;

        const frag = {
          texto,
          x: m[4],
          y: m[5],
          // `item.width` já vem no espaço da viewport em escala 1 — multiplicar
          // pela escala do transform contaria o tamanho da fonte duas vezes.
          w: item.width || 0,
          alt,
          pagina: n,
        };
        daPagina.push(frag);
        fragmentos.push(frag);
      }

      paginas.push({
        numero: n,
        largura: viewport.width,
        altura: viewport.height,
        fragmentos: daPagina,
      });
      pagina.cleanup();
    }
  } finally {
    await doc.destroy();
  }

  return { paginas, fragmentos };
}

/** Lê um `File` do input/dropzone. */
export async function lerArquivo(file) {
  return lerPdf(await file.arrayBuffer());
}
