/* =====================================================================
   AMV-COMUM.JS — Apoio compartilhado pelas telas da área de AMV

   Traduções entre as linhas do Supabase e o que as telas mostram:
   nome do fornecedor, lista de projetos, badges e agrupamentos.
   ===================================================================== */
'use strict';

const Amv = (() => {
  /* Opções do relatório de origem (template "Materiais | AMV" do
     SafetyCulture). Ficam aqui para os selects de cadastro oferecerem as
     mesmas escolhas que o inspetor tem em campo. */
  const FORNECEDORES = Object.freeze([
    'BRRailParts', 'Ibrafer', 'Tempo', 'Panfer', 'Voestalpine', 'Hewitt', 'Absoluta', 'Outro',
  ]);
  const PROJETOS = Object.freeze(['Manutenção', 'Modernização', 'Expansão', 'FISP', 'Métrica']);
  const SIM_NAO_NA = Object.freeze(['Sim', 'Não', 'N/A']);

  /* Valores que a classificação automática produz (ver as funções
     amv_*_peca em supabase/2026-09-08-area-amv.sql). */
  const FAMILIAS = Object.freeze([
    'Jacaré', 'Meia chave', 'Contratrilho', 'Ponteira', 'Agulha',
    'Barra de conjugação', 'Aparelho inversor', 'Aparelho de manobra',
    'AMV completo', 'Trilho', 'Outros',
  ]);
  const TRILHOS = Object.freeze(['UIC60', 'TR-68', 'TR-57', 'TR-45', 'TR-37']);
  const INCLINACOES = Object.freeze(['1:8', '1:10', '1:12', '1:14', '1:20']);
  const MAOS = Object.freeze(['Direita', 'Esquerda', 'Direita e esquerda']);
  const MONTAGENS = Object.freeze(['Simples', 'Duplo']);
  const DERIVACOES = Object.freeze(['D1D', 'D1E', 'E1D', 'E1E']);

  /** Fornecedor que aparece na tela: "Outro" mostra o que foi digitado. */
  function fornecedor(inspecao) {
    const base = String(inspecao?.fornecedor || '').trim();
    const outro = String(inspecao?.fornecedor_outro || '').trim();
    if (base.toLowerCase() === 'outro' && outro) return outro;
    return base || '—';
  }

  function projetos(inspecao) {
    const lista = Array.isArray(inspecao?.projetos) ? inspecao.projetos : [];
    return lista.filter(Boolean);
  }

  function projetosTexto(inspecao) {
    const lista = projetos(inspecao);
    return lista.length ? lista.join(', ') : '—';
  }

  function badgesProjeto(inspecao) {
    const lista = projetos(inspecao);
    if (!lista.length) return '—';
    return lista.map(p => U.badgeProjeto(p)).join(' ');
  }

  /** Texto livre do relatório: escapa e mantém as quebras de linha. */
  function texto(valor, vazio = '—') {
    const t = String(valor == null ? '' : valor).trim();
    if (!t) return vazio;
    return U.esc(t).replace(/\n/g, '<br>');
  }

  function badgeDefeito(temDefeito) {
    if (temDefeito === true) return '<span class="badge badge-reprovado">Com defeito</span>';
    if (temDefeito === false) return '<span class="badge badge-ok">Sem defeito</span>';
    return '<span class="badge badge-neutro">Não informado</span>';
  }

  function badgeOrigem(inspecao) {
    const origem = String(inspecao?.origem_dados || 'manual').toLowerCase();
    if (origem === 'safeculture') return '<span class="badge badge-safeculture">Histórico</span>';
    return '<span class="badge badge-manual">Manual</span>';
  }

  function pecas(inspecao) {
    const lista = Array.isArray(inspecao?.pecas) ? [...inspecao.pecas] : [];
    return lista.sort((a, b) => (a.indice || 0) - (b.indice || 0));
  }

  function defeitos(peca) {
    const lista = Array.isArray(peca?.defeitos) ? [...peca.defeitos] : [];
    return lista.sort((a, b) => (a.indice || 0) - (b.indice || 0));
  }

  function totalPecasComDefeito(inspecao) {
    return pecas(inspecao).filter(p => p.tem_defeito === true).length;
  }

  /** "2026-08" a partir de uma data ISO; usado nos agrupamentos por mês. */
  function mesDe(iso) {
    const s = String(iso || '').slice(0, 7);
    return /^\d{4}-\d{2}$/.test(s) ? s : '';
  }

  function rotuloMes(chave) {
    const p = String(chave || '').split('-');
    if (p.length !== 2) return chave || '—';
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const m = parseInt(p[1], 10);
    return `${meses[m - 1] || p[1]}/${p[0]}`;
  }

  /** Valores distintos e ordenados de um campo, para montar filtros. */
  function valoresDe(lista, obter) {
    const set = new Set();
    (lista || []).forEach(item => {
      const v = obter(item);
      if (Array.isArray(v)) v.forEach(x => { if (x) set.add(String(x)); });
      else if (v) set.add(String(v));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function preencherSelect(id, valores, placeholder) {
    const el = document.getElementById(id);
    if (!el) return;
    const atual = el.value;
    el.innerHTML = U.opcoes(valores, atual, placeholder);
    if (atual && valores.includes(atual)) el.value = atual;
  }

  function inteiro(v) {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  /** Soma de um campo numérico numa lista de inspeções. */
  function soma(lista, campo) {
    return (lista || []).reduce((acc, r) => acc + inteiro(r?.[campo]), 0);
  }

  return {
    FORNECEDORES, PROJETOS, SIM_NAO_NA,
    FAMILIAS, TRILHOS, INCLINACOES, MAOS, MONTAGENS, DERIVACOES,
    fornecedor, projetos, projetosTexto, badgesProjeto,
    texto, badgeDefeito, badgeOrigem,
    pecas, defeitos, totalPecasComDefeito,
    mesDe, rotuloMes, valoresDe, preencherSelect, inteiro, soma,
  };
})();

if (typeof window !== 'undefined') window.Amv = Amv;
