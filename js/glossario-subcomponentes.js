/* =====================================================================
   GLOSSÁRIO DE SUBCOMPONENTES — módulo compartilhado (página suspensa).

   Mesma informação visível em duas abas (Medidas e Tolerâncias e Materiais
   Subcomponentes): ambas chamam abrirGlossarioSub() deste arquivo único.
   Leitura: todos os perfis. Criar/editar/excluir: somente admin.
   Foto WEBP gravada como data URL base64 na tabela glossario_subcomponentes.
   O overlay + formulário são injetados via JS, então nenhuma página precisa
   duplicar o markup.
   ===================================================================== */
(function () {
  'use strict';

  let REGISTROS = [];
  let CARREGADO = false;
  let CARREGANDO = false;
  let ERRO = '';
  let imagemAtual = '';

  const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

  function esc(v) { return window.U?.esc ? window.U.esc(v) : String(v == null ? '' : v); }
  function ic(nome) { return window.ICN?.[nome] || ''; }
  function ehAdmin() { return !!(window.Auth?.permissoesAtuais?.().admin); }

  function mensagemErro(err, padrao) {
    const msg = err?.message || err?.details || '';
    if (!msg) return padrao;
    if (/row-level security|violates row-level security/i.test(msg)) return 'Acesso bloqueado pelas regras de segurança do Supabase. Este glossário só pode ser editado por Admin.';
    if (/relation .* does not exist|could not find the table|schema cache/i.test(msg)) return 'Tabela ainda não criada no Supabase. Rode supabase/2026-06-05-glossario-subcomponentes.sql.';
    if (/JWT|token|auth/i.test(msg)) return 'Sessão expirada ou inválida. Saia e faça login novamente.';
    return msg;
  }

  function injetarMarkup() {
    if (document.getElementById('glosSubOverlay')) return;
    const html = `
      <div class="glossario-overlay" id="glosSubOverlay">
        <div class="glossario-painel">
          <div class="glossario-cab">
            <div class="glossario-cab-id">
              <div class="topo-kicker">Rumo · Subcomponentes</div>
              <h2>Glossário de subcomponentes</h2>
              <div class="glossario-sub">Referência visual dos subcomponentes — foto, título e descrição</div>
            </div>
            <div class="glossario-cab-acoes">
              <button class="btn btn-verde" id="btnNovoGlosSub" type="button" onclick="abrirNovoGlosSub()" hidden>Adicionar subcomponente</button>
              <button class="fechar-modal glossario-fechar" type="button" onclick="fecharGlossarioSub()" title="Fechar glossário" aria-label="Fechar glossário">⨯</button>
            </div>
          </div>
          <div class="glossario-corpo" id="glosSubLista"></div>
        </div>
      </div>

      <div class="modal-overlay glossario-form-overlay" id="glosSubForm">
        <div class="modal glossario-form-modal">
          <div class="modal-cab">
            <h2 id="glosSubFormTitulo">Novo subcomponente</h2>
            <button class="fechar-modal" type="button" onclick="fecharFormGlosSub()">⨯</button>
          </div>
          <div class="modal-corpo">
            <form id="formGlosSub" onsubmit="return false">
              <input type="hidden" id="glosSubId">
              <div class="form-grid">
                <div class="form-secao">Subcomponente</div>
                <div class="campo full">
                  <label>Título do subcomponente <span class="obrig">*</span></label>
                  <input id="glosSubTitulo" type="text" maxlength="160" placeholder="Ex.: Palmilha Branca TR68 FAST-CLIP">
                </div>
                <div class="campo full">
                  <label>Descrição</label>
                  <textarea id="glosSubDescricao" rows="4" placeholder="Função, característica visual, ponto de atenção na inspeção..."></textarea>
                </div>

                <div class="form-secao">Foto (WEBP)</div>
                <div class="campo full">
                  <label>Imagem do subcomponente <span class="dica">(formato .webp, até 2 MB)</span></label>
                  <input id="glosSubArquivo" type="file" accept="image/webp" onchange="aoSelecionarFotoGlosSub(event)">
                  <small>A imagem é gravada no banco do Supabase junto com o título e a descrição.</small>
                </div>
                <div class="campo full">
                  <div class="defeito-preview" id="glosSubPreview">
                    <div class="defeito-preview-vazio">Nenhuma imagem selecionada</div>
                  </div>
                </div>
              </div>
              <div class="form-acoes">
                <button type="button" class="btn btn-secundario" onclick="fecharFormGlosSub()">Cancelar</button>
                <button type="button" class="btn btn-primario" onclick="salvarGlosSub()">Salvar subcomponente</button>
              </div>
            </form>
          </div>
        </div>
      </div>`;
    const holder = document.createElement('div');
    holder.innerHTML = html;
    while (holder.firstElementChild) document.body.appendChild(holder.firstElementChild);
  }

  function abrir() {
    injetarMarkup();
    const overlay = document.getElementById('glosSubOverlay');
    if (!overlay) return;
    const btn = document.getElementById('btnNovoGlosSub');
    if (btn) btn.hidden = !ehAdmin();
    overlay.classList.add('aberto');
    document.body.classList.add('glossario-aberto');
    if (!CARREGADO) carregar();
    else render();
  }

  function fechar() {
    fecharForm();
    document.getElementById('glosSubOverlay')?.classList.remove('aberto');
    document.body.classList.remove('glossario-aberto');
  }

  async function carregar() {
    CARREGANDO = true;
    ERRO = '';
    render();
    try {
      const dados = await window.StoreSupabase.listarGlossarioSubcomponentes();
      REGISTROS = (dados || []).map(mapDoBanco);
      CARREGADO = true;
    } catch (err) {
      console.error('Erro ao carregar glossário de subcomponentes', err);
      ERRO = mensagemErro(err, 'Não foi possível carregar o glossário de subcomponentes do Supabase.');
    } finally {
      CARREGANDO = false;
      render();
    }
  }

  function render() {
    const cont = document.getElementById('glosSubLista');
    if (!cont) return;
    const admin = ehAdmin();
    const btn = document.getElementById('btnNovoGlosSub');
    if (btn) btn.hidden = !admin;

    if (CARREGANDO) {
      cont.innerHTML = `<div class="vazio">${ic('vazioBox')}<h3>Carregando glossário</h3><p>Buscando subcomponentes no Supabase...</p></div>`;
      return;
    }
    if (ERRO) {
      cont.innerHTML = `<div class="vazio">${ic('alerta')}<h3>Erro ao carregar</h3><p>${esc(ERRO)}</p>
        <button class="btn btn-secundario" onclick="carregarGlossarioSub()">Tentar novamente</button></div>`;
      return;
    }
    if (!REGISTROS.length) {
      cont.innerHTML = `<div class="vazio">${ic('vazioBox')}<h3>Nenhum subcomponente cadastrado</h3>
        <p>${admin ? 'Use o botão "Adicionar subcomponente" para incluir a primeira foto, título e descrição.' : 'O administrador ainda não cadastrou subcomponentes no glossário.'}</p></div>`;
      return;
    }

    cont.innerHTML = `<div class="defeitos-grid">${REGISTROS.map(d => {
      const img = (d.imagem || '').startsWith('data:image/')
        ? `<img class="defeito-img" src="${d.imagem}" alt="${esc(d.titulo)}" loading="lazy">`
        : `<div class="defeito-img defeito-img-vazia">${ic('vazioBox')}<span>Sem imagem</span></div>`;
      const acoes = admin
        ? `<div class="defeito-acoes">
            <button class="icone-btn" title="Editar" onclick="editarGlosSub('${d.id}')">${ic('edit')}</button>
            <button class="icone-btn del" title="Excluir" onclick="excluirGlosSub('${d.id}')">${ic('del')}</button>
          </div>`
        : '';
      return `<article class="defeito-card">
        ${img}
        <div class="defeito-corpo">
          <div class="defeito-card-topo">
            <h3>${esc(d.titulo || 'Sem título')}</h3>
            ${acoes}
          </div>
          ${d.descricao ? `<p class="defeito-desc">${esc(d.descricao)}</p>` : '<p class="defeito-desc txt-cinza">Sem descrição.</p>'}
        </div>
      </article>`;
    }).join('')}</div>`;
  }

  function abrirNovo() {
    if (!ehAdmin()) { window.App?.toast(window.Auth?.mensagemSemPermissao('cadastrar subcomponentes'), 'aviso'); return; }
    document.getElementById('formGlosSub').reset();
    document.getElementById('glosSubId').value = '';
    imagemAtual = '';
    atualizarPreview();
    document.getElementById('glosSubFormTitulo').textContent = 'Novo subcomponente';
    document.getElementById('glosSubForm').classList.add('aberto');
  }

  function editar(id) {
    if (!ehAdmin()) { window.App?.toast(window.Auth?.mensagemSemPermissao('editar subcomponentes'), 'aviso'); return; }
    const d = REGISTROS.find(x => x.id === id);
    if (!d) return;
    document.getElementById('formGlosSub').reset();
    document.getElementById('glosSubId').value = d.id;
    document.getElementById('glosSubTitulo').value = d.titulo || '';
    document.getElementById('glosSubDescricao').value = d.descricao || '';
    imagemAtual = d.imagem || '';
    atualizarPreview();
    document.getElementById('glosSubFormTitulo').textContent = `Editar subcomponente — ${d.titulo || ''}`;
    document.getElementById('glosSubForm').classList.add('aberto');
  }

  function fecharForm() {
    document.getElementById('glosSubForm')?.classList.remove('aberto');
  }

  function aoSelecionarFoto(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.type !== 'image/webp') {
      window.App?.toast('Selecione um arquivo no formato WEBP (.webp).', 'aviso');
      input.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      window.App?.toast('A imagem WEBP deve ter no máximo 2 MB.', 'aviso');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      imagemAtual = String(reader.result || '');
      atualizarPreview();
    };
    reader.onerror = () => window.App?.toast('Não foi possível ler a imagem selecionada.', 'erro');
    reader.readAsDataURL(file);
  }

  function atualizarPreview() {
    const alvo = document.getElementById('glosSubPreview');
    if (!alvo) return;
    alvo.innerHTML = (imagemAtual || '').startsWith('data:image/')
      ? `<img src="${imagemAtual}" alt="Pré-visualização do subcomponente">`
      : '<div class="defeito-preview-vazio">Nenhuma imagem selecionada</div>';
  }

  async function salvar() {
    if (!ehAdmin()) { window.App?.toast(window.Auth?.mensagemSemPermissao('cadastrar subcomponentes'), 'aviso'); return; }
    const titulo = document.getElementById('glosSubTitulo').value.trim();
    if (!titulo) { window.App?.toast('Informe o título do subcomponente.', 'aviso'); return; }

    const registro = {
      id: document.getElementById('glosSubId').value || undefined,
      titulo,
      descricao: document.getElementById('glosSubDescricao').value.trim() || null,
      imagem: imagemAtual || null,
    };

    const btn = document.querySelector('#glosSubForm .form-acoes .btn-primario');
    const textoOriginal = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando...'; }

    try {
      const salvo = mapDoBanco(await window.StoreSupabase.salvarGlossarioSubcomponente(registro));
      const idx = REGISTROS.findIndex(x => x.id === salvo.id);
      if (idx >= 0) REGISTROS[idx] = salvo;
      else REGISTROS.push(salvo);
      window.App?.toast('Subcomponente salvo no Supabase.');
      fecharForm();
      render();
    } catch (err) {
      console.error('Erro ao salvar subcomponente do glossário', err);
      window.App?.toast(mensagemErro(err, 'Não foi possível salvar o subcomponente no Supabase.'), 'erro');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = textoOriginal || 'Salvar subcomponente'; }
    }
  }

  async function excluir(id) {
    if (!ehAdmin()) { window.App?.toast(window.Auth?.mensagemSemPermissao('excluir subcomponentes'), 'aviso'); return; }
    const d = REGISTROS.find(x => x.id === id);
    if (!d) return;
    if (!window.App?.confirmar(`Excluir o subcomponente "${d.titulo || ''}" do glossário?`)) return;
    try {
      await window.StoreSupabase.removerGlossarioSubcomponente(id);
      REGISTROS = REGISTROS.filter(x => x.id !== id);
      window.App?.toast('Subcomponente excluído do Supabase.', 'aviso');
      render();
    } catch (err) {
      console.error('Erro ao excluir subcomponente do glossário', err);
      window.App?.toast(mensagemErro(err, 'Não foi possível excluir o subcomponente no Supabase.'), 'erro');
    }
  }

  function mapDoBanco(r) {
    return {
      id: r.id,
      titulo: r.titulo || '',
      descricao: r.descricao || '',
      imagem: r.imagem || '',
    };
  }

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (document.getElementById('glosSubForm')?.classList.contains('aberto')) { fecharForm(); return; }
    if (document.getElementById('glosSubOverlay')?.classList.contains('aberto')) fechar();
  });

  // Injeta o markup assim que possível (idempotente).
  if (document.body) injetarMarkup();
  else document.addEventListener('DOMContentLoaded', injetarMarkup);

  // API pública (chamada pelo botão das duas abas e pelos handlers do markup).
  window.abrirGlossarioSub = abrir;
  window.fecharGlossarioSub = fechar;
  window.carregarGlossarioSub = carregar;
  window.abrirNovoGlosSub = abrirNovo;
  window.editarGlosSub = editar;
  window.fecharFormGlosSub = fecharForm;
  window.aoSelecionarFotoGlosSub = aoSelecionarFoto;
  window.salvarGlosSub = salvar;
  window.excluirGlosSub = excluir;
})();
