// Abas e tabela de prévia dos dados extraídos.

import { MODELOS, ORDEM_MODELOS } from '../schema.js';

const fmtData = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

function formatar(valor, tipo) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (tipo === 'data' && valor instanceof Date) return fmtData.format(valor);
  if (tipo === 'numero' && typeof valor === 'number') {
    return valor.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
  }
  return String(valor);
}

function montarTabela(modelo, linhas) {
  const envolve = document.createElement('div');
  envolve.className = 'tabela-envolve';

  const tabela = document.createElement('table');
  tabela.className = 'tabela';

  const thead = document.createElement('thead');
  const trCab = document.createElement('tr');
  for (const col of modelo.colunas) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = col.titulo;
    trCab.append(th);
  }
  thead.append(trCab);

  const tbody = document.createElement('tbody');
  for (const linha of linhas) {
    const tr = document.createElement('tr');
    for (const col of modelo.colunas) {
      const td = document.createElement('td');
      const texto = formatar(linha[col.chave], col.tipo);
      if (texto === null) {
        td.textContent = '—';
        td.className = 'tabela__vazio';
      } else {
        td.textContent = texto;
      }
      tr.append(td);
    }
    tbody.append(tr);
  }

  tabela.append(thead, tbody);
  envolve.append(tabela);
  return envolve;
}

/**
 * Desenha as abas e o conteúdo do modelo selecionado.
 * @param {{abas: HTMLElement, painel: HTMLElement, secao: HTMLElement, resumo: HTMLElement}} refs
 * @param {Record<string, Array>} resultados
 * @param {Record<string, string[]>} origens
 */
export function desenharResultados(refs, resultados, origens) {
  const disponiveis = ORDEM_MODELOS.filter((id) => (resultados[id] || []).length);
  refs.secao.hidden = disponiveis.length === 0;
  refs.abas.replaceChildren();
  refs.painel.replaceChildren();
  if (!disponiveis.length) {
    refs.resumo.textContent = '';
    return;
  }

  const total = disponiveis.reduce((n, id) => n + resultados[id].length, 0);
  refs.resumo.textContent = `${total} linha${total === 1 ? '' : 's'} em ${disponiveis.length} aba${
    disponiveis.length === 1 ? '' : 's'
  }`;

  let selecionada = disponiveis[0];

  const mostrar = (id) => {
    selecionada = id;
    for (const botao of refs.abas.children) {
      botao.setAttribute('aria-selected', String(botao.dataset.modelo === id));
      botao.tabIndex = botao.dataset.modelo === id ? 0 : -1;
    }

    const modelo = MODELOS[id];
    refs.painel.replaceChildren(montarTabela(modelo, resultados[id]));

    const nota = document.createElement('p');
    nota.className = 'resumo-linha';
    const arquivos = (origens[id] || []).join(', ');
    nota.textContent = `Aba "${modelo.aba}" · ${resultados[id].length} linha(s) · ${modelo.colunas.length} colunas · origem: ${arquivos}`;
    refs.painel.append(nota);
  };

  for (const id of disponiveis) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'aba';
    botao.role = 'tab';
    botao.dataset.modelo = id;
    botao.setAttribute('aria-selected', 'false');

    const rotulo = document.createElement('span');
    rotulo.textContent = MODELOS[id].aba;
    const contagem = document.createElement('span');
    contagem.className = 'aba__contagem';
    contagem.textContent = String(resultados[id].length);

    botao.append(rotulo, contagem);
    botao.addEventListener('click', () => mostrar(id));
    botao.addEventListener('keydown', (e) => {
      const chaves = { ArrowRight: 1, ArrowLeft: -1 };
      if (!(e.key in chaves)) return;
      e.preventDefault();
      const i = disponiveis.indexOf(selecionada);
      const proxima = disponiveis[(i + chaves[e.key] + disponiveis.length) % disponiveis.length];
      mostrar(proxima);
      refs.abas.querySelector(`[data-modelo="${proxima}"]`)?.focus();
    });

    refs.abas.append(botao);
  }

  mostrar(selecionada);
}

/** Lista avisos e erros abaixo da área de importação. */
export function desenharAvisos(alvo, avisos) {
  alvo.replaceChildren();
  for (const texto of avisos) {
    const div = document.createElement('div');
    div.className = /falha|erro/i.test(texto) ? 'aviso aviso--erro' : 'aviso';
    div.textContent = texto;
    alvo.append(div);
  }
}
