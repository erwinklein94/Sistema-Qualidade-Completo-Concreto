/* =====================================================================
   SAFETYCULTURE-INTEGRACAO.JS
   Cliente compartilhado para a Edge Function safeculture-sync.
   O token do SafetyCulture nunca passa pelo navegador.
   ===================================================================== */

const SafetyCultureSync = (() => {
  const DESTINOS = [
    ['inspecoes_pista', 'Inspeção de pista'],
    ['inspecoes_concretagem', 'Inspeção de concretagem'],
    ['ensaios_bitola', 'Ensaio de bitola'],
    ['ensaios_arrancamento_usp', 'Ensaio de arrancamento USP'],
    ['ensaios_liberacao', 'Ensaio de liberação'],
    ['ensaios_acompanhamento', 'Ensaio de acompanhamento'],
  ];

  function cliente() {
    const c = window.Auth?.cliente?.();
    if (!c) throw new Error('Supabase não configurado.');
    return c;
  }

  function ehAdmin() {
    return !!window.Auth?.pode?.('gerenciarSistema');
  }

  function controlesTopoHtml() {
    if (!ehAdmin()) return '';
    return `
      <button class="btn btn-safeculture" id="btnSafecultureTopo" type="button" onclick="SafetyCultureSync.sincronizarPagina()">
        ${iconeNuvem()}Sincronizar SafetyCulture
      </button>
      <span class="safeculture-status-topo" data-safeculture-status>Consultando integração...</span>`;
  }

  async function invoke(body) {
    const { data, error } = await cliente().functions.invoke('safeculture-sync', { body });
    if (error) {
      let message = error.message || 'Falha ao chamar a integração SafetyCulture.';
      const response = error.context;
      if (response && typeof response.json === 'function') {
        try {
          const payload = await response.json();
          message = payload?.error || message;
        } catch (_) {}
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function status() {
    return invoke({ action: 'status' });
  }

  async function descobrir() {
    return invoke({ action: 'discover' });
  }

  async function sincronizar(opcoes = {}) {
    return invoke({ action: 'sync', origin: 'manual', ...opcoes });
  }

  async function carregarStatusTopo() {
    const alvos = document.querySelectorAll('[data-safeculture-status]');
    if (!alvos.length || !ehAdmin()) return;
    try {
      const data = await status();
      const ultima = data?.state?.ultima_sincronizacao_ok;
      const texto = data.configured
        ? ultima
          ? `Última sincronização: ${dataHora(ultima)}`
          : 'Token configurado · aguardando primeira sincronização'
        : 'Token ainda não configurado no Supabase';
      alvos.forEach(el => {
        el.textContent = texto;
        el.classList.toggle('erro', !data.configured);
      });
    } catch (err) {
      alvos.forEach(el => {
        el.textContent = mensagemErro(err);
        el.classList.add('erro');
      });
    }
  }

  async function sincronizarPagina() {
    if (!ehAdmin()) {
      App.toast('Somente administradores podem iniciar a sincronização.', 'aviso');
      return;
    }
    const btn = document.getElementById('btnSafecultureTopo');
    const original = btn?.innerHTML;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `${iconeCarregando()}Sincronizando...`;
    }
    try {
      const result = await sincronizar();
      const resumo = `${result.inseridos || 0} novo(s), ${result.atualizados || 0} atualizado(s), ${result.ignorados || 0} ignorado(s)`;
      App.toast(`SafetyCulture sincronizado: ${resumo}.`, result.erros ? 'aviso' : 'sucesso');
      setTimeout(() => location.reload(), 700);
    } catch (err) {
      console.error('Erro na sincronização SafetyCulture', err);
      App.toast(mensagemErro(err), 'erro');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = original || `${iconeNuvem()}Sincronizar SafetyCulture`;
      }
      carregarStatusTopo();
    }
  }

  async function renderAdmin() {
    const statusEl = document.getElementById('safecultureAdminStatus');
    const templatesEl = document.getElementById('safecultureTemplates');
    const historicoEl = document.getElementById('safecultureHistorico');
    if (!statusEl || !templatesEl || !historicoEl || !ehAdmin()) return;

    statusEl.innerHTML = carregando('Consultando a Edge Function e o banco...');
    templatesEl.innerHTML = '';
    historicoEl.innerHTML = '';
    try {
      const data = await status();
      statusEl.innerHTML = statusHtml(data);
      templatesEl.innerHTML = templatesHtml(data.templates || []);
      historicoEl.innerHTML = historicoHtml(data.runs || []);
    } catch (err) {
      statusEl.innerHTML = `<div class="aviso-erro"><strong>Integração indisponível.</strong><br>${esc(mensagemErro(err))}</div>`;
      templatesEl.innerHTML = `<p class="txt-mini txt-cinza">Confirme se a migração e a Edge Function já foram implantadas.</p>`;
    }
  }

  async function testarConexao() {
    return executarBotaoAdmin('btnSafecultureTestar', 'Testando...', async () => {
      const data = await descobrir();
      App.toast(`Conexão confirmada. ${data.total || 0} template(s) encontrado(s).`, 'sucesso');
      await renderAdmin();
    });
  }

  async function sincronizarAdmin(windowHours = 0) {
    return executarBotaoAdmin(
      windowHours ? 'btnSafecultureReprocessar' : 'btnSafecultureSincronizar',
      'Sincronizando...',
      async () => {
        const data = await sincronizar(windowHours ? { origin: 'reprocessamento', window_hours: windowHours } : {});
        App.toast(
          `Sincronização concluída: ${data.inseridos || 0} novo(s), ${data.atualizados || 0} atualizado(s), ${data.erros || 0} erro(s).`,
          data.erros ? 'aviso' : 'sucesso'
        );
        await renderAdmin();
      }
    );
  }

  async function executarBotaoAdmin(id, texto, fn) {
    if (!ehAdmin()) return;
    const btn = document.getElementById(id);
    const original = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.textContent = texto; }
    try {
      await fn();
    } catch (err) {
      console.error('Erro na administração SafetyCulture', err);
      App.toast(mensagemErro(err), 'erro');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = original || 'Tentar novamente'; }
    }
  }

  async function salvarTemplate(templateId) {
    if (!ehAdmin()) return;
    const key = cssKey(templateId);
    const destino = document.getElementById(`scDestino-${key}`)?.value || null;
    const ativo = !!document.getElementById(`scAtivo-${key}`)?.checked;
    const { error } = await cliente()
      .from('safeculture_templates')
      .update({ destino: destino || null, ativo: ativo && !!destino, auto_classificado: false })
      .eq('template_id', templateId);
    if (error) throw error;
    App.toast('Configuração do template salva.');
    await renderAdmin();
  }

  function statusHtml(data) {
    const configured = !!data?.configured;
    const state = data?.state || {};
    const ativo = state.ativo !== false;
    return `
      <div class="safeculture-resumo-grid">
        ${resumoItem('Token da API', configured ? 'Configurado no Supabase' : 'Não configurado', configured ? 'ok' : 'erro')}
        ${resumoItem('Automação', ativo ? 'Ativa' : 'Pausada', ativo ? 'ok' : 'aviso')}
        ${resumoItem('Última sincronização', state.ultima_sincronizacao_ok ? dataHora(state.ultima_sincronizacao_ok) : 'Ainda não executada')}
        ${resumoItem('Pendências', String(data?.pending || 0), data?.pending ? 'aviso' : 'ok')}
      </div>
      ${!configured ? `<div class="aviso-info" style="margin-top:14px"><strong>Falta cadastrar o token.</strong><br>Crie o secret <code>SAFETYCULTURE_API_TOKEN</code> nas Edge Function Secrets do Supabase.</div>` : ''}`;
  }

  function resumoItem(rotulo, valor, estado = '') {
    return `<div class="safeculture-resumo ${estado}"><span>${esc(rotulo)}</span><strong>${esc(valor)}</strong></div>`;
  }

  function templatesHtml(templates) {
    if (!templates.length) {
      return `<div class="vazio compacto"><h3>Nenhum template descoberto</h3><p>Clique em “Testar conexão e descobrir templates”.</p></div>`;
    }
    return `<div class="tabela-wrap"><table class="tabela">
      <thead><tr><th>Template SafetyCulture</th><th>ID</th><th>Destino no site</th><th>Ativo</th><th>Ação</th></tr></thead>
      <tbody>${templates.map(t => {
        const key = cssKey(t.template_id);
        const options = '<option value="">Ignorar / não mapeado</option>' + DESTINOS.map(([value, label]) =>
          `<option value="${value}" ${t.destino === value ? 'selected' : ''}>${esc(label)}</option>`
        ).join('');
        return `<tr>
          <td><strong>${esc(t.nome || 'Sem nome')}</strong>${t.auto_classificado ? '<div class="txt-mini txt-cinza">Classificado automaticamente</div>' : ''}</td>
          <td><code class="safeculture-template-id">${esc(t.template_id)}</code></td>
          <td><select id="scDestino-${key}" class="safeculture-select">${options}</select></td>
          <td><label class="safeculture-switch"><input id="scAtivo-${key}" type="checkbox" ${t.ativo ? 'checked' : ''}><span>Sincronizar</span></label></td>
          <td><button class="btn btn-secundario btn-sm" onclick="SafetyCultureSync.salvarTemplate('${attrJs(t.template_id)}')">Salvar</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  }

  function historicoHtml(runs) {
    if (!runs.length) return '<p class="txt-mini txt-cinza">Nenhuma sincronização registrada.</p>';
    return `<div class="tabela-wrap"><table class="tabela">
      <thead><tr><th>Início</th><th>Origem</th><th>Status</th><th>Encontrados</th><th>Novos</th><th>Atualizados</th><th>Erros</th><th>Mensagem</th></tr></thead>
      <tbody>${runs.map(r => `<tr>
        <td>${esc(dataHora(r.iniciado_em))}</td>
        <td>${esc(rotuloOrigemExecucao(r.origem))}</td>
        <td><span class="badge ${r.status === 'sucesso' ? 'badge-ok' : r.status === 'erro' ? 'badge-reprovado' : 'badge-amarelo'}">${esc(r.status)}</span></td>
        <td>${Number(r.encontrados || 0)}</td><td>${Number(r.inseridos || 0)}</td><td>${Number(r.atualizados || 0)}</td><td>${Number(r.erros || 0)}</td>
        <td>${esc(r.mensagem || '—')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  function origemBadge(registroOuOrigem) {
    const origem = typeof registroOuOrigem === 'object'
      ? registroOuOrigem?.origemDados || registroOuOrigem?.origem_dados
      : registroOuOrigem;
    const key = String(origem || 'manual').toLowerCase();
    if (key === 'safeculture') return '<span class="badge badge-safeculture">SafetyCulture</span>';
    if (key === 'pdf') return '<span class="badge badge-pdf">PDF</span>';
    return '<span class="badge badge-manual">Manual</span>';
  }

  function gerenciadoPelaApi(registro) {
    return String(registro?.origemDados || registro?.origem_dados || '').toLowerCase() === 'safeculture'
      || !!(registro?.safecultureAuditId || registro?.safeculture_audit_id);
  }

  function chaveLote(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\bLOTE\b/gi, '')
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase();
  }

  function chavesRegistroPorLote(registro) {
    const chaves = [];
    const producaoId = String(registro?.producaoLoteId || registro?.producao_lote_id || '').trim();
    const lote = chaveLote(registro?.lote ?? registro?.loteEnsaiado ?? registro?.lote_ensaiado);
    if (producaoId) chaves.push(`producao:${producaoId}`);
    if (lote) chaves.push(`lote:${lote}`);
    return chaves;
  }

  function filtrarDuplicadosPorLote(registros) {
    const lista = Array.isArray(registros) ? registros : [];
    const chavesHistoricas = new Set();
    lista.forEach(registro => {
      if (gerenciadoPelaApi(registro)) return;
      chavesRegistroPorLote(registro).forEach(chave => chavesHistoricas.add(chave));
    });

    const chavesSafetyCultureExibidas = new Set();
    return lista.filter(registro => {
      if (!gerenciadoPelaApi(registro)) return true;
      const chaves = chavesRegistroPorLote(registro);
      if (chaves.some(chave => chavesHistoricas.has(chave))) return false;
      if (chaves.some(chave => chavesSafetyCultureExibidas.has(chave))) return false;
      chaves.forEach(chave => chavesSafetyCultureExibidas.add(chave));
      return true;
    });
  }

  function podeEditarRegistro(registro) {
    return !gerenciadoPelaApi(registro) && !!Auth.pode('editar');
  }

  function podeExcluirRegistro(registro) {
    return !gerenciadoPelaApi(registro) && !!Auth.pode('excluir');
  }

  function bloquearAlteracao(registro) {
    if (!gerenciadoPelaApi(registro)) return false;
    App.toast('Este registro é controlado pelo SafetyCulture. Faça a correção no SafetyCulture e sincronize novamente.', 'aviso');
    return true;
  }

  function carregando(texto) {
    return `<div class="safeculture-carregando"><span class="loader"></span><span>${esc(texto)}</span></div>`;
  }

  function mensagemErro(err) {
    const msg = String(err?.message || err || 'Falha na integração SafetyCulture.');
    if (/Failed to send a request|FunctionsFetchError|fetch/i.test(msg)) {
      return 'Não foi possível chamar a Edge Function. Confirme se safeculture-sync foi implantada no Supabase.';
    }
    if (/SAFETYCULTURE_API_TOKEN/i.test(msg)) {
      return 'O token ainda não foi cadastrado nas Edge Function Secrets do Supabase.';
    }
    if (/relation .*safeculture_|Could not find the table|schema cache/i.test(msg)) {
      return 'As tabelas da integração ainda não existem. Rode a migração 2026-07-16-integracao-safeculture.sql.';
    }
    return msg;
  }

  function dataHora(value) {
    if (!value) return '—';
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleString('pt-BR');
  }

  function rotuloOrigemExecucao(value) {
    if (value === 'cron') return 'Automática';
    if (value === 'reprocessamento') return 'Reconciliação';
    return 'Manual';
  }

  function cssKey(value) {
    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function attrJs(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function iconeNuvem() {
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 17.5a4.5 4.5 0 0 0-1.7-8.67A6 6 0 0 0 6.8 7.5 4.5 4.5 0 0 0 7.5 16H12"/><path d="m15 13-3 3 3 3"/><path d="M12 16h7"/></svg>';
  }

  function iconeCarregando() {
    return '<span class="safeculture-spinner" aria-hidden="true"></span>';
  }

  return {
    controlesTopoHtml,
    carregarStatusTopo,
    sincronizarPagina,
    renderAdmin,
    testarConexao,
    sincronizarAdmin,
    salvarTemplate,
    origemBadge,
    gerenciadoPelaApi,
    filtrarDuplicadosPorLote,
    podeEditarRegistro,
    podeExcluirRegistro,
    bloquearAlteracao,
    status,
    descobrir,
    sincronizar,
  };
})();

window.SafetyCultureSync = SafetyCultureSync;
