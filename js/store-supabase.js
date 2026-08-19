/* =====================================================================
   STORE-SUPABASE.JS — Camada de leitura/gravação no Supabase
   ===================================================================== */

const StoreSupabase = (() => {
  function db() {
    const c = window.Auth?.cliente?.();
    if (!c) throw new Error('Supabase não configurado.');
    return c;
  }

  /* Tabela da área ativa (ver js/area.js). Na Cavan devolve o nome original;
     nas telas da Conprem devolve a tabela conprem_*, que tem as mesmas colunas.
     Tabelas sem par por empresa (usuários, auditoria, especificações,
     subcomponentes) passam intactas. */
  function tab(nome) {
    return window.Area ? Area.tabela(nome) : nome;
  }

  /* O quadro de avisos do Dashboard é por área: cada empresa tem o seu. */
  function chaveAviso() {
    return window.Area ? Area.sufixoChave('dashboard') : 'dashboard';
  }

  async function usuarioAtual() {
    const { data, error } = await db().auth.getUser();
    if (error) throw error;
    return data?.user || null;
  }

  async function perfil() {
    return Auth.perfilAtual();
  }


  function exigirPermissao(acao, descricao) {
    if (!window.Auth?.pode?.(acao)) {
      throw new Error(window.Auth?.mensagemSemPermissao?.(descricao) || `Sem permissão para ${descricao}.`);
    }
  }

  function acaoSalvar(registro) {
    return registro?.id ? ['editar', 'editar registros'] : ['criar', 'criar registros'];
  }

  async function listarProducao(filtros = {}) {
    let q = db()
      .from(tab('producao_lotes'))
      .select('*')
      .order('data_fabricacao', { ascending: false, nullsFirst: false })
      .order('criado_em', { ascending: false, nullsFirst: false })
      .limit(filtros.limite || 5000);

    if (filtros.id) q = q.eq('id', filtros.id);
    if (filtros.lote) q = q.eq('lote', filtros.lote);
    if (filtros.fornecedor) q = q.eq('fornecedor', filtros.fornecedor);
    if (filtros.projeto) q = q.eq('projeto', filtros.projeto);
    if (filtros.bitola) q = q.eq('bitola', filtros.bitola);
    if (filtros.status) q = q.eq('status', filtros.status);
    if (filtros.dataIni) q = q.gte('data_fabricacao', filtros.dataIni);
    if (filtros.dataFim) q = q.lte('data_fabricacao', filtros.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function salvarProducao(registro) {
    const [acao, descricao] = acaoSalvar(registro);
    exigirPermissao(acao, descricao);
    const user = await usuarioAtual();
    const payload = { ...registro, atualizado_por: user?.id || null };
    const id = payload.id;

    let query;
    if (id) {
      delete payload.id;
      query = db().from(tab('producao_lotes')).update(payload).eq('id', id);
    } else {
      delete payload.id;
      payload.criado_por = user?.id || null;
      query = db().from(tab('producao_lotes')).insert(payload);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async function removerProducao(id) {
    exigirPermissao('excluir', 'excluir registros');
    const { error } = await db().from(tab('producao_lotes')).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async function listarPedidosDormentes(filtros = {}) {
    let q = db()
      .from(tab('pedidos_dormentes'))
      .select('*')
      .order('criado_em', { ascending: false, nullsFirst: false })
      .order('numero_pedido', { ascending: true, nullsFirst: false })
      .limit(filtros.limite || 5000);

    if (filtros.id) q = q.eq('id', filtros.id);
    if (filtros.fornecedor) q = q.eq('fornecedor', filtros.fornecedor);
    if (filtros.projeto) q = q.eq('projeto', filtros.projeto);
    if (filtros.numeroPedido) q = q.eq('numero_pedido', filtros.numeroPedido);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function salvarPedidoDormente(registro) {
    const [acao, descricao] = acaoSalvar(registro);
    exigirPermissao(acao, descricao);
    const user = await usuarioAtual();
    const payload = { ...registro, atualizado_por: user?.id || null };
    const id = payload.id;

    let query;
    if (id) {
      delete payload.id;
      query = db().from(tab('pedidos_dormentes')).update(payload).eq('id', id);
    } else {
      delete payload.id;
      payload.criado_por = user?.id || null;
      query = db().from(tab('pedidos_dormentes')).insert(payload);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async function removerPedidoDormente(id) {
    exigirPermissao('excluir', 'excluir registros');
    const { error } = await db().from(tab('pedidos_dormentes')).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async function listarReprovados(filtros = {}) {
    let q = db()
      .from(tab('reprovados'))
      .select('*')
      .order('data_producao', { ascending: false, nullsFirst: false })
      .order('criado_em', { ascending: false, nullsFirst: false })
      .limit(filtros.limite || 5000);

    if (filtros.id) q = q.eq('id', filtros.id);
    if (filtros.lote) q = q.eq('lote', filtros.lote);
    if (filtros.producaoLoteId) q = q.eq('producao_lote_id', filtros.producaoLoteId);
    if (filtros.fornecedor) q = q.eq('fornecedor', filtros.fornecedor);
    if (filtros.projeto) q = q.eq('projeto', filtros.projeto);
    if (filtros.bitola) q = q.eq('bitola', filtros.bitola);
    if (filtros.motivoIndicador) q = q.eq('motivo_indicador', filtros.motivoIndicador);
    if (filtros.dataIni) q = q.gte('data_producao', filtros.dataIni);
    if (filtros.dataFim) q = q.lte('data_producao', filtros.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function salvarReprovado(registro) {
    const [acao, descricao] = acaoSalvar(registro);
    exigirPermissao(acao, descricao);
    const user = await usuarioAtual();
    const payload = { ...registro, atualizado_por: user?.id || null };
    const id = payload.id;

    let query;
    if (id) {
      delete payload.id;
      query = db().from(tab('reprovados')).update(payload).eq('id', id);
    } else {
      delete payload.id;
      payload.criado_por = user?.id || null;
      query = db().from(tab('reprovados')).insert(payload);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async function removerReprovado(id) {
    exigirPermissao('excluir', 'excluir registros');
    const { error } = await db().from(tab('reprovados')).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async function listarEnsaiosLiberacao(filtros = {}) {
    let q = db()
      .from(tab('ensaios_liberacao'))
      .select('*')
      .order('data_ensaio', { ascending: false, nullsFirst: false })
      .order('criado_em', { ascending: false, nullsFirst: false })
      .limit(filtros.limite || 5000);

    if (filtros.id) q = q.eq('id', filtros.id);
    if (filtros.lote) q = q.eq('lote_ensaiado', filtros.lote);
    if (filtros.producaoLoteId) q = q.eq('producao_lote_id', filtros.producaoLoteId);
    if (filtros.fornecedor) q = q.eq('fornecedor', filtros.fornecedor);
    if (filtros.projeto) q = q.eq('projeto', filtros.projeto);
    if (filtros.bitola) q = q.eq('bitola', filtros.bitola);
    if (filtros.resultado) q = q.eq('resultado', filtros.resultado);
    if (filtros.dataIni) q = q.gte('data_ensaio', filtros.dataIni);
    if (filtros.dataFim) q = q.lte('data_ensaio', filtros.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function salvarEnsaioLiberacao(registro) {
    const [acao, descricao] = acaoSalvar(registro);
    exigirPermissao(acao, descricao);
    const user = await usuarioAtual();
    const payload = { ...registro, atualizado_por: user?.id || null };
    const id = payload.id;

    let query;
    if (id) {
      delete payload.id;
      query = db().from(tab('ensaios_liberacao')).update(payload).eq('id', id);
    } else {
      delete payload.id;
      payload.criado_por = user?.id || null;
      query = db().from(tab('ensaios_liberacao')).insert(payload);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async function removerEnsaioLiberacao(id) {
    exigirPermissao('excluir', 'excluir registros');
    const { error } = await db().from(tab('ensaios_liberacao')).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  /* ---------------------------------------------------------------------
     Ensaios de Acompanhamento (14 dias · cura térmica) — registro sem
     liberação de série. Tabela independente de ensaios_liberacao.
     --------------------------------------------------------------------- */
  async function listarEnsaiosAcompanhamento(filtros = {}) {
    let q = db()
      .from('ensaios_acompanhamento')
      .select('*')
      .order('data_ensaio', { ascending: false, nullsFirst: false })
      .order('criado_em', { ascending: false, nullsFirst: false })
      .limit(filtros.limite || 5000);

    if (filtros.id) q = q.eq('id', filtros.id);
    if (filtros.lote) q = q.eq('lote_ensaiado', filtros.lote);
    if (filtros.producaoLoteId) q = q.eq('producao_lote_id', filtros.producaoLoteId);
    if (filtros.fornecedor) q = q.eq('fornecedor', filtros.fornecedor);
    if (filtros.projeto) q = q.eq('projeto', filtros.projeto);
    if (filtros.bitola) q = q.eq('bitola', filtros.bitola);
    if (filtros.resultado) q = q.eq('resultado', filtros.resultado);
    if (filtros.dataIni) q = q.gte('data_ensaio', filtros.dataIni);
    if (filtros.dataFim) q = q.lte('data_ensaio', filtros.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function salvarEnsaioAcompanhamento(registro) {
    const [acao, descricao] = acaoSalvar(registro);
    exigirPermissao(acao, descricao);
    const user = await usuarioAtual();
    const payload = { ...registro, atualizado_por: user?.id || null };
    const id = payload.id;

    let query;
    if (id) {
      delete payload.id;
      query = db().from('ensaios_acompanhamento').update(payload).eq('id', id);
    } else {
      delete payload.id;
      payload.criado_por = user?.id || null;
      query = db().from('ensaios_acompanhamento').insert(payload);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async function atualizarSerieEnsaioAcompanhamento(id, serie) {
    exigirPermissao('editar', 'corrigir a série do acompanhamento');
    const user = await usuarioAtual();
    const { data, error } = await db()
      .from('ensaios_acompanhamento')
      .update({
        serie,
        serie_ajustada_manualmente: true,
        atualizado_por: user?.id || null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function removerEnsaioAcompanhamento(id) {
    exigirPermissao('excluir', 'excluir registros');
    const { error } = await db().from('ensaios_acompanhamento').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  /* ---------------------------------------------------------------------
     Ensaios de bitola — histórico consultivo independente.
     --------------------------------------------------------------------- */
  async function listarEnsaiosBitola(filtros = {}) {
    let q = db()
      .from('ensaios_bitola')
      .select('*')
      .order('data_ensaio', { ascending: false, nullsFirst: false })
      .order('criado_em', { ascending: false, nullsFirst: false })
      .limit(filtros.limite || 5000);

    if (filtros.id) q = q.eq('id', filtros.id);
    if (filtros.lote) q = q.eq('lote', filtros.lote);
    if (filtros.projeto) q = q.eq('projeto', filtros.projeto);
    if (filtros.bitola) q = q.eq('bitola', filtros.bitola);
    if (filtros.resultado) q = q.eq('resultado', filtros.resultado);
    if (filtros.dataIni) q = q.gte('data_ensaio', filtros.dataIni);
    if (filtros.dataFim) q = q.lte('data_ensaio', filtros.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function salvarEnsaioBitola(registro) {
    const [acao, descricao] = acaoSalvar(registro);
    exigirPermissao(acao, descricao);
    const user = await usuarioAtual();
    const payload = { ...registro, atualizado_por: user?.id || null };
    const id = payload.id;

    let query;
    if (id) {
      delete payload.id;
      query = db().from('ensaios_bitola').update(payload).eq('id', id);
    } else {
      delete payload.id;
      payload.criado_por = user?.id || null;
      query = db().from('ensaios_bitola').insert(payload);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async function removerEnsaioBitola(id) {
    exigirPermissao('excluir', 'excluir registros');
    const { error } = await db().from('ensaios_bitola').delete().eq('id', id);
    if (error) throw error;
    return true;
  }


  /* ---------------------------------------------------------------------
     Ensaios de arrancamento USP — histórico consultivo independente.
     --------------------------------------------------------------------- */
  async function listarEnsaiosArrancamentoUsp(filtros = {}) {
    let q = db()
      .from('ensaios_arrancamento_usp')
      .select('*')
      .order('data_ensaio', { ascending: false, nullsFirst: false })
      .order('criado_em', { ascending: false, nullsFirst: false })
      .limit(filtros.limite || 5000);

    if (filtros.id) q = q.eq('id', filtros.id);
    if (filtros.lote) q = q.eq('lote', filtros.lote);
    if (filtros.fornecedor) q = q.eq('fornecedor', filtros.fornecedor);
    if (filtros.projeto) q = q.eq('projeto', filtros.projeto);
    if (filtros.bitola) q = q.eq('bitola', filtros.bitola);
    if (filtros.resultado) q = q.eq('resultado', filtros.resultado);
    if (filtros.usp) q = q.eq('usp', filtros.usp);
    if (filtros.tipoOmbreira) q = q.eq('tipo_ombreira', filtros.tipoOmbreira);
    if (filtros.dataIni) q = q.gte('data_ensaio', filtros.dataIni);
    if (filtros.dataFim) q = q.lte('data_ensaio', filtros.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function salvarEnsaioArrancamentoUsp(registro) {
    const [acao, descricao] = acaoSalvar(registro);
    exigirPermissao(acao, descricao);
    const user = await usuarioAtual();
    const payload = { ...registro, atualizado_por: user?.id || null };
    const id = payload.id;

    let query;
    if (id) {
      delete payload.id;
      query = db().from('ensaios_arrancamento_usp').update(payload).eq('id', id);
    } else {
      delete payload.id;
      payload.criado_por = user?.id || null;
      query = db().from('ensaios_arrancamento_usp').insert(payload);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async function removerEnsaioArrancamentoUsp(id) {
    exigirPermissao('excluir', 'excluir registros');
    const { error } = await db().from('ensaios_arrancamento_usp').delete().eq('id', id);
    if (error) throw error;
    return true;
  }


  /* ---------------------------------------------------------------------
     Inspeções de concretagem — histórico consultivo independente.
     --------------------------------------------------------------------- */
  async function listarInspecoesConcretagem(filtros = {}) {
    let q = db()
      .from(tab('inspecoes_concretagem'))
      .select('*')
      .order('data_inspecao', { ascending: false, nullsFirst: false })
      .order('criado_em', { ascending: false, nullsFirst: false })
      .limit(filtros.limite || 5000);

    if (filtros.id) q = q.eq('id', filtros.id);
    if (filtros.lote) q = q.eq('lote', filtros.lote);
    if (filtros.fornecedor) q = q.eq('fornecedor', filtros.fornecedor);
    if (filtros.projeto) q = q.eq('projeto', filtros.projeto);
    if (filtros.bitola) q = q.eq('bitola', filtros.bitola);
    if (filtros.resultado) q = q.eq('resultado', filtros.resultado);
    if (filtros.pista) q = q.eq('pista', filtros.pista);
    if (filtros.molde) q = q.eq('molde', filtros.molde);
    if (filtros.dataIni) q = q.gte('data_inspecao', filtros.dataIni);
    if (filtros.dataFim) q = q.lte('data_inspecao', filtros.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function salvarInspecaoConcretagem(registro) {
    const [acao, descricao] = acaoSalvar(registro);
    exigirPermissao(acao, descricao);
    const user = await usuarioAtual();
    const payload = { ...registro, atualizado_por: user?.id || null };
    const id = payload.id;

    let query;
    if (id) {
      delete payload.id;
      query = db().from(tab('inspecoes_concretagem')).update(payload).eq('id', id);
    } else {
      delete payload.id;
      payload.criado_por = user?.id || null;
      query = db().from(tab('inspecoes_concretagem')).insert(payload);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async function removerInspecaoConcretagem(id) {
    exigirPermissao('excluir', 'excluir registros');
    const { error } = await db().from(tab('inspecoes_concretagem')).delete().eq('id', id);
    if (error) throw error;
    return true;
  }


  /* ---------------------------------------------------------------------
     Inspeções de pista — histórico consultivo independente.
     --------------------------------------------------------------------- */
  async function listarInspecoesPista(filtros = {}) {
    let q = db()
      .from(tab('inspecoes_pista'))
      .select('*')
      .order('data_inspecao', { ascending: false, nullsFirst: false })
      .order('criado_em', { ascending: false, nullsFirst: false })
      .limit(filtros.limite || 5000);

    if (filtros.id) q = q.eq('id', filtros.id);
    if (filtros.lote) q = q.eq('lote', filtros.lote);
    if (filtros.fornecedor) q = q.eq('fornecedor', filtros.fornecedor);
    if (filtros.projeto) q = q.eq('projeto', filtros.projeto);
    if (filtros.bitola) q = q.eq('bitola', filtros.bitola);
    if (filtros.resultado) q = q.eq('resultado', filtros.resultado);
    if (filtros.pista) q = q.eq('pista', filtros.pista);
    if (filtros.molde) q = q.eq('molde', filtros.molde);
    if (filtros.dataIni) q = q.gte('data_inspecao', filtros.dataIni);
    if (filtros.dataFim) q = q.lte('data_inspecao', filtros.dataFim);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function salvarInspecaoPista(registro) {
    const [acao, descricao] = acaoSalvar(registro);
    exigirPermissao(acao, descricao);
    const user = await usuarioAtual();
    const payload = { ...registro, atualizado_por: user?.id || null };
    const id = payload.id;

    let query;
    if (id) {
      delete payload.id;
      query = db().from(tab('inspecoes_pista')).update(payload).eq('id', id);
    } else {
      delete payload.id;
      payload.criado_por = user?.id || null;
      query = db().from(tab('inspecoes_pista')).insert(payload);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async function removerInspecaoPista(id) {
    exigirPermissao('excluir', 'excluir registros');
    const { error } = await db().from(tab('inspecoes_pista')).delete().eq('id', id);
    if (error) throw error;
    return true;
  }


  /* ---------------------------------------------------------------------
     RNC — dormentes de concreto.
     Quadro de avisos independente da RNC de subcomponentes.
     --------------------------------------------------------------------- */
  async function listarRncDormentes(filtros = {}) {
    let q = db()
      .from('rnc_dormentes')
      .select('*')
      .order('criado_em', { ascending: false, nullsFirst: false })
      .limit(filtros.limite || 10000);

    if (filtros.id) q = q.eq('id', filtros.id);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function salvarRncDormente(registro) {
    exigirAdmin(registro?.id ? 'editar a RNC de dormentes' : 'criar RNC de dormentes');
    const user = await usuarioAtual();
    const payload = {
      titulo: String(registro?.titulo || 'Não conformidade').trim() || 'Não conformidade',
      conteudo: String(registro?.conteudo || ''),
      atualizado_por: user?.id || null,
    };
    const id = registro?.id;

    let query;
    if (id) {
      query = db().from('rnc_dormentes').update(payload).eq('id', id);
    } else {
      payload.criado_por = user?.id || null;
      query = db().from('rnc_dormentes').insert(payload);
    }

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async function removerRncDormente(id) {
    exigirAdmin('excluir a RNC de dormentes');
    const { error } = await db().from('rnc_dormentes').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async function listarConfiguracoes(tipoLista = '') {
    let q = db().from('listas_configuracao').select('*').eq('ativo', true).order('tipo_lista').order('ordem');
    if (tipoLista) q = q.eq('tipo_lista', tipoLista);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }



  function exigirAdmin(descricao) {
    if (!window.Auth?.permissoesAtuais?.()?.admin) {
      throw new Error(window.Auth?.mensagemSemPermissao?.(descricao) || `Sem permissão para ${descricao}.`);
    }
  }

  async function obterAvisoDashboard() {
    const { data, error } = await db()
      .from('avisos_dashboard')
      .select('*')
      .eq('chave', chaveAviso())
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function salvarAvisoDashboard(registro = {}) {
    exigirAdmin('editar o quadro de avisos do Dashboard');
    const user = await usuarioAtual();
    const payload = {
      chave: chaveAviso(),
      titulo: String(registro.titulo || 'Avisos do Dashboard').trim() || 'Avisos do Dashboard',
      conteudo: String(registro.conteudo || ''),
      ativo: true,
      atualizado_por: user?.id || null,
    };

    const { data, error } = await db()
      .from('avisos_dashboard')
      .upsert(payload, { onConflict: 'chave' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function obterConfiguracaoSistema(chave) {
    const { data, error } = await db()
      .from('configuracoes_sistema')
      .select('*')
      .eq('chave', chave)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function salvarConfiguracaoSistema(registro = {}) {
    exigirAdmin('editar configurações do sistema');
    const user = await usuarioAtual();
    const payload = {
      chave: String(registro.chave || '').trim(),
      valor: registro.valor == null ? '' : String(registro.valor).trim(),
      atualizado_por: user?.id || null,
    };
    if (!payload.chave) throw new Error('Informe a chave da configuração.');

    const { data, error } = await db()
      .from('configuracoes_sistema')
      .upsert(payload, { onConflict: 'chave' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function listarUsuariosApp() {
    exigirPermissao('gerenciarUsuarios', 'administrar usuários');
    const { data, error } = await db()
      .from('usuarios_app')
      .select('id,nome,email,perfil,ativo,criado_em,atualizado_em')
      .order('nome', { ascending: true, nullsFirst: false })
      .order('email', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data || [];
  }

  async function salvarUsuarioApp(registro) {
    exigirPermissao('gerenciarUsuarios', 'administrar usuários');
    const payload = {
      id: registro.id,
      nome: registro.nome || null,
      email: registro.email,
      perfil: Auth.normalizarPerfil(registro.perfil || 'consulta'),
      ativo: registro.ativo !== false,
    };

    const { data, error } = await db()
      .from('usuarios_app')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function listarAuditoria(filtros = {}) {
    exigirPermissao('verAuditoria', 'consultar auditoria');

    const montarQuery = () => {
      let q = db()
        .from('auditoria_alteracoes')
        .select('*')
        .order('criado_em', { ascending: false });

      if (filtros.tabela) q = q.eq('tabela', filtros.tabela);
      if (filtros.acao) q = q.eq('acao', filtros.acao);
      if (filtros.usuarioId) q = q.eq('usuario_id', filtros.usuarioId);
      if (filtros.dataIni) q = q.gte('criado_em', `${filtros.dataIni}T00:00:00`);
      if (filtros.dataFim) q = q.lte('criado_em', `${filtros.dataFim}T23:59:59`);
      return q;
    };

    if (filtros.todos) {
      const pagina = 1000;
      const limiteTotal = Number(filtros.limite || 20000);
      const acumulado = [];

      for (let inicio = 0; inicio < limiteTotal; inicio += pagina) {
        const fim = Math.min(inicio + pagina - 1, limiteTotal - 1);
        const { data, error } = await montarQuery().range(inicio, fim);
        if (error) throw error;

        const lote = data || [];
        acumulado.push(...lote);
        if (lote.length < pagina) break;
      }

      return acumulado;
    }

    const { data, error } = await montarQuery().limit(filtros.limite || 300);
    if (error) throw error;
    return data || [];
  }

  /* ===================================================================
     Especificações / Limites / Equipamentos — tabelas consultivas.
     Leitura: qualquer usuário ativo. Escrita/exclusão: somente admin.
     =================================================================== */
  function gravarAdmin(tabela, registro) {
    exigirAdmin(registro?.id ? 'editar especificações/equipamentos' : 'criar especificações/equipamentos');
    return (async () => {
      const user = await usuarioAtual();
      const payload = { ...registro, atualizado_por: user?.id || null };
      const id = payload.id;
      let query;
      if (id) {
        delete payload.id;
        query = db().from(tabela).update(payload).eq('id', id);
      } else {
        delete payload.id;
        payload.criado_por = user?.id || null;
        query = db().from(tabela).insert(payload);
      }
      const { data, error } = await query.select().single();
      if (error) throw error;
      return data;
    })();
  }

  async function removerAdmin(tabela, id) {
    exigirAdmin('excluir especificações/equipamentos');
    const { error } = await db().from(tabela).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async function listarEspecDormentes() {
    const { data, error } = await db()
      .from('especificacoes_dormentes')
      .select('*')
      .order('projeto', { ascending: true, nullsFirst: false })
      .order('bitola', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data || [];
  }
  const salvarEspecDormente = (registro) => gravarAdmin('especificacoes_dormentes', registro);
  const removerEspecDormente = (id) => removerAdmin('especificacoes_dormentes', id);

  async function listarEspecSubcomponentes() {
    const { data, error } = await db()
      .from('especificacoes_subcomponentes')
      .select('*')
      .order('subcomponente', { ascending: true, nullsFirst: false })
      .order('caracteristica', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data || [];
  }
  const salvarEspecSubcomponente = (registro) => gravarAdmin('especificacoes_subcomponentes', registro);
  const removerEspecSubcomponente = (id) => removerAdmin('especificacoes_subcomponentes', id);

  async function listarEquipamentos() {
    const { data, error } = await db()
      .from('equipamentos_medicao')
      .select('*')
      .order('data_vencimento', { ascending: true, nullsFirst: false })
      .order('tipo', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data || [];
  }
  const salvarEquipamento = (registro) => gravarAdmin('equipamentos_medicao', registro);
  const removerEquipamento = (id) => removerAdmin('equipamentos_medicao', id);

  async function listarGlossarioDefeitos() {
    const { data, error } = await db()
      .from('glossario_defeitos')
      .select('*')
      .order('criado_em', { ascending: true, nullsFirst: true });
    if (error) throw error;
    return data || [];
  }
  const salvarGlossarioDefeito = (registro) => gravarAdmin('glossario_defeitos', registro);
  const removerGlossarioDefeito = (id) => removerAdmin('glossario_defeitos', id);

  async function listarGlossarioSubcomponentes() {
    const { data, error } = await db()
      .from('glossario_subcomponentes')
      .select('*')
      .order('criado_em', { ascending: true, nullsFirst: true });
    if (error) throw error;
    return data || [];
  }
  const salvarGlossarioSubcomponente = (registro) => gravarAdmin('glossario_subcomponentes', registro);
  const removerGlossarioSubcomponente = (id) => removerAdmin('glossario_subcomponentes', id);

  return {
    perfil,
    usuarioAtual,
    listarProducao,
    salvarProducao,
    removerProducao,
    listarPedidosDormentes,
    salvarPedidoDormente,
    removerPedidoDormente,
    listarReprovados,
    salvarReprovado,
    removerReprovado,
    listarEnsaiosLiberacao,
    salvarEnsaioLiberacao,
    removerEnsaioLiberacao,
    listarEnsaiosAcompanhamento,
    salvarEnsaioAcompanhamento,
    atualizarSerieEnsaioAcompanhamento,
    removerEnsaioAcompanhamento,
    listarEnsaiosBitola,
    salvarEnsaioBitola,
    removerEnsaioBitola,
    listarEnsaiosArrancamentoUsp,
    salvarEnsaioArrancamentoUsp,
    removerEnsaioArrancamentoUsp,
    listarInspecoesConcretagem,
    salvarInspecaoConcretagem,
    removerInspecaoConcretagem,
    listarInspecoesPista,
    salvarInspecaoPista,
    removerInspecaoPista,
    listarRncDormentes,
    salvarRncDormente,
    removerRncDormente,
    obterAvisoDashboard,
    salvarAvisoDashboard,
    obterConfiguracaoSistema,
    salvarConfiguracaoSistema,
    listarUsuariosApp,
    salvarUsuarioApp,
    listarAuditoria,
    listarConfiguracoes,
    listarEspecDormentes,
    salvarEspecDormente,
    removerEspecDormente,
    listarEspecSubcomponentes,
    salvarEspecSubcomponente,
    removerEspecSubcomponente,
    listarEquipamentos,
    salvarEquipamento,
    removerEquipamento,
    listarGlossarioDefeitos,
    salvarGlossarioDefeito,
    removerGlossarioDefeito,
    listarGlossarioSubcomponentes,
    salvarGlossarioSubcomponente,
    removerGlossarioSubcomponente,
  };
})();

window.StoreSupabase = StoreSupabase;
