// Leitor de Recebidos CONPREM — ponto de entrada da página do sistema.
//
// Os parsers, o grid de coordenadas e o gerador de xlsx vieram do repositório
// Leitor-Recebidos-Conprem sem alteração. O que muda aqui é a moldura: a tela
// roda dentro do sistema (login, menu, tema) e ganhou a opção de gravar o que
// foi lido nas tabelas da área Conprem — antes o leitor não guardava nada.
//
// A leitura dos PDFs continua 100% no navegador: nenhum arquivo sai daqui.
// Só vai para o Supabase o que o usuário mandar gravar, e só as linhas já
// extraídas — nunca o PDF.

import { processar, semanaAtual } from './parsers/index.js';
import { MODELOS, ORDEM_MODELOS } from './schema.js';
import { gerarXlsx } from './xlsx/writer.js';
import { desenharArquivos, iniciarDropzone } from './ui/dropzone.js';
import { desenharAvisos, desenharResultados } from './ui/resultados.js';
import { DESTINOS, gravarAba } from './gravacao.js';

const el = (id) => document.getElementById(id);

const refs = {
  dropzone: el('dropzone'),
  entrada: el('entrada-arquivos'),
  lista: el('lista-arquivos'),
  semana: el('campo-semana'),
  limpar: el('botao-limpar'),
  exportar: el('botao-exportar'),
  avisos: el('avisos'),
  secao: el('secao-resultados'),
  abas: el('abas'),
  painel: el('painel-resultado'),
  resumo: el('resumo-geral'),
  secaoGravacao: el('secao-gravacao'),
  opcoesGravacao: el('opcoes-gravacao'),
  botaoGravar: el('botao-gravar'),
  retornoGravacao: el('retorno-gravacao'),
};

const estado = {
  arquivos: [],
  resultados: {},
  origens: {},
  avisos: [],
  semanaManual: false,
  processando: false,
  gravando: false,
};

refs.semana.value = semanaAtual();

// ------------------------------------------------------------ interface

function totalLinhas(id) {
  return (estado.resultados[id] || []).length;
}

function temAlgumaLinha() {
  return ORDEM_MODELOS.some((id) => totalLinhas(id) > 0);
}

function atualizarBotoes() {
  const ocupado = estado.processando || estado.gravando;
  refs.exportar.disabled = !temAlgumaLinha() || ocupado;
  refs.limpar.disabled = !estado.arquivos.length || ocupado;
  refs.botaoGravar.disabled = ocupado || !abasMarcadas().length || !podeGravar();
}

function podeGravar() {
  return !!(window.Auth && Auth.pode && Auth.pode('criar'));
}

function marcarProcessando(ligado) {
  estado.processando = ligado;
  refs.dropzone.setAttribute('aria-busy', String(ligado));
  atualizarBotoes();
  if (ligado) refs.avisos.replaceChildren(criarCarregando('Lendo os PDFs…'));
}

function criarCarregando(mensagem) {
  const span = document.createElement('span');
  span.className = 'carregando';
  const girador = document.createElement('span');
  girador.className = 'girador';
  span.append(girador, document.createTextNode(mensagem));
  return span;
}

/** Marca cada arquivo com o modelo a que pertence, para a lista da interface. */
function rotularArquivos() {
  const porNome = new Map();
  for (const id of ORDEM_MODELOS) {
    for (const nome of estado.origens[id] || []) porNome.set(nome, MODELOS[id].aba);
  }
  for (const item of estado.arquivos) {
    item.modelo = porNome.get(item.arquivo.name) || '';
    item.erro = !item.modelo;
  }
}

function redesenhar() {
  desenharArquivos(refs.lista, estado.arquivos, removerArquivo);
  desenharResultados(refs, estado.resultados, estado.origens);
  desenharAvisos(refs.avisos, estado.avisos);
  desenharGravacao();
  atualizarBotoes();
}

// ------------------------------------------------------------ gravação

function abasMarcadas() {
  return [...refs.opcoesGravacao.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value);
}

function desenharGravacao() {
  refs.secaoGravacao.hidden = !temAlgumaLinha();
  refs.opcoesGravacao.replaceChildren();

  for (const destino of DESTINOS) {
    const linhas = totalLinhas(destino.id);
    const disponivel = linhas > 0 && podeGravar();

    const rotulo = document.createElement('label');
    rotulo.className = 'gravacao__opcao';
    rotulo.dataset.indisponivel = String(!disponivel);

    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.value = destino.id;
    caixa.disabled = !disponivel;
    caixa.addEventListener('change', atualizarBotoes);

    const info = document.createElement('div');
    const titulo = document.createElement('div');
    titulo.className = 'gravacao__titulo';
    titulo.textContent = `${MODELOS[destino.id].aba} → ${destino.titulo}`;
    const detalhe = document.createElement('div');
    detalhe.className = 'gravacao__detalhe';
    detalhe.textContent = linhas
      ? `${linhas} linha(s) lida(s). ${destino.detalhe}`
      : 'Nenhuma linha desta aba no lote atual.';
    info.append(titulo, detalhe);

    rotulo.append(caixa, info);
    refs.opcoesGravacao.append(rotulo);
  }

  if (!podeGravar()) {
    const aviso = document.createElement('div');
    aviso.className = 'gravacao__detalhe';
    aviso.textContent = 'Seu perfil é de consulta: a leitura e o Excel continuam disponíveis, mas gravar no banco exige permissão de criação.';
    refs.opcoesGravacao.append(aviso);
  }
}

