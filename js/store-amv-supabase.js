/* =====================================================================
   STORE-AMV-SUPABASE.JS — Leitura e gravação da área de AMV

   Três tabelas encadeadas, na mesma forma do relatório de origem:
     amv_inspecoes → amv_pecas_inspecionadas → amv_defeitos
   (ver supabase/2026-09-08-area-amv.sql).

   A área de AMV é única — não tem par por empresa como as telas de
   dormentes de concreto —, então aqui não passa por Area.tabela().
   ===================================================================== */
'use strict';

const StoreAmv = (() => {
  const T_INSPECOES = 'amv_inspecoes';
  const T_PECAS = 'amv_pecas_inspecionadas';
  const T_DEFEITOS = 'amv_defeitos';

  function db() {
    const c = window.Auth?.cliente?.();
    if (!c) throw new Error('Supabase não configurado.');
    return c;
  }

  function exigirPermissao(acao, descricao) {
    if (!window.Auth?.pode?.(acao)) {
      throw new Error(window.Auth?.mensagemSemPermissao?.(descricao) || `Sem permissão para ${descricao}.`);
    }
  }

  function acaoSalvar(registro) {
    return registro?.id ? ['editar', 'editar registros'] : ['criar', 'criar registros'];
  }

  async function usuarioAtual() {
    const { data, error } = await db().auth.getUser();
    if (error) throw error;
    return data?.user || null;
  }

  /** A tabela ainda não foi criada no Supabase? Usado para orientar o usuário. */
  function tabelaFaltando(err) {
    const msg = String(err?.message || err || '');
    return /amv_(inspecoes|pecas_inspecionadas|defeitos)/.test(msg)
      && /(does not exist|schema cache|could not find)/i.test(msg);
  }

  function mensagemErro(err, fallback) {
    const msg = String(err?.message || err || '').trim();
    if (tabelaFaltando(err)) {
      return 'As tabelas da área de AMV ainda não existem no Supabase. Rode supabase/2026-09-08-area-amv.sql e depois supabase/2026-09-08-area-amv-carga-historico.sql no SQL Editor.';
    }
    if (/row-level security/i.test(msg)) return 'Seu perfil não tem permissão para esta ação na área de AMV.';
    return msg || fallback;
  }

  /* ---------------------------------------------------------------------
     Inspeções. Por padrão traz as peças e os defeitos junto, numa
     consulta só — a tela quase sempre precisa da árvore inteira.
     --------------------------------------------------------------------- */
  async function listarInspecoes(filtros = {}) {
    const colunas = filtros.semFilhos
      ? '*'
      : `*, pecas:${T_PECAS}(*, defeitos:${T_DEFEITOS}(*))`;

    let q = db()
      .from(T_INSPECOES)
      .select(colunas)
      .order('data_inspecao', { ascending: false, nullsFirst: false })
      .order('criado_em', { ascending: false, nullsFirst: false })
      .limit(filtros.limite || 5000);

    if (filtros.id) q = q.eq('id', filtros.id);
    if (filtros.auditId) q = q.eq('audit_id', filtros.auditId);
    if (filtros.fornecedor) q = q.eq('fornecedor', filtros.fornecedor);
    if (filtros.responsavel) q = q.eq('responsavel', filtros.responsavel);
    if (filtros.numeroPedido) q = q.eq('numero_pedido', filtros.numeroPedido);
    if (filtros.projeto) q = q.contains('projetos', [filtros.projeto]);
    if (filtros.dataIni) q = q.gte('data_inspecao', filtros.dataIni);
    if (filtros.dataFim) q = q.lte('data_inspecao', filtros.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function salvarInspecao(registro) {
    const [acao, descricao] = acaoSalvar(registro);
    exigirPermissao(acao, descricao);
    const user = await usuarioAtual();
    const payload = { ...registro, atualizado_por: user?.id || null };
    const id = payload.id;
    delete payload.id;
    delete payload.pecas;

    const query = id
      ? db().from(T_INSPECOES).update(payload).eq('id', id)
      : db().from(T_INSPECOES).insert({ ...payload, criado_por: user?.id || null });

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async function removerInspecao(id) {
    exigirPermissao('excluir', 'excluir registros');
    const { error } = await db().from(T_INSPECOES).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  /* ---------------------------------------------------------------------
     Peças. A classificação (família, trilho, inclinação...) é preenchida
     por gatilho no banco a partir do texto de tipo_peca — não mande esses
     campos daqui a não ser para corrigir uma classificação na mão.
     --------------------------------------------------------------------- */
  async function listarPecas(filtros = {}) {
    let q = db()
      .from(T_PECAS)
      .select(`*, inspecao:${T_INSPECOES}(id, audit_id, data_inspecao, fornecedor, fornecedor_outro, responsavel, numero_pedido, projetos), defeitos:${T_DEFEITOS}(*)`)
      .limit(filtros.limite || 10000);

    if (filtros.id) q = q.eq('id', filtros.id);
    if (filtros.inspecaoId) q = q.eq('inspecao_id', filtros.inspecaoId);
    if (filtros.familia) q = q.eq('familia', filtros.familia);
    if (filtros.trilho) q = q.eq('trilho', filtros.trilho);
    if (filtros.inclinacao) q = q.eq('inclinacao', filtros.inclinacao);
    if (filtros.mao) q = q.eq('mao', filtros.mao);
    if (filtros.montagem) q = q.eq('montagem', filtros.montagem);
    if (filtros.derivacao) q = q.eq('derivacao', filtros.derivacao);
    if (filtros.temDefeito === true || filtros.temDefeito === false) q = q.eq('tem_defeito', filtros.temDefeito);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function salvarPeca(registro) {
    const [acao, descricao] = acaoSalvar(registro);
    exigirPermissao(acao, descricao);
    const user = await usuarioAtual();
    const payload = { ...registro, atualizado_por: user?.id || null };
    const id = payload.id;
    delete payload.id;
    delete payload.inspecao;
    delete payload.defeitos;

    const query = id
      ? db().from(T_PECAS).update(payload).eq('id', id)
      : db().from(T_PECAS).insert({ ...payload, criado_por: user?.id || null });

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async function removerPeca(id) {
    exigirPermissao('excluir', 'excluir registros');
    const { error } = await db().from(T_PECAS).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  /* ---------------------------------------------------------------------
     Defeitos.
     --------------------------------------------------------------------- */
  async function listarDefeitos(filtros = {}) {
    let q = db()
      .from(T_DEFEITOS)
      .select(`*, peca:${T_PECAS}(id, indice, tipo_peca, familia, trilho), inspecao:${T_INSPECOES}(id, data_inspecao, fornecedor, responsavel, numero_pedido)`)
      .order('criado_em', { ascending: false, nullsFirst: false })
      .limit(filtros.limite || 5000);

    if (filtros.id) q = q.eq('id', filtros.id);
    if (filtros.pecaId) q = q.eq('peca_id', filtros.pecaId);
    if (filtros.inspecaoId) q = q.eq('inspecao_id', filtros.inspecaoId);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function salvarDefeito(registro) {
    const [acao, descricao] = acaoSalvar(registro);
    exigirPermissao(acao, descricao);
    const user = await usuarioAtual();
    const payload = { ...registro, atualizado_por: user?.id || null };
    const id = payload.id;
    delete payload.id;
    delete payload.peca;
    delete payload.inspecao;

    const query = id
      ? db().from(T_DEFEITOS).update(payload).eq('id', id)
      : db().from(T_DEFEITOS).insert({ ...payload, criado_por: user?.id || null });

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async function removerDefeito(id) {
    exigirPermissao('excluir', 'excluir registros');
    const { error } = await db().from(T_DEFEITOS).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  return {
    T_INSPECOES,
    T_PECAS,
    T_DEFEITOS,
    tabelaFaltando,
    mensagemErro,
    listarInspecoes,
    salvarInspecao,
    removerInspecao,
    listarPecas,
    salvarPeca,
    removerPeca,
    listarDefeitos,
    salvarDefeito,
    removerDefeito,
  };
})();

if (typeof window !== 'undefined') window.StoreAmv = StoreAmv;
