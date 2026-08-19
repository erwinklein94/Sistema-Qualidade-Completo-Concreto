// Gravação opcional do que o leitor extraiu nas tabelas da área Conprem.
//
// No repositório de origem o leitor não guardava nada: lia o PDF, gerava o
// Excel e esquecia. Aqui o Excel continua sendo o caminho padrão e a gravação
// é uma escolha explícita do usuário, aba por aba, feita só quando ele clica.
//
// Nada é sobrescrito: registro que já existe é contado como "já estava lá" e
// deixado como está. Assim reimportar o mesmo PDF é inofensivo.

import { MODELOS } from './schema.js';

const FORNECEDOR = 'Conprem MG';

/* ------------------------------------------------------------ utilidades */

function texto(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function inteiro(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

/** Data do Excel (objeto Date em UTC) para o `date` do Postgres. */
function dataIso(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = texto(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
}

/** "2026-S33" -> { ano: 2026, semana: 33 } */
function semanaAno(v) {
  const m = texto(v).match(/(\d{4})\D+(\d{1,2})/);
  return m ? { ano: Number(m[1]), semana: Number(m[2]) } : { ano: null, semana: null };
}

/* O PDF da CONPREM traz a descrição comercial do produto e o destino da carga
   ("DORMENTE MONOBLOCO PROTENDIDO - BIT 1600 ...", "CHAPADÃO DO SUL MS"), não o
   nome do projeto como o sistema o conhece. Quando o nome aparece, aproveitamos;
   quando não, quem diz é o usuário, no campo Projeto da tela — o banco exige
   projeto e chutar um seria pior do que perguntar. */
export function projetoDoProduto(produto) {
  const k = texto(produto).toUpperCase();
  if (!k) return '';
  if (k.includes('FERRO NORTE') || /\bFN\b/.test(k)) return 'FERRO NORTE';
  if (k.includes('FMT')) return 'FMT';
  if (k.includes('MALHA CENTRAL')) return 'MALHA CENTRAL';
  if (k.includes('MALHA PAULISTA') && k.includes('MISTA')) return 'MALHA PAULISTA BITOLA MISTA';
  if (k.includes('MALHA PAULISTA') && k.includes('LARGA')) return 'MALHA PAULISTA BITOLA LARGA';
  return '';
}

/* A bitola vem escrita de duas formas nos relatórios: por extenso no Resumo
   Semanal ("BIT LARGA") e em milímetros na Rastreabilidade ("BIT 1600"). */
export function bitolaDoTexto(...partes) {
  const k = partes.map(texto).join(' ').toUpperCase();
  if (k.includes('MISTA')) return 'Bitola Mista';
  if (k.includes('LARGA')) return 'Bitola Larga';
  if (/BIT\.?\s*1[.\s]?600/.test(k)) return 'Bitola Larga';
  if (/BIT\.?\s*1[.\s]?000/.test(k)) return 'Bitola Mista';
  return 'Sem bitola definida';
}

function resultadoEnsaio(v) {
  const k = texto(v).toUpperCase();
  if (k.includes('APROV')) return 'Aprovado';
  if (k.includes('REPROV') || k.includes('RECUS')) return 'Reprovado';
  return 'Pendente';
}

/* ------------------------------------------------------- mapeamentos */

/* Colunas do Mapa de Rastreabilidade que vão direto para a Produção, uma a uma.
   A lista espelha CAMPOS_RASTREABILIDADE de js/producao.js — é a mesma tela que
   exibe e edita esses campos depois. [chave no PDF, coluna no Supabase] */
const RASTREABILIDADE_PARA_PRODUCAO = [
  ['ordemFabricacao', 'ordem_fabricacao'],
  ['cliente', 'cliente'],
  ['produto', 'produto'],
  ['serieConcreto', 'serie_concreto'],
  ['acoSeqNf', 'aco_seq_nf'],
  ['acoCertInterno', 'aco_cert_interno'],
  ['acoCertExterno', 'aco_cert_externo'],
  ['cimentoSeqNf', 'cimento_seq_nf'],
  ['cimentoCertInterno', 'cimento_cert_interno'],
  ['cimentoCertExterno', 'cimento_cert_externo'],
  ['areiaSeqNf', 'areia_seq_nf'],
  ['areiaCertInterno', 'areia_cert_interno'],
  ['areiaCertExterno', 'areia_cert_externo'],
  ['britaSeqNf', 'brita_seq_nf'],
  ['britaCertInterno', 'brita_cert_interno'],
  ['britaCertExterno', 'brita_cert_externo'],
  ['aditivoSeqNf', 'aditivo_seq_nf'],
  ['aditivoCertExterno', 'aditivo_cert_externo'],
  ['adicaoSeqNf', 'adicao_seq_nf'],
  ['adicaoCertExterno', 'adicao_cert_externo'],
  ['grampo', 'grampo'],
  ['isoladorFrontal', 'isolador_frontal'],
  ['isoladorLateral', 'isolador_lateral'],
  ['palmilhaTrilho', 'palmilha_trilho'],
  ['palmilhaUsp', 'palmilha_usp'],
  ['observacoes', 'observacoes'],
];

function linhasProducao(linhas, ctx) {
  return linhas
    .filter((l) => texto(l.lote))
    .map((l) => {
      const { ano, semana } = semanaAno(l.semana);
      const rastreabilidade = Object.fromEntries(
        RASTREABILIDADE_PARA_PRODUCAO.map(([chave, coluna]) => [coluna, texto(l[chave]) || null]),
      );
      return {
        chave: `${texto(l.lote)}|${dataIso(l.dataFabricacao) || ''}`,
        registro: {
          ...rastreabilidade,
          fornecedor: FORNECEDOR,
          lote: texto(l.lote),
          pedido: texto(l.pedido) || null,
          projeto: ctx.projeto,
          bitola: bitolaDoTexto(l.produto, ctx.projeto),
          // A descrição comercial completa fica no campo Produto. "Tipo" é a
          // lista curta do sistema (Bitola Mista, Contra Trilho...) e não
          // recebe o texto do PDF para não sujar o filtro da tela.
          total_produzido: inteiro(l.qtdDormentes),
          data_fabricacao: dataIso(l.dataFabricacao),
          lote_ombreira: texto(l.ombreiraLote) || null,
          semana,
          ano,
        },
      };
    });
}

function linhasEnsaios(linhas, ctx) {
  // A série do lote está no Mapa de Rastreabilidade, não no PDF de ensaio.
  // Quando os dois vêm no mesmo lote de arquivos, cruzamos pelo número do lote;
  // sem o mapa, o próprio lote responde pela série — é como a CONPREM trabalha,
  // um ensaio por lote, sem o agrupamento em séries que a Cavan usa.
  // A bitola tem o mesmo problema: no PDF de ensaio a coluna vem "-", e quem
  // diz o produto é o mapa de rastreabilidade.
  const serieDoLote = new Map();
  const bitolaDoLote = new Map();
  for (const r of ctx.rastreabilidade || []) {
    const lote = texto(r.lote);
    if (!lote) continue;
    serieDoLote.set(lote, texto(r.serieConcreto) || lote);
    bitolaDoLote.set(lote, bitolaDoTexto(r.produto, ctx.projeto));
  }

  return linhas
    .filter((l) => texto(l.lote))
    .map((l) => {
      const { ano, semana } = semanaAno(l.semana);
      const lote = texto(l.lote);
      return {
        chave: `${lote}|${dataIso(l.dataEnsaio) || ''}`,
        registro: {
          fornecedor: FORNECEDOR,
          projeto: ctx.projeto,
          bitola: bitolaDoLote.get(lote) || bitolaDoTexto(l.bitola, ctx.projeto),
          lote_ensaiado: lote,
          serie_liberada: serieDoLote.get(lote) || lote,
          data_ensaio: dataIso(l.dataEnsaio),
          resultado: resultadoEnsaio(l.resultadoGeral),
          responsavel: texto(l.executor) || texto(l.fiscalizacao) || null,
          semana,
          ano,
          observacoes: [
            'Importado do PDF de Ensaio de Dormentes da CONPREM pelo Leitor de Recebidos.',
            texto(l.turno) && `Turno: ${texto(l.turno)}`,
            texto(l.molde) && `Molde: ${texto(l.molde)}`,
            texto(l.observacoes),
          ].filter(Boolean).join(' · '),
        },
      };
    });
}

/* Cada tipo de refugo do Resumo Semanal vira uma linha de reprovados, no mesmo
   vocabulário de motivo que a tela de Dormentes Reprovados já usa. */
const REFUGOS = [
  ['fissuras', 'Trincas'],
  ['vazios', 'Vazios'],
  ['ombreiras', 'Ombreiras'],
  ['quebras', 'Quebras'],
  ['usp', 'USP'],
  ['falhasFabricacao', 'Falha Operacional'],
  ['outros', 'Outros'],
];

function linhasReprovados(linhas, ctx) {
  const saida = [];
  for (const l of linhas) {
    const { ano, semana } = semanaAno(l.semana);
    const inicio = dataIso(l.periodoInicio);
    const fim = dataIso(l.periodoFim);
    // O Resumo Semanal conta refugo da semana inteira, não de um lote — mas a
    // tabela de reprovados exige lote. Gravamos a semana no lugar, escrito de
    // forma que ninguém confunda com número de lote de verdade.
    const lote = `Semana ${texto(l.semana) || `${ano}-S${semana}`}`;

    for (const [chave, motivo] of REFUGOS) {
      const qtd = inteiro(l[chave]);
      if (!qtd || qtd <= 0) continue;
      saida.push({
        chave: `${lote}|${motivo}`,
        registro: {
          fornecedor: FORNECEDOR,
          lote,
          projeto: ctx.projeto,
          bitola: bitolaDoTexto(l.produto, ctx.projeto),
          data_producao: fim || inicio,
          periodo_inicio: inicio,
          periodo_fim: fim,
          semana,
          ano,
          motivo_indicador: motivo,
          motivo_detalhado: `Resumo Semanal CONPREM — ${motivo}`,
          total_refugos: qtd,
        },
      });
    }
  }
  return saida;
}

/* ------------------------------------------------------------- destinos */

export const DESTINOS = [
  {
    id: 'rastreabilidade',
    titulo: 'Produção de Dormentes',
    detalhe: 'Cada lote do Mapa de Rastreabilidade vira um lote na Produção da Conprem.',
    mapear: linhasProducao,
    listar: () => StoreSupabase.listarProducao({ limite: 10000 }),
    chaveExistente: (r) => `${texto(r.lote)}|${texto(r.data_fabricacao).slice(0, 10)}`,
    salvar: (registro) => StoreSupabase.salvarProducao(registro),
  },
  {
    id: 'ensaios',
    titulo: 'Ensaios de Liberação',
    detalhe: 'Cada lote ensaiado vira um ensaio de liberação com o resultado geral do PDF.',
    mapear: linhasEnsaios,
    listar: () => StoreSupabase.listarEnsaiosLiberacao({ limite: 10000 }),
    chaveExistente: (r) => `${texto(r.lote_ensaiado)}|${texto(r.data_ensaio).slice(0, 10)}`,
    salvar: (registro) => StoreSupabase.salvarEnsaioLiberacao(registro),
  },
  {
    id: 'resumo',
    titulo: 'Dormentes Reprovados',
    detalhe: 'Os refugos do Resumo Semanal viram uma linha por motivo, com a quantidade da semana.',
    mapear: linhasReprovados,
    listar: () => StoreSupabase.listarReprovados({ limite: 10000 }),
    chaveExistente: (r) => `${texto(r.lote)}|${texto(r.motivo_indicador)}`,
    salvar: (registro) => StoreSupabase.salvarReprovado(registro),
  },
];

export function destinoDe(id) {
  return DESTINOS.find((d) => d.id === id) || null;
}

export function rotuloAba(id) {
  return MODELOS[id]?.aba || id;
}

/**
 * Sugere o projeto a partir do que os PDFs trazem escrito. Vazio quando não dá
 * para reconhecer — aí quem escolhe é o usuário.
 * @param {Record<string, Array<Object>>} resultados
 */
export function projetoSugerido(resultados = {}) {
  const textos = [
    ...(resultados.rastreabilidade || []).map((l) => l.produto),
    ...(resultados.resumo || []).map((l) => `${l.produto} ${l.pedidoLocal}`),
  ];
  for (const t of textos) {
    const p = projetoDoProduto(t);
    if (p) return p;
  }
  return '';
}

/**
 * Grava uma aba. Devolve o que entrou, o que já existia e o que falhou.
 * @param {string} id id do modelo (rastreabilidade | ensaios | resumo)
 * @param {Record<string, Array<Object>>} resultados todas as abas lidas — a de
 *        ensaios precisa da de rastreabilidade para achar a série do lote
 * @param {{projeto: string}} opcoes projeto escolhido na tela (obrigatório: as
 *        três tabelas de destino exigem projeto e ele não vem nos PDFs)
 */
export async function gravarAba(id, resultados = {}, opcoes = {}) {
  const destino = destinoDe(id);
  if (!destino) throw new Error(`Destino desconhecido para "${id}".`);

  const projeto = texto(opcoes.projeto);
  if (!projeto) throw new Error('Escolha o projeto antes de gravar: as telas de destino exigem esse campo.');

  const ctx = { projeto, rastreabilidade: resultados.rastreabilidade || [] };
  const candidatos = destino.mapear(resultados[id] || [], ctx);
  if (!candidatos.length) return { id, titulo: destino.titulo, gravados: 0, repetidos: 0, erros: [] };

  const existentes = new Set((await destino.listar()).map(destino.chaveExistente));

  let gravados = 0;
  let repetidos = 0;
  const erros = [];

  for (const item of candidatos) {
    if (existentes.has(item.chave)) { repetidos += 1; continue; }
    try {
      await destino.salvar(item.registro);
      existentes.add(item.chave);
      gravados += 1;
    } catch (err) {
      erros.push(`${item.chave.split('|')[0]}: ${err.message || err}`);
    }
  }

  return { id, titulo: destino.titulo, gravados, repetidos, erros };
}