async function gravar() {
  const ids = abasMarcadas();
  if (!ids.length) return;

  estado.gravando = true;
  atualizarBotoes();
  refs.retornoGravacao.replaceChildren(criarCarregando('Gravando na área Conprem…'));

  const relatos = [];
  for (const id of ids) {
    try {
      relatos.push(await gravarAba(id, estado.resultados[id]));
    } catch (err) {
      relatos.push({ id, titulo: MODELOS[id].aba, gravados: 0, repetidos: 0, erros: [String(err.message || err)] });
    }
  }

  estado.gravando = false;
  refs.retornoGravacao.replaceChildren();

  let totalGravado = 0;
  for (const r of relatos) {
    totalGravado += r.gravados;
    const div = document.createElement('div');
    div.className = r.erros.length ? 'aviso aviso--erro' : 'aviso';
    const partes = [`${r.titulo}: ${r.gravados} gravado(s)`];
    if (r.repetidos) partes.push(`${r.repetidos} já existia(m) e foi(ram) mantido(s)`);
    if (r.erros.length) partes.push(`${r.erros.length} com erro — ${r.erros.slice(0, 3).join('; ')}`);
    div.textContent = partes.join(' · ');
    refs.retornoGravacao.append(div);
  }

  App.toast(
    totalGravado
      ? `${totalGravado} registro(s) gravado(s) na área Conprem.`
      : 'Nada novo para gravar: os registros do lote já estavam no banco.',
    totalGravado ? 'ok' : 'aviso',
  );
  atualizarBotoes();
}

// ------------------------------------------------------------ processamento

/** A semana escolhida à mão vale para todas as abas. */
function aplicarSemana(semana) {
  if (!semana) return;
  for (const id of ORDEM_MODELOS) {
    for (const linha of estado.resultados[id] || []) linha.semana = semana;
  }
}

async function reprocessar() {
  if (!estado.arquivos.length) {
    estado.resultados = {};
    estado.origens = {};
    estado.avisos = [];
    refs.retornoGravacao.replaceChildren();
    redesenhar();
    return;
  }

  marcarProcessando(true);
  try {
    const opcoes = estado.semanaManual ? { semana: refs.semana.value.trim() } : {};
    const saida = await processar(estado.arquivos.map((a) => a.arquivo), opcoes);

    estado.resultados = saida.resultados;
    estado.origens = saida.origens;
    estado.avisos = saida.avisos;

    if (!estado.semanaManual && saida.semana) refs.semana.value = saida.semana;
    rotularArquivos();
  } catch (erro) {
    estado.avisos = [`Não foi possível processar os arquivos: ${erro.message}`];
  } finally {
    marcarProcessando(false);
    redesenhar();
  }
}

function adicionarArquivos(novos) {
  for (const arquivo of novos) {
    const repetido = estado.arquivos.some(
      (a) => a.arquivo.name === arquivo.name && a.arquivo.size === arquivo.size,
    );
    if (!repetido) estado.arquivos.push({ arquivo, modelo: '', erro: false });
  }
  redesenhar();
  reprocessar();
}

function removerArquivo(indice) {
  estado.arquivos.splice(indice, 1);
  redesenhar();
  reprocessar();
}

// ------------------------------------------------------------ exportação

function nomeArquivo() {
  const semana = (refs.semana.value || semanaAtual()).replace(/[^\w-]+/g, '');
  return `CONPREM_${semana || 'export'}.xlsx`;
}

function exportar() {
  const abas = ORDEM_MODELOS.filter((id) => totalLinhas(id)).map((id) => ({
    aba: MODELOS[id].aba,
    colunas: MODELOS[id].colunas,
    linhas: estado.resultados[id],
  }));
  if (!abas.length) return;

  const blob = gerarXlsx(abas);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo();
  document.body.append(link);
  link.click();
  link.remove();
  // dá tempo do navegador iniciar o download antes de liberar o blob
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ------------------------------------------------------------ eventos

iniciarDropzone(refs.dropzone, refs.entrada, adicionarArquivos);

refs.semana.addEventListener('change', () => {
  estado.semanaManual = refs.semana.value.trim() !== '';
  aplicarSemana(refs.semana.value.trim());
  redesenhar();
});

refs.limpar.addEventListener('click', () => {
  estado.arquivos = [];
  estado.semanaManual = false;
  refs.semana.value = semanaAtual();
  reprocessar();
});

refs.exportar.addEventListener('click', exportar);
refs.botaoGravar.addEventListener('click', gravar);
window.addEventListener('auth:perfilAtualizado', redesenhar);

redesenhar();
