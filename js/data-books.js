/* =====================================================================
   DATA-BOOKS.JS — Inspeção documental de Data Books no Supabase
   Versão 20260619-documental-v1
   - Zera o modelo antigo de registros por lote e passa a usar inspeção
     documental conforme a planilha "Relatório inspeção - Databook".
   - Os itens ficam no Supabase: public.data_book_inspecoes e
     public.data_book_itens. O JavaScript consulta/edita; não carrega base
     pesada dentro do código.
   ===================================================================== */

const DataBooks = (() => {
  const TABELA_INSPECOES = 'data_book_inspecoes';
  const TABELA_ITENS = 'data_book_itens';
  const MAX_EXPORT_ROWS = 5000;

  const STATUS_OPCOES = ['OK', 'NOK', 'NA', 'PENDENTE'];

  const INSPECAO_CAMPOS = [
    ['data_book_numero', 'Data Book', 'text'],
    ['cliente', 'Cliente', 'text'],
    ['fornecedor', 'Fornecedor', 'text'],
    ['mes_referencia', 'Mês de Referência', 'text'],
    ['periodo_producao', 'Período de Produção', 'text'],
    ['quantidade_dormentes', 'Quantidade de Dormentes', 'number'],
    ['produto', 'Produto', 'textarea'],
    ['modelo', 'Modelo', 'text'],
    ['arquivo_fonte', 'Arquivo Fonte', 'text'],
    ['status_geral', 'Status Geral', 'select'],
    ['observacoes', 'Observações', 'textarea']
  ];

  const ITEM_CAMPOS = [
    ['secao', 'Seção', 'text'],
    ['item_numero', 'Item', 'text'],
    ['campo', 'Campo avaliado', 'textarea'],
    ['ferramenta', 'Ferramenta', 'text'],
    ['tolerancia', 'Tolerância', 'text'],
    ['valor_obtido', 'Valores obtidos', 'textarea'],
    ['status', 'OK/NOK/NA', 'select'],
    ['paginas_origem', 'Página(s) origem', 'text'],
    ['evidencia', 'Evidência', 'textarea'],
    ['observacoes', 'Observações', 'textarea']
  ];

  const SUMMARY_COLUMNS = [
    'secao',
    'item_numero',
    'campo',
    'tolerancia',
    'valor_obtido',
    'status',
    'paginas_origem'
  ];

  const EXPORT_COLUMNS = [
    'data_book_numero',
    'cliente',
    'fornecedor',
    'mes_referencia',
    'periodo_producao',
    'quantidade_dormentes',
    'produto',
    'modelo',
    'arquivo_fonte',
    'status_geral',
    'secao',
    'item_numero',
    'campo',
    'ferramenta',
    'tolerancia',
    'valor_obtido',
    'status',
    'paginas_origem',
    'evidencia',
    'observacoes'
  ];

  const state = {
    inspecoes: [],
    inspecaoAtualId: '',
    inspecaoAtual: null,
    itens: [],
    secoes: [],
    filtros: {
      busca: '',
      secao: '',
      status: ''
    },
    carregando: false,
    debounceBusca: null
  };

  function db() {
    const c = window.Auth?.cliente?.();
    if (!c) throw new Error('Supabase não configurado.');
    return c;
  }

  function admin() {
    return !!window.Auth?.permissoesAtuais?.()?.admin;
  }

  async function init() {
    if (!await Auth.exigirLogin()) return;

    App.montarLayout(
      'ferramenta-databooks',
      'Data books',
      'Inspeção documental dos Data Books conforme planilha padrão — dados salvos no Supabase.'
    );

    if (!admin()) {
      App.acoesTopo('');
      renderBloqueio();
      return;
    }

    App.acoesTopo(`
      <button class="btn btn-primario" type="button" onclick="DataBooks.abrirNovaInspecao()">${ICN.add}<span>Novo data book</span></button>
      <button class="btn btn-secundario" type="button" onclick="DataBooks.abrirNovoItem()">${ICN.add}<span>Novo item</span></button>
      <button class="btn btn-secundario" type="button" onclick="DataBooks.carregar()">Atualizar</button>
      <button class="btn btn-secundario" type="button" onclick="DataBooks.exportarCSV()">${ICN.download}<span>CSV</span></button>
    `);

    renderEstrutura();
    await carregar();
  }

  function renderBloqueio() {
    const page = document.getElementById('paginaDataBooks');
    page.innerHTML = `
      <section class="card acesso-restrito">
        <div class="vazio">
          ${ICN.alerta}
          <h3>Acesso restrito</h3>
          <p>A aba <strong>Data books</strong> só pode ser visualizada por usuários com perfil <strong>admin</strong>.</p>
          <a class="btn btn-secundario" href="index.html">Voltar ao Dashboard</a>
        </div>
      </section>
    `;
  }

  function renderEstrutura() {
    const page = document.getElementById('paginaDataBooks');
    page.innerHTML = `
      <section class="data-books-hero card">
        <div>
          <span class="ferramenta-etiqueta">Ferramentas · Admin</span>
          <h2>Inspeção documental de Data Books</h2>
          <p>Esta tela foi resetada para trabalhar com os campos da planilha padrão. Cada PDF gera uma inspeção e seus itens avaliados ficam no Supabase, não dentro do JavaScript.</p>
        </div>
        <div class="data-books-hero-info">
          <strong>Somente ADMIN</strong>
          <span>Fiscalização e Consulta não visualizam esta aba.</span>
        </div>
      </section>

      <section class="card">
        <div class="card-titulo data-books-card-titulo-flex">
          <div>
            <span class="acento">Data book selecionado</span>
            <span class="card-sub" id="dataBooksStatus">Carregando...</span>
          </div>
          <div class="data-books-paginacao">
            <select id="selectInspecaoDataBook" class="data-books-page-select" onchange="DataBooks.selecionarInspecao(this.value)"></select>
            <button class="btn btn-secundario btn-sm" type="button" onclick="DataBooks.editarInspecaoAtual()">${ICN.edit}<span>Editar cabeçalho</span></button>
          </div>
        </div>
        <div id="dataBookCabecalho" class="data-book-cabecalho"></div>
      </section>

      <section class="grid-kpi data-books-kpis" id="dataBooksKpis"></section>

      <section class="card">
        <div class="card-titulo">
          <span class="acento">Filtros dos itens avaliados</span>
          <span class="card-sub">busca em item, evidência, tolerância e valores obtidos</span>
        </div>
        <div class="barra-filtros data-books-filtros">
          <div class="campo campo-grande">
            <label for="filtroBuscaDataBooks">Buscar</label>
            <input id="filtroBuscaDataBooks" type="search" placeholder="Ex.: cimento, agregado, resistência, página..." oninput="DataBooks.setFiltro('busca', this.value)">
          </div>
          <div class="campo">
            <label for="filtroSecaoDataBooks">Seção</label>
            <select id="filtroSecaoDataBooks" onchange="DataBooks.setFiltro('secao', this.value)"></select>
          </div>
          <div class="campo">
            <label for="filtroStatusDataBooks">Status</label>
            <select id="filtroStatusDataBooks" onchange="DataBooks.setFiltro('status', this.value)">
              <option value="">Todos os status</option>
              ${STATUS_OPCOES.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="campo campo-acoes">
            <label>&nbsp;</label>
            <button class="btn btn-secundario" type="button" onclick="DataBooks.limparFiltros()">Limpar filtros</button>
          </div>
        </div>
      </section>

      <section class="card data-books-card-tabela">
        <div class="card-titulo data-books-card-titulo-flex">
          <div>
            <span class="acento">Itens do Data Book</span>
            <span class="card-sub">campos extraídos conforme a planilha Excel anexada</span>
          </div>
        </div>
        <div class="tabela-wrap data-books-tabela-wrap">
          <table class="tabela tabela-data-books" id="tabelaDataBooks">
            <thead id="theadDataBooks"></thead>
            <tbody id="tbodyDataBooks"></tbody>
          </table>
        </div>
      </section>
    `;
    renderCabecalhoTabela();
  }

  async function carregar() {
    if (!admin()) return;
    state.carregando = true;
    setStatus('Carregando inspeções...');
    renderTabelaCarregando();

    try {
      const { data: inspecoes, error: errInspecoes } = await db()
        .from(TABELA_INSPECOES)
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(100);

      if (errInspecoes) throw errInspecoes;

      state.inspecoes = inspecoes || [];
      if (!state.inspecaoAtualId && state.inspecoes.length) {
        state.inspecaoAtualId = state.inspecoes[0].id;
      }
      if (state.inspecaoAtualId && !state.inspecoes.some(i => i.id === state.inspecaoAtualId)) {
        state.inspecaoAtualId = state.inspecoes[0]?.id || '';
      }

      preencherSelectInspecoes();
      await carregarItens();
      registrarExportacao();
    } catch (err) {
      console.error('Erro ao carregar Data books', err);
      renderErro(err);
    } finally {
      state.carregando = false;
    }
  }

  async function carregarItens() {
    state.inspecaoAtual = state.inspecoes.find(i => i.id === state.inspecaoAtualId) || null;
    renderCabecalhoInspecao();

    if (!state.inspecaoAtualId) {
      state.itens = [];
      state.secoes = [];
      preencherFiltros();
      renderKpis();
      renderTabela();
      setStatus('Nenhum Data Book cadastrado.');
      return;
    }

    setStatus('Carregando itens avaliados...');

    let query = db()
      .from(TABELA_ITENS)
      .select('*')
      .eq('data_book_id', state.inspecaoAtualId)
      .order('ordem', { ascending: true })
      .limit(MAX_EXPORT_ROWS);

    if (state.filtros.secao) query = query.eq('secao', state.filtros.secao);
    if (state.filtros.status) query = query.eq('status', state.filtros.status);

    const busca = normalizarTextoSupabase(state.filtros.busca);
    if (busca) {
      const pattern = `%${busca}%`;
      query = query.or([
        `secao.ilike.${pattern}`,
        `item_numero.ilike.${pattern}`,
        `campo.ilike.${pattern}`,
        `ferramenta.ilike.${pattern}`,
        `tolerancia.ilike.${pattern}`,
        `valor_obtido.ilike.${pattern}`,
        `paginas_origem.ilike.${pattern}`,
        `evidencia.ilike.${pattern}`,
        `observacoes.ilike.${pattern}`
      ].join(','));
    }

    const { data, error } = await query;
    if (error) throw error;

    state.itens = data || [];

    const { data: secoes, error: errSecoes } = await db()
      .from(TABELA_ITENS)
      .select('secao')
      .eq('data_book_id', state.inspecaoAtualId)
      .order('secao', { ascending: true })
      .limit(1000);
    if (!errSecoes) {
      state.secoes = ordenarUnicos((secoes || []).map(r => r.secao));
      preencherFiltros();
    }

    renderKpis();
    renderTabela();
    setStatus(`${state.itens.length} item(ns) encontrado(s) no Data Book selecionado.`);
  }

  function preencherSelectInspecoes() {
    const el = document.getElementById('selectInspecaoDataBook');
    if (!el) return;
    if (!state.inspecoes.length) {
      el.innerHTML = '<option value="">Nenhum Data Book cadastrado</option>';
      return;
    }

    el.innerHTML = state.inspecoes.map(i => {
      const titulo = [
        i.data_book_numero || 'Data Book sem número',
        i.fornecedor || '',
        i.mes_referencia || ''
      ].filter(Boolean).join(' · ');
      return `<option value="${U.esc(i.id)}" ${i.id === state.inspecaoAtualId ? 'selected' : ''}>${U.esc(titulo)}</option>`;
    }).join('');
  }

  function selecionarInspecao(id) {
    state.inspecaoAtualId = String(id || '');
    limparFiltros(false);
    carregarItens().catch(err => {
      console.error('Erro ao selecionar inspeção', err);
      App.toast('Não foi possível abrir o Data Book selecionado.', 'erro');
    });
  }

  function renderCabecalhoInspecao() {
    const alvo = document.getElementById('dataBookCabecalho');
    if (!alvo) return;

    const r = state.inspecaoAtual;
    if (!r) {
      alvo.innerHTML = `
        <div class="vazio compacto">
          ${ICN.vazioBox}
          <h3>Nenhum Data Book no Supabase</h3>
          <p>Rode o SQL de reset/carga ou cadastre um novo Data Book.</p>
        </div>
      `;
      return;
    }

    alvo.innerHTML = `
      <div class="data-book-cabecalho-grid">
        ${cabItem('Data Book', r.data_book_numero)}
        ${cabItem('Fornecedor', r.fornecedor)}
        ${cabItem('Cliente', r.cliente)}
        ${cabItem('Mês', r.mes_referencia)}
        ${cabItem('Período', r.periodo_producao)}
        ${cabItem('Quantidade', r.quantidade_dormentes ? `${r.quantidade_dormentes} dormentes` : '—')}
        ${cabItem('Modelo', r.modelo)}
        ${cabItem('Status geral', statusBadge(r.status_geral))}
        ${cabItem('Arquivo fonte', r.arquivo_fonte)}
      </div>
      ${r.produto ? `<p class="data-book-produto"><strong>Produto:</strong> ${U.esc(r.produto)}</p>` : ''}
      ${r.observacoes ? `<p class="data-book-produto"><strong>Observações:</strong> ${U.esc(r.observacoes)}</p>` : ''}
    `;
  }

  function cabItem(label, valor) {
    return `
      <div class="data-book-cab-item">
        <span>${U.esc(label)}</span>
        <strong>${typeof valor === 'string' && valor.includes('status-badge') ? valor : U.esc(valor || '—')}</strong>
      </div>
    `;
  }

  function preencherFiltros() {
    setOptions('filtroSecaoDataBooks', state.secoes, 'Todas as seções', state.filtros.secao);
    const status = document.getElementById('filtroStatusDataBooks');
    if (status) status.value = state.filtros.status || '';
  }

  function setOptions(id, arr, placeholder, selecionado) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<option value="">${U.esc(placeholder)}</option>` + arr.map(v => `<option value="${U.esc(v)}" ${v === selecionado ? 'selected' : ''}>${U.esc(v)}</option>`).join('');
  }

  function ordenarUnicos(arr) {
    return [...new Set((arr || []).map(v => String(v || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  }

  function setFiltro(campo, valor) {
    state.filtros[campo] = String(valor || '').trim();
    if (campo === 'busca') {
      clearTimeout(state.debounceBusca);
      state.debounceBusca = setTimeout(() => carregarItens(), 280);
      return;
    }
    carregarItens();
  }

  function limparFiltros(recarregar = true) {
    state.filtros = { busca: '', secao: '', status: '' };
    const busca = document.getElementById('filtroBuscaDataBooks');
    if (busca) busca.value = '';
    preencherFiltros();
    if (recarregar) carregarItens();
  }

  function normalizarTextoSupabase(v) {
    return String(v || '')
      .trim()
      .replace(/[,%]/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 100);
  }

  function renderKpis() {
    const alvo = document.getElementById('dataBooksKpis');
    if (!alvo) return;
    const lista = state.itens;
    const ok = lista.filter(r => r.status === 'OK').length;
    const nok = lista.filter(r => r.status === 'NOK').length;
    const na = lista.filter(r => r.status === 'NA').length;
    const pendente = lista.filter(r => r.status === 'PENDENTE').length;
    const avaliados = ok + nok;

    alvo.innerHTML = `
      <article class="kpi"><span>Itens encontrados</span><strong>${lista.length}</strong><small>conforme filtros</small></article>
      <article class="kpi"><span>Avaliados</span><strong>${avaliados}</strong><small>OK + NOK</small></article>
      <article class="kpi"><span>OK</span><strong>${ok}</strong><small>atendem à tolerância</small></article>
      <article class="kpi"><span>NOK</span><strong>${nok}</strong><small>fora da tolerância</small></article>
      <article class="kpi"><span>NA / Pendente</span><strong>${na + pendente}</strong><small>não avaliado ou pendente</small></article>
    `;
  }

  function renderCabecalhoTabela() {
    const thead = document.getElementById('theadDataBooks');
    if (!thead) return;
    thead.innerHTML = `
      <tr>
        ${SUMMARY_COLUMNS.map(k => `<th>${U.esc(labelDeItem(k))}</th>`).join('')}
        <th>Ações</th>
      </tr>
    `;
  }

  function renderTabelaCarregando() {
    const tbody = document.getElementById('tbodyDataBooks');
    if (!tbody) return;
    tbody.innerHTML = `
      <tr>
        <td colspan="${SUMMARY_COLUMNS.length + 1}">
          <div class="vazio compacto"><div class="loader"></div><h3>Carregando...</h3></div>
        </td>
      </tr>
    `;
  }

  function renderTabela() {
    const tbody = document.getElementById('tbodyDataBooks');
    if (!tbody) return;

    if (!state.itens.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${SUMMARY_COLUMNS.length + 1}">
            <div class="vazio">
              ${ICN.vazioBox}
              <h3>Nenhum item encontrado</h3>
              <p>Rode o SQL de carga, selecione outro Data Book ou ajuste os filtros.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = state.itens.map(r => `
      <tr class="${r.status === 'NOK' ? 'linha-alerta' : ''}">
        ${SUMMARY_COLUMNS.map(k => `<td>${valorTabela(r, k)}</td>`).join('')}
        <td class="acoes-linha">
          <button class="btn btn-secundario btn-sm" type="button" onclick="DataBooks.verItem('${r.id}')">${ICN.olho}<span>Ver</span></button>
          <button class="btn btn-secundario btn-sm" type="button" onclick="DataBooks.editarItem('${r.id}')">${ICN.edit}<span>Editar</span></button>
          <button class="btn btn-perigo btn-sm" type="button" onclick="DataBooks.excluirItem('${r.id}')">${ICN.del}<span>Excluir</span></button>
        </td>
      </tr>
    `).join('');
  }

  function valorTabela(r, key) {
    if (key === 'status') return statusBadge(r[key]);
    if (key === 'campo') return `<span class="data-book-campo">${U.esc(r[key] || '—')}</span>`;
    if (key === 'valor_obtido') return `<span class="data-book-valor">${U.esc(r[key] || '—')}</span>`;
    if (key === 'paginas_origem') return `<span class="nowrap">${U.esc(r[key] || '—')}</span>`;
    return U.esc(r[key] || '—');
  }

  function statusBadge(status) {
    const s = String(status || 'PENDENTE').toUpperCase();
    const cls = s === 'OK' ? 'ok' : s === 'NOK' ? 'nok' : s === 'NA' ? 'na' : 'pendente';
    return `<span class="status-badge status-badge-${cls}">${U.esc(s)}</span>`;
  }

  function labelDeItem(key) {
    return ITEM_CAMPOS.find(c => c[0] === key)?.[1] || key;
  }

  function labelDeInspecao(key) {
    return INSPECAO_CAMPOS.find(c => c[0] === key)?.[1] || key;
  }

  function setStatus(txt) {
    const el = document.getElementById('dataBooksStatus');
    if (el) el.textContent = txt || '';
  }

  function renderErro(err) {
    const tbody = document.getElementById('tbodyDataBooks');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${SUMMARY_COLUMNS.length + 1}">
            <div class="vazio">
              ${ICN.alerta}
              <h3>Não foi possível carregar a área de Data Books</h3>
              <p>${U.esc(err?.message || 'Erro desconhecido')}</p>
              <p>Confirme se você rodou o SQL <strong>supabase/2026-06-19-data-books-documental-reset-e-carga.sql</strong> no Supabase.</p>
            </div>
          </td>
        </tr>
      `;
    }
    setStatus('Erro ao carregar.');
    App.toast('Erro ao carregar Data books.', 'erro');
  }

  function obterItem(id) {
    return state.itens.find(r => r.id === id) || null;
  }

  async function buscarItem(id) {
    const { data, error } = await db().from(TABELA_ITENS).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  function abrirNovaInspecao() {
    abrirFormularioInspecao();
  }

  function editarInspecaoAtual() {
    if (!state.inspecaoAtual) {
      App.toast('Nenhum Data Book selecionado para editar.', 'aviso');
      return;
    }
    abrirFormularioInspecao(state.inspecaoAtual);
  }

  function abrirFormularioInspecao(registro = null) {
    if (!admin()) return App.toast('Apenas ADMIN pode alterar Data books.', 'erro');

    const modal = document.getElementById('modalDataBook');
    if (!modal) return;
    const titulo = registro?.id ? `Editar cabeçalho — ${U.esc(registro.data_book_numero || '')}` : 'Novo Data Book';

    modal.innerHTML = `
      <div class="modal modal-data-book" role="dialog" aria-modal="true" aria-labelledby="modalDataBookTitulo">
        <div class="modal-cab">
          <h2 id="modalDataBookTitulo">${titulo}</h2>
          <button class="btn btn-secundario btn-sm" type="button" onclick="DataBooks.fecharFormulario()">${ICN.fechar}<span>Fechar</span></button>
        </div>
        <form class="modal-corpo data-books-form" id="formDataBookInspecao" onsubmit="DataBooks.salvarInspecao(event)">
          <input type="hidden" name="id" value="${U.esc(registro?.id || '')}">
          <fieldset class="data-books-fieldset">
            <legend>Identificação do Data Book</legend>
            <div class="form-grid">
              ${INSPECAO_CAMPOS.map(([key, label, type]) => campoForm(key, label, type, registro)).join('')}
            </div>
          </fieldset>
          <div class="modal-acoes">
            <button class="btn btn-secundario" type="button" onclick="DataBooks.fecharFormulario()">Cancelar</button>
            <button class="btn btn-primario" type="submit">${ICN.check}<span>Salvar Data Book</span></button>
          </div>
        </form>
      </div>
    `;
    modal.classList.add('aberto');
    modal.setAttribute('aria-hidden', 'false');
  }

  async function salvarInspecao(ev) {
    ev.preventDefault();
    if (!admin()) return App.toast('Apenas ADMIN pode salvar Data books.', 'erro');

    const form = ev.currentTarget;
    const fd = new FormData(form);
    const id = String(fd.get('id') || '').trim();
    const payload = {};
    INSPECAO_CAMPOS.forEach(([key]) => {
      payload[key] = limparValor(fd.get(key));
    });
    if (payload.quantidade_dormentes) payload.quantidade_dormentes = Number(payload.quantidade_dormentes) || null;

    if (!payload.data_book_numero || !payload.fornecedor) {
      App.toast('Preencha Data Book e Fornecedor.', 'erro');
      return;
    }

    try {
      let query;
      if (id) query = db().from(TABELA_INSPECOES).update(payload).eq('id', id);
      else query = db().from(TABELA_INSPECOES).insert(payload);
      const { data, error } = await query.select().single();
      if (error) throw error;

      fecharFormulario();
      state.inspecaoAtualId = data.id;
      App.toast('Data Book salvo no Supabase.', 'sucesso');
      window.FestaHexa?.celebrar();
      await carregar();
    } catch (err) {
      console.error('Erro ao salvar inspeção de Data Book', err);
      App.toast(err?.message || 'Não foi possível salvar o Data Book.', 'erro');
    }
  }

  function abrirNovoItem() {
    if (!state.inspecaoAtualId) {
      App.toast('Cadastre ou selecione um Data Book antes de criar itens.', 'aviso');
      return;
    }
    abrirFormularioItem({ status: 'PENDENTE' });
  }

  async function editarItem(id) {
    try {
      const r = await buscarItem(id);
      abrirFormularioItem(r);
    } catch (err) {
      console.error('Erro ao abrir item', err);
      App.toast('Item não encontrado ou indisponível.', 'erro');
    }
  }

  function abrirFormularioItem(registro = null) {
    if (!admin()) return App.toast('Apenas ADMIN pode alterar Data books.', 'erro');
    if (!state.inspecaoAtualId) return App.toast('Selecione um Data Book primeiro.', 'aviso');

    const modal = document.getElementById('modalDataBook');
    if (!modal) return;
    const titulo = registro?.id ? `Editar item — ${U.esc(registro.item_numero || '')}` : 'Novo item do Data Book';

    modal.innerHTML = `
      <div class="modal modal-data-book" role="dialog" aria-modal="true" aria-labelledby="modalDataBookTitulo">
        <div class="modal-cab">
          <h2 id="modalDataBookTitulo">${titulo}</h2>
          <button class="btn btn-secundario btn-sm" type="button" onclick="DataBooks.fecharFormulario()">${ICN.fechar}<span>Fechar</span></button>
        </div>
        <form class="modal-corpo data-books-form" id="formDataBookItem" onsubmit="DataBooks.salvarItem(event)">
          <input type="hidden" name="id" value="${U.esc(registro?.id || '')}">
          <fieldset class="data-books-fieldset">
            <legend>Item avaliado</legend>
            <div class="form-grid">
              ${ITEM_CAMPOS.map(([key, label, type]) => campoForm(key, label, type, registro)).join('')}
            </div>
          </fieldset>
          <div class="modal-acoes">
            <button class="btn btn-secundario" type="button" onclick="DataBooks.fecharFormulario()">Cancelar</button>
            <button class="btn btn-primario" type="submit">${ICN.check}<span>Salvar item</span></button>
          </div>
        </form>
      </div>
    `;
    modal.classList.add('aberto');
    modal.setAttribute('aria-hidden', 'false');
  }

  async function salvarItem(ev) {
    ev.preventDefault();
    if (!admin()) return App.toast('Apenas ADMIN pode salvar itens.', 'erro');

    const form = ev.currentTarget;
    const fd = new FormData(form);
    const id = String(fd.get('id') || '').trim();
    const payload = { data_book_id: state.inspecaoAtualId };
    ITEM_CAMPOS.forEach(([key]) => {
      payload[key] = limparValor(fd.get(key));
    });

    if (!payload.secao || !payload.campo) {
      App.toast('Preencha Seção e Campo avaliado.', 'erro');
      return;
    }

    try {
      let query;
      if (id) query = db().from(TABELA_ITENS).update(payload).eq('id', id);
      else query = db().from(TABELA_ITENS).insert(payload);
      const { error } = await query.select().single();
      if (error) throw error;

      fecharFormulario();
      App.toast('Item salvo no Supabase.', 'sucesso');
      await carregarItens();
    } catch (err) {
      console.error('Erro ao salvar item do Data Book', err);
      App.toast(err?.message || 'Não foi possível salvar o item.', 'erro');
    }
  }

  function campoForm(key, label, type, registro) {
    const valor = registro?.[key] || '';
    const required = ['data_book_numero', 'fornecedor', 'secao', 'campo'].includes(key) ? 'required' : '';
    const classe = type === 'textarea' ? 'campo campo-full' : 'campo';

    if (type === 'textarea') {
      return `
        <div class="${classe}">
          <label for="db_${key}">${U.esc(label)}</label>
          <textarea id="db_${key}" name="${key}" rows="3" ${required}>${U.esc(valor)}</textarea>
        </div>
      `;
    }

    if (type === 'select') {
      const atual = String(valor || (key === 'status' ? 'PENDENTE' : 'OK')).toUpperCase();
      return `
        <div class="${classe}">
          <label for="db_${key}">${U.esc(label)}</label>
          <select id="db_${key}" name="${key}" ${required}>
            ${STATUS_OPCOES.map(s => `<option value="${s}" ${s === atual ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      `;
    }

    return `
      <div class="${classe}">
        <label for="db_${key}">${U.esc(label)}</label>
        <input id="db_${key}" name="${key}" type="${type}" value="${U.esc(valor)}" ${required}>
      </div>
    `;
  }

  function fecharFormulario() {
    const modal = document.getElementById('modalDataBook');
    if (!modal) return;
    modal.classList.remove('aberto');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = '';
  }

  function limparValor(v) {
    const s = String(v == null ? '' : v).trim();
    return s || null;
  }

  async function excluirItem(id) {
    if (!admin()) return App.toast('Apenas ADMIN pode excluir itens.', 'erro');
    const r = obterItem(id) || { item_numero: '' };
    if (!App.confirmar(`Excluir o item ${r.item_numero || 'sem número'} do Data Book? Essa ação será auditada.`)) return;

    try {
      const { error } = await db().from(TABELA_ITENS).delete().eq('id', id);
      if (error) throw error;
      App.toast('Item excluído.', 'sucesso');
      await carregarItens();
    } catch (err) {
      console.error('Erro ao excluir item', err);
      App.toast(err?.message || 'Não foi possível excluir o item.', 'erro');
    }
  }

  async function verItem(id) {
    try {
      const r = await buscarItem(id);
      abrirDetalheItem(r);
    } catch (err) {
      console.error('Erro ao abrir detalhe', err);
      App.toast('Não foi possível abrir os detalhes deste item.', 'erro');
    }
  }

  function abrirDetalheItem(r) {
    const modal = document.getElementById('modalDetalheDataBook');
    if (!modal) return;

    const campos = [
      ['Seção', r.secao],
      ['Item', r.item_numero],
      ['Campo avaliado', r.campo],
      ['Ferramenta', r.ferramenta],
      ['Tolerância', r.tolerancia],
      ['Valores obtidos', r.valor_obtido],
      ['Status', statusBadge(r.status)],
      ['Página(s) origem', r.paginas_origem],
      ['Evidência', r.evidencia],
      ['Observações', r.observacoes]
    ];

    modal.innerHTML = `
      <div class="modal modal-data-book modal-data-book-detalhe" role="dialog" aria-modal="true" aria-labelledby="modalDetalheDataBookTitulo">
        <div class="modal-cab">
          <h2 id="modalDetalheDataBookTitulo">Item do Data Book — ${U.esc(r.item_numero || '—')}</h2>
          <button class="btn btn-secundario btn-sm" type="button" onclick="DataBooks.fecharDetalhe()">${ICN.fechar}<span>Fechar</span></button>
        </div>
        <div class="modal-corpo">
          <div class="data-books-detalhes">
            <section class="data-books-detalhe-grupo">
              <h3>Detalhes da extração</h3>
              <dl>
                ${campos.map(([label, valor]) => `
                  <div>
                    <dt>${U.esc(label)}</dt>
                    <dd>${typeof valor === 'string' && valor.includes('status-badge') ? valor : U.esc(valor || '—')}</dd>
                  </div>
                `).join('')}
              </dl>
            </section>
          </div>
          <div class="modal-acoes">
            <button class="btn btn-secundario" type="button" onclick="DataBooks.fecharDetalhe()">Fechar</button>
            <button class="btn btn-primario" type="button" onclick="DataBooks.fecharDetalhe(); DataBooks.editarItem('${r.id}')">${ICN.edit}<span>Editar</span></button>
          </div>
        </div>
      </div>
    `;
    modal.classList.add('aberto');
    modal.setAttribute('aria-hidden', 'false');
  }

  function fecharDetalhe() {
    const modal = document.getElementById('modalDetalheDataBook');
    if (!modal) return;
    modal.classList.remove('aberto');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = '';
  }

  function registrarExportacao() {
    if (!window.Exportacoes?.registrar) return;
    const columns = EXPORT_COLUMNS.map(k => ({ key: k, label: labelExport(k) }));
    const ins = state.inspecaoAtual || {};
    Exportacoes.registrar({
      titulo: 'Inspeção documental de Data Book',
      nomeArquivo: 'inspecao-documental-data-book',
      xlsxSomenteDados: true,
      filtros: filtrosExportacao(),
      secoes: [{
        titulo: ins.data_book_numero || 'Data Book',
        columns,
        rows: state.itens.map(item => linhaExport(ins, item))
      }],
      observacao: 'Fonte: tabelas public.data_book_inspecoes e public.data_book_itens no Supabase.'
    });
  }

  function filtrosExportacao() {
    return [
      { campo: 'Data Book', valor: state.inspecaoAtual?.data_book_numero || 'Nenhum' },
      { campo: 'Busca', valor: state.filtros.busca || 'Todos' },
      { campo: 'Seção', valor: state.filtros.secao || 'Todas' },
      { campo: 'Status', valor: state.filtros.status || 'Todos' }
    ];
  }

  function linhaExport(ins, item) {
    return {
      data_book_numero: ins.data_book_numero || '',
      cliente: ins.cliente || '',
      fornecedor: ins.fornecedor || '',
      mes_referencia: ins.mes_referencia || '',
      periodo_producao: ins.periodo_producao || '',
      quantidade_dormentes: ins.quantidade_dormentes || '',
      produto: ins.produto || '',
      modelo: ins.modelo || '',
      arquivo_fonte: ins.arquivo_fonte || '',
      status_geral: ins.status_geral || '',
      secao: item.secao || '',
      item_numero: item.item_numero || '',
      campo: item.campo || '',
      ferramenta: item.ferramenta || '',
      tolerancia: item.tolerancia || '',
      valor_obtido: item.valor_obtido || '',
      status: item.status || '',
      paginas_origem: item.paginas_origem || '',
      evidencia: item.evidencia || '',
      observacoes: item.observacoes || ''
    };
  }

  function labelExport(key) {
    const fromItem = ITEM_CAMPOS.find(c => c[0] === key)?.[1];
    const fromIns = INSPECAO_CAMPOS.find(c => c[0] === key)?.[1];
    return fromItem || fromIns || key;
  }

  async function exportarCSV() {
    try {
      if (!state.inspecaoAtualId) {
        App.toast('Nenhum Data Book selecionado para exportar.', 'aviso');
        return;
      }

      setStatus('Gerando CSV dos itens filtrados...');
      const ins = state.inspecaoAtual || {};
      const headers = EXPORT_COLUMNS.map(labelExport);
      const linhas = state.itens.map(item => EXPORT_COLUMNS.map(k => linhaExport(ins, item)[k] || ''));
      const csv = [headers, ...linhas].map(row => row.map(csvCell).join(';')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      baixar(blob, `data_book_documental_${stamp()}.csv`);
      App.toast(`CSV gerado com ${state.itens.length} item(ns).`, 'sucesso');
    } catch (err) {
      console.error('Erro ao exportar CSV', err);
      App.toast(err?.message || 'Não foi possível gerar o CSV.', 'erro');
    } finally {
      setStatus(`${state.itens.length} item(ns) encontrado(s) no Data Book selecionado.`);
    }
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return `"${s.replace(/"/g, '""')}"`;
  }

  function baixar(blob, nome) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function stamp() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
  }

  return {
    init,
    carregar,
    selecionarInspecao,
    setFiltro,
    limparFiltros,
    abrirNovaInspecao,
    editarInspecaoAtual,
    salvarInspecao,
    abrirNovoItem,
    editarItem,
    verItem,
    fecharDetalhe,
    excluirItem,
    salvarItem,
    fecharFormulario,
    exportarCSV
  };
})();

window.DataBooks = DataBooks;

document.addEventListener('DOMContentLoaded', DataBooks.init);
