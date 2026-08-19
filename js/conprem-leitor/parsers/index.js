// Identificação do modelo de PDF e orquestração da leitura.
//
// Os três formulários chegam juntos toda semana, então vale processá-los como
// um conjunto: o Resumo Semanal informa a semana e o pedido, o Mapa de
// Rastreabilidade informa pedido/cliente, e o Ensaio de Dormentes — que não
// traz o número do pedido impresso — aproveita esse contexto.

import { lerArquivo } from '../core/pdf.js';
import { semanaIso, textoDe } from '../core/grid.js';
import * as rastreabilidade from './rastreabilidade.js';
import * as ensaios from './ensaios.js';
import * as resumo from './resumo.js';

/** Ordem de processamento: quem produz contexto vem antes de quem consome. */
const PARSERS = [resumo, rastreabilidade, ensaios];

/** Semana ISO de hoje, usada como padrão quando não há Resumo Semanal no lote. */
export function semanaAtual() {
  return semanaIso(new Date());
}

function textoBruto(doc) {
  return doc.paginas.map((p) => textoDe(p.fragmentos)).join('\n');
}

/**
 * Lê um conjunto de arquivos PDF e devolve as linhas por modelo.
 * @param {File[]} arquivos
 * @param {{semana?: string}} opcoes
 */
export async function processar(arquivos, opcoes = {}) {
  const lidos = [];
  const avisos = [];

  for (const arquivo of arquivos) {
    try {
      const doc = await lerArquivo(arquivo);
      const texto = textoBruto(doc);
      const parser = PARSERS.find((p) => p.detectar(texto));
      if (!parser) {
        avisos.push(`"${arquivo.name}" não corresponde a nenhum dos 3 modelos conhecidos.`);
        continue;
      }
      lidos.push({ arquivo, doc, parser });
    } catch (erro) {
      avisos.push(`Falha ao ler "${arquivo.name}": ${erro.message}`);
    }
  }

  // processa na ordem dos parsers, não na ordem em que o usuário soltou
  lidos.sort((a, b) => PARSERS.indexOf(a.parser) - PARSERS.indexOf(b.parser));

  const resultados = {};
  const origens = {};
  let contexto = { semana: opcoes.semana || semanaAtual() };
  let semanaDetectada = '';

  for (const { arquivo, doc, parser } of lidos) {
    try {
      const saida = parser.extrair(doc, contexto);
      if (parser.id === 'resumo' && saida.linhas[0]?.semana) {
        semanaDetectada = saida.linhas[0].semana;
        // sem semana escolhida à mão, o Resumo define a semana das outras abas
        if (!opcoes.semana) contexto.semana = semanaDetectada;
      }
      contexto = { ...contexto, ...limparVazios(saida.contexto) };

      resultados[parser.id] = (resultados[parser.id] || []).concat(saida.linhas);
      origens[parser.id] = (origens[parser.id] || []).concat(arquivo.name);

      // O parser avisa o que leu com dúvida — número que não ficou sob nenhuma
      // coluna, total que não fecha com o detalhamento. Some ao mesmo lugar dos
      // erros de leitura para o usuário ver antes de mandar gravar.
      for (const aviso of saida.avisos || []) avisos.push(`"${arquivo.name}": ${aviso}`);

      if (!saida.linhas.length) {
        avisos.push(`"${arquivo.name}" foi reconhecido, mas nenhuma linha foi extraída.`);
      }
    } catch (erro) {
      avisos.push(`Erro ao interpretar "${arquivo.name}": ${erro.message}`);
    }
  }

  // A semana só é conhecida depois de ler o Resumo; as abas processadas antes
  // dele (nenhuma, hoje) e as linhas sem semana recebem o valor final.
  for (const id of Object.keys(resultados)) {
    if (id === 'resumo') continue;
    for (const linha of resultados[id]) {
      if (!linha.semana) linha.semana = contexto.semana;
    }
  }

  return { resultados, origens, avisos, semanaDetectada, semana: contexto.semana };
}

function limparVazios(obj = {}) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));
}
