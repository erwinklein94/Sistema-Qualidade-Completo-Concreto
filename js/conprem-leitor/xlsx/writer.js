// Geração do arquivo .xlsx (SpreadsheetML) sem biblioteca externa.
//
// O objetivo é um arquivo que abra limpo no Excel e cujo conteúdo possa ser
// selecionado e colado direto na planilha de controle. Por isso:
//   - as colunas saem exatamente na ordem de `schema.js`;
//   - Seq./NF e certificados são gravados como TEXTO, para não perder zeros
//     à esquerda nem virar data ("031/26");
//   - datas são datas de verdade do Excel, formatadas dd/mm/aaaa.

import { zipar } from './zip.js';

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Índices dos estilos declarados em `estilosXml()`.
const ESTILO = { padrao: 0, cabecalho: 1, data: 2, texto: 3 };

// Escapa para XML e descarta caracteres de controle, que são inválidos em
// XML 1.0 e fariam o Excel recusar o arquivo. Feito sem regex para não
// depender de escapes literais de bytes de controle no código-fonte.
function esc(s) {
  let saida = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) continue;
    if (ch === '&') saida += '&amp;';
    else if (ch === '<') saida += '&lt;';
    else if (ch === '>') saida += '&gt;';
    else if (ch === '"') saida += '&quot;';
    else saida += ch;
  }
  return saida;
}

/** Converte índice 0-based em referência de coluna do Excel (0 -> A, 26 -> AA). */
function letraColuna(i) {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Número de série do Excel (base 1899-12-30, em UTC). */
function serialData(d) {
  return (d.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
}

function celula(ref, valor, tipo) {
  if (valor === null || valor === undefined || valor === '') return '';

  if (tipo === 'data' && valor instanceof Date) {
    return `<c r="${ref}" s="${ESTILO.data}"><v>${serialData(valor)}</v></c>`;
  }
  if (tipo === 'numero') {
    const n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
    if (!Number.isFinite(n)) return '';
    return `<c r="${ref}" s="${ESTILO.padrao}"><v>${n}</v></c>`;
  }
  // texto: inlineStr evita a tabela de strings compartilhadas e mantém o
  // conteúdo literal (zeros à esquerda, barras, ponto e vírgula)
  return `<c r="${ref}" s="${ESTILO.texto}" t="inlineStr"><is><t xml:space="preserve">${esc(valor)}</t></is></c>`;
}

function planilhaXml(colunas, linhas) {
  const larguras = colunas
    .map((c, i) => {
      const base = Math.max(c.titulo.length + 3, 10);
      return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(base, 34)}" customWidth="1"/>`;
    })
    .join('');

  const cabecalho = colunas
    .map((c, i) => {
      const ref = `${letraColuna(i)}1`;
      return `<c r="${ref}" s="${ESTILO.cabecalho}" t="inlineStr"><is><t>${esc(c.titulo)}</t></is></c>`;
    })
    .join('');

  const corpo = linhas
    .map((linha, r) => {
      const n = r + 2;
      const cels = colunas
        .map((c, i) => celula(`${letraColuna(i)}${n}`, linha[c.chave], c.tipo))
        .join('');
      return `<row r="${n}">${cels}</row>`;
    })
    .join('');

  const ultima = `${letraColuna(colunas.length - 1)}${linhas.length + 1}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${larguras}</cols>
<sheetData><row r="1" ht="30" customHeight="1">${cabecalho}</row>${corpo}</sheetData>
<autoFilter ref="A1:${ultima}"/>
</worksheet>`;
}

function estilosXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF003865"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`;
}

/**
 * Gera o .xlsx.
 * @param {Array<{aba: string, colunas: Array, linhas: Array}>} abas
 * @returns {Blob}
 */
export function gerarXlsx(abas) {
  if (!abas.length) throw new Error('Nenhuma aba para exportar.');

  const arquivos = [];

  const tiposConteudo = abas
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('');

  arquivos.push({
    nome: '[Content_Types].xml',
    conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${tiposConteudo}
</Types>`,
  });

  arquivos.push({
    nome: '_rels/.rels',
    conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  });

  const abasXml = abas
    .map((a, i) => `<sheet name="${esc(a.aba)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');

  arquivos.push({
    nome: 'xl/workbook.xml',
    conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${abasXml}</sheets>
</workbook>`,
  });

  const relsAbas = abas
    .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join('');

  arquivos.push({
    nome: 'xl/_rels/workbook.xml.rels',
    conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relsAbas}
<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  });

  arquivos.push({ nome: 'xl/styles.xml', conteudo: estilosXml() });

  abas.forEach((a, i) => {
    arquivos.push({
      nome: `xl/worksheets/sheet${i + 1}.xml`,
      conteudo: planilhaXml(a.colunas, a.linhas),
    });
  });

  return zipar(arquivos, MIME_XLSX);
}
