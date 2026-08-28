/* Compatibilidade somente leitura com o historico importado do SafetyCulture.
   A integracao automatica foi encerrada e este arquivo nao faz chamadas externas. */
const SafetyCultureSync = (() => {
  function controlesTopoHtml() { return ''; }
  async function carregarStatusTopo() {}

  function gerenciadoPelaApi(registro) {
    return String(registro?.origemDados || registro?.origem_dados || '').toLowerCase() === 'safeculture'
      || !!(registro?.safecultureAuditId || registro?.safeculture_audit_id);
  }

  function origemBadge(registroOuOrigem) {
    const origem = typeof registroOuOrigem === 'object'
      ? registroOuOrigem?.origemDados || registroOuOrigem?.origem_dados
      : registroOuOrigem;
    const key = String(origem || 'manual').toLowerCase();
    if (key === 'safeculture') return '<span class="badge badge-safeculture">Histórico</span>';
    if (key === 'pdf') return '<span class="badge badge-pdf">PDF</span>';
    return '<span class="badge badge-manual">Manual</span>';
  }

  function chaveLote(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\bLOTE\b/gi, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  }

  function chavesRegistroPorLote(registro) {
    const chaves = [];
    const producaoId = String(registro?.producaoLoteId || registro?.producao_lote_id || '').trim();
    const lote = chaveLote(registro?.lote ?? registro?.loteEnsaiado ?? registro?.lote_ensaiado);
    if (producaoId) chaves.push(`producao:${producaoId}`);
    if (lote) chaves.push(`lote:${lote}`);
    return chaves;
  }

  // Preserva a regra visual de duplicidade dos dados antigos sem importar nada novo.
  function filtrarDuplicadosPorLote(registros) {
    const lista = Array.isArray(registros) ? registros : [];
    const chavesManuais = new Set();
    lista.forEach(registro => {
      if (gerenciadoPelaApi(registro)) return;
      chavesRegistroPorLote(registro).forEach(chave => chavesManuais.add(chave));
    });
    const chavesHistoricas = new Set();
    return lista.filter(registro => {
      if (!gerenciadoPelaApi(registro)) return true;
      const chaves = chavesRegistroPorLote(registro);
      if (chaves.some(chave => chavesManuais.has(chave) || chavesHistoricas.has(chave))) return false;
      chaves.forEach(chave => chavesHistoricas.add(chave));
      return true;
    });
  }

  // O historico deixa de ser controlado externamente e pode ser mantido no site.
  function podeEditarRegistro() { return !!Auth.pode('editar'); }
  function podeExcluirRegistro() { return !!Auth.pode('excluir'); }
  function bloquearAlteracao() { return false; }

  return { controlesTopoHtml, carregarStatusTopo, origemBadge, gerenciadoPelaApi,
    filtrarDuplicadosPorLote, podeEditarRegistro, podeExcluirRegistro, bloquearAlteracao };
})();

window.SafetyCultureSync = SafetyCultureSync;
