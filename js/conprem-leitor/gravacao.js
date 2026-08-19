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

/* O PDF da CONPREM traz a descrição comercial do produto, não o projeto do
   sistema. Reconhecemos o que dá; o que não der fica em branco para o usuário
   completar na tela de Produção — melhor vazio do que projeto errado. */
function projetoDoProduto(produto) {
  const k = texto(produto).toUpperCase();
  if (!k) return '';
  if (k.includes('FERRO NORTE') || /\bFN\b/.test(k)) return 'FERRO NORTE';
  if (k.includes('FMT')) return 'FMT';
  if (k.includes('MALHA CENTRAL')) return 'MALHA CENTRAL';
  if (k.includes('MISTA')) return 'MALHA PAULISTA BITOLA MISTA';
  if (k.includes('LARGA')) return 'MALHA PAULISTA BITOLA LARGA';
  return '';
}

function bitolaDoTexto(...partes) {
  const k = partes.map(texto).join(' ').toUpperCase();
  if (k.includes('MISTA')) return 'Bitola Mista';
  if (k.includes('LARGA')) return 'Bitola Larga';
  return 'Sem bitola definida';
}

function resultadoEnsaio(v) {
  const k = texto(v).toUpperCase();
  if (k.includes('APROV')) return 'Aprovado';
  if (k.includes('REPROV') || k.includes('RECUS')) return 'Reprovado';
  return 'Pendente';
}

/* ------------------------------------------------------- mapeamentos */

function linhasProducao(linhas) {
  return linhas
    .filter((l) => texto(l.lote))
    .map((l) => {
      const { ano, semana } = semanaAno(l.semana);
      const projeto = projetoDoProduto(l.produto);
      return {
        chave: `${texto(l.lote)}|${dataIso(l.dataFabricacao) || ''}`,
        registro: {
          fornecedor: FORNECEDOR,
          lote: texto(l.lote),
          pedido: texto(l.pedido) || null,
          projeto: projeto || null,
          bitola: bitolaDoTexto(l.produto, projeto),
          tipo_dormente: texto(l.produto) || null,
          total_produzido: inteiro(l.qtdDormentes),
          data_fabricacao: dataIso(l.dataFabricacao),
          serie: texto(l.serieConcreto) || null,
          lote_ombreira: texto(l.ombreiraLote) || null,
          semana,
          ano,
        },
      };
    });
}

function linhasEnsaios(linhas) {
  return linhas
    .filter((l) => texto(l.lote))
    .map((l) => {
      const { ano, semana } = semanaAno(l.semana);
      const projeto = projetoDoProduto(l.bitola);
      return {
        chave: `${texto(l.lote)}|${dataIso(l.dataEnsaio) || ''}`,
        registro: {
          fornecedor: FORNECEDOR,
          projeto: projeto || null,
          bitola: bitolaDoTexto(l.bitola),
          lote_ensaiado: texto(l.lote),
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

function linhasReprovados(linhas) {
  const saida = [];
  for (const l of linhas) {
    const { ano, semana } = semanaAno(l.semana);
    const inicio = dataIso(l.periodoInicio);
    const fim = dataIso(l.periodoFim);
    const projeto = projetoDoProduto(l.produto);

    for (const [chave, motivo] of REFUGOS) {
      const qtd = inteiro(l[chave]);
      if (!qtd || qtd <= 0) continue;
      saida.push({
        chave: `${ano}-${semana}|${motivo}`,
        registro: {
          fornecedor: FORNECEDOR,
          projeto: projeto || null,
          bitola: bitolaDoTexto(l.produto, projeto),
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
    chaveExistente: (r) => `${r.ano}-${r.semana}|${texto(r.motivo_indicador)}`,
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
 * Grava uma aba. Devolve o que entrou, o que já existia e o que falhou.
 * @param {string} id            id do modelo (rastreabilidade | ensaios | resumo)
 * @param {Array<Object>} linhas linhas extraídas do PDF
 */
export async function gravarAba(id, linhas) {
  const destino = destinoDe(id);
  if (!destino) throw new Error(`Destino desconhecido para "${id}".`);

  const candidatos = destino.mapear(linhas || []);
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
