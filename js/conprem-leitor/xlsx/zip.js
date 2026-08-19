// Escritor de ZIP mínimo, só com entradas "stored" (sem compressão).
//
// Um .xlsx é um ZIP de XMLs. Como as planilhas geradas aqui têm poucas dezenas
// de KB, não vale a pena arrastar uma biblioteca de compressão: gravar sem
// comprimir é aceito pelo Excel, LibreOffice e Google Sheets, e deixa o projeto
// sem nenhuma dependência de terceiros para a exportação.

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Data/hora no formato MS-DOS usado pelo ZIP. */
function carimbo(d = new Date()) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, data };
}

class Buffer {
  constructor() {
    this.partes = [];
    this.tamanho = 0;
  }
  bytes(b) {
    this.partes.push(b);
    this.tamanho += b.length;
  }
  u16(v) {
    this.bytes(new Uint8Array([v & 0xff, (v >>> 8) & 0xff]));
  }
  u32(v) {
    this.bytes(new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]));
  }
  concatenar() {
    const saida = new Uint8Array(this.tamanho);
    let off = 0;
    for (const p of this.partes) {
      saida.set(p, off);
      off += p.length;
    }
    return saida;
  }
}

/**
 * Monta um ZIP a partir de uma lista de arquivos.
 * @param {Array<{nome: string, conteudo: string|Uint8Array}>} arquivos
 * @returns {Blob}
 */
export function zipar(arquivos, tipoMime = 'application/zip') {
  const enc = new TextEncoder();
  const { hora, data } = carimbo();
  const corpo = new Buffer();
  const central = new Buffer();

  for (const arq of arquivos) {
    const nome = enc.encode(arq.nome);
    const dados = typeof arq.conteudo === 'string' ? enc.encode(arq.conteudo) : arq.conteudo;
    const crc = crc32(dados);
    const offset = corpo.tamanho;

    // --- cabeçalho local ---
    corpo.u32(0x04034b50);
    corpo.u16(20); // versão necessária
    corpo.u16(0x0800); // nomes em UTF-8
    corpo.u16(0); // método 0 = stored
    corpo.u16(hora);
    corpo.u16(data);
    corpo.u32(crc);
    corpo.u32(dados.length);
    corpo.u32(dados.length);
    corpo.u16(nome.length);
    corpo.u16(0);
    corpo.bytes(nome);
    corpo.bytes(dados);

    // --- entrada no diretório central ---
    central.u32(0x02014b50);
    central.u16(20); // versão que criou
    central.u16(20); // versão necessária
    central.u16(0x0800);
    central.u16(0);
    central.u16(hora);
    central.u16(data);
    central.u32(crc);
    central.u32(dados.length);
    central.u32(dados.length);
    central.u16(nome.length);
    central.u16(0); // extra
    central.u16(0); // comentário
    central.u16(0); // disco
    central.u16(0); // atributos internos
    central.u32(0); // atributos externos
    central.u32(offset);
    central.bytes(nome);
  }

  const inicioCentral = corpo.tamanho;
  const bytesCentral = central.concatenar();
  corpo.bytes(bytesCentral);

  // --- fim do diretório central ---
  corpo.u32(0x06054b50);
  corpo.u16(0);
  corpo.u16(0);
  corpo.u16(arquivos.length);
  corpo.u16(arquivos.length);
  corpo.u32(bytesCentral.length);
  corpo.u32(inicioCentral);
  corpo.u16(0);

  return new Blob([corpo.concatenar()], { type: tipoMime });
}
