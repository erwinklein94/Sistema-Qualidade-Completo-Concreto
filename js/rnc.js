/* =====================================================================
   RNC.JS — Quadros de aviso de não conformidade dos dormentes de concreto
   ===================================================================== */
'use strict';

let RNC_REGISTROS = [];
let RNC_CARREGANDO = false;
let RNC_ERRO = '';
let RNC_EDIT_ID = '';

const RNC = {
  esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  dataHoraBR(iso) {
    if (!iso) return '';
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return String(iso || '');
    return dt.toLocaleString('pt-BR');
  },
  isAdmin() {
    return window.Auth?.pode?.('gerenciarSistema') || window.Auth?.permissoesAtuais?.()?.admin || false;
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;

  App.montarLayout('rncDormentes', 'RNC', 'Quadro de não conformidades de dormentes de concreto');
  configurarAcoesTopo();
  renderRnc();
  await carregarRnc();
});

function configurarAcoesTopo() {
  const add = window.ICN?.add || '+';
  const check = window.ICN?.check || '';
  const html = `${RNC.isAdmin()
    ? `<button class="btn btn-primario btn-sm" type="button" onclick="abrirRnc()">${add}<span>Novo quadro de aviso</span></button>`
    : App.avisoModoConsulta()}
    <button class="btn btn-secundario btn-sm" type="button" onclick="carregarRnc()">${check}<span>Atualizar</span></button>`;
  App.acoesTopo(html);
}

async function carregarRnc() {
  RNC_CARREGANDO = true;
  RNC_ERRO = '';
  renderRnc();

  try {
    RNC_REGISTROS = (await StoreSupabase.listarRncDormentes({ limite: 10000 })).map(mapRncDoBanco);
  } catch (err) {
    console.error('Erro ao carregar RNC de dormentes:', err);
    RNC_ERRO = mensagemErroBanco(err, 'Não foi possível carregar a RNC de dormentes do Supabase.');
  } finally {
    RNC_CARREGANDO = false;
    configurarAcoesTopo();
    renderRnc();
  }
}

function mapRncDoBanco(r = {}) {
  return {
    id: r.id || '',
    titulo: r.titulo || 'Não conformidade',
    conteudo: r.conteudo || '',
    criadoEm: r.criado_em || '',
    atualizadoEm: r.atualizado_em || '',
    criadoPor: r.criado_por || '',
    atualizadoPor: r.atualizado_por || '',
  };
}

function renderRnc() {
  const page = document.getElementById('rncPage');
  if (!page) return;

  if (RNC_CARREGANDO) {
    page.innerHTML = `<div class="vazio"><div class="loader"></div><h3>Carregando RNC</h3><p>Buscando quadros de aviso no Supabase.</p></div>`;
    return;
  }

  if (RNC_ERRO) {
    page.innerHTML = `<div class="card aviso-erro">
      <div class="card-titulo"><span class="acento">Erro ao carregar RNC</span></div>
      <p>${RNC.esc(RNC_ERRO)}</p>
      <p class="txt-mini txt-cinza">Confira se a tabela <strong>rnc_dormentes</strong> foi criada no Supabase pelo SQL enviado no projeto.</p>
      <button class="btn btn-secundario" type="button" onclick="carregarRnc()">Tentar novamente</button>
    </div>`;
    return;
  }

  const registros = [...RNC_REGISTROS].sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));
  const corpo = registros.length
    ? `<div class="subcards rnc-quadros">${registros.map(rncCard).join('')}</div>`
    : `<div class="vazio"><h3>Nenhuma não conformidade registrada</h3><p>Não há quadros de aviso publicados no momento.</p></div>`;

  page.innerHTML = `
    <div class="toolbar toolbar-contador"><div class="contador">${registros.length.toLocaleString('pt-BR')} quadro(s) de aviso</div></div>
    ${corpo}`;
}

function rncCard(c) {
  const conteudo = String(c.conteudo || '').trim();
  const corpo = conteudo ? RNC.esc(conteudo).replace(/\n/g, '<br>') : '<span class="rnc-vazio">Sem descrição.</span>';
  const atualizado = c.atualizadoEm ? RNC.dataHoraBR(c.atualizadoEm) : '';
  const acoes = RNC.isAdmin()
    ? `<div class="rnc-acoes"><button class="icone-btn" title="Editar" onclick="abrirRnc('${RNC.esc(c.id)}')">✎</button><button class="icone-btn del" title="Excluir" onclick="excluirRnc('${RNC.esc(c.id)}')">🗑</button></div>`
    : '';

  return `<div class="subcard nc rnc-quadro">
    <div class="rnc-quadro-cab"><h3>${RNC.esc(c.titulo || 'Não conformidade')}</h3>${acoes}</div>
    <div class="rnc-quadro-corpo">${corpo}</div>
    ${atualizado ? `<div class="meta">Atualizado em ${RNC.esc(atualizado)}</div>` : ''}
  </div>`;
}

function abrirRnc(id = '') {
  if (!RNC.isAdmin()) {
    App.toast('Somente o administrador pode editar a RNC.', 'erro');
    return;
  }
  RNC_EDIT_ID = id || '';
  const r = RNC_REGISTROS.find((x) => x.id === id) || { titulo: '', conteudo: '' };
  document.getElementById('rncModalTitulo').textContent = id ? 'Editar quadro de aviso' : 'Novo quadro de aviso';
  document.getElementById('rncFormCorpo').innerHTML = `
    <div class="form-grid">
      <div class="campo"><label>Título *</label><input id="rncTitulo" type="text" required maxlength="160" value="${RNC.esc(r.titulo)}" placeholder="Ex.: RNC 001 — Trinca no lote 1234"></div>
      <div class="campo full"><label>Não conformidade *</label><textarea id="rncConteudo" rows="7" required placeholder="Descreva a não conformidade registrada para o dormente de concreto...">${RNC.esc(r.conteudo)}</textarea></div>
    </div>
    <div class="form-acoes">
      <button class="btn btn-secundario" type="button" onclick="fecharRnc()">Cancelar</button>
      <button class="btn btn-primario" type="submit">Salvar</button>
    </div>`;
  document.getElementById('rncModal').classList.add('aberto');
  setTimeout(() => document.getElementById('rncTitulo')?.focus(), 0);
}

function fecharRnc() {
  RNC_EDIT_ID = '';
  const modal = document.getElementById('rncModal');
  modal?.classList.remove('aberto');
  const corpo = document.getElementById('rncFormCorpo');
  if (corpo) corpo.innerHTML = '';
}

async function salvarRnc(ev) {
  ev.preventDefault();
  if (!RNC.isAdmin()) {
    App.toast('Somente o administrador pode editar a RNC.', 'erro');
    return;
  }

  const titulo = document.getElementById('rncTitulo')?.value.trim() || '';
  const conteudo = document.getElementById('rncConteudo')?.value.trim() || '';
  if (!titulo) { App.toast('Informe o título da RNC.', 'aviso'); return; }
  if (!conteudo) { App.toast('Descreva a não conformidade.', 'aviso'); return; }

  const btn = document.querySelector('#rncForm button[type="submit"]');
  const textoOriginal = btn?.innerHTML || 'Salvar';
  if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando...'; }

  try {
    const editando = !!RNC_EDIT_ID;
    const salvo = mapRncDoBanco(await StoreSupabase.salvarRncDormente({
      id: RNC_EDIT_ID || undefined,
      titulo,
      conteudo,
    }));

    const idx = RNC_REGISTROS.findIndex((x) => x.id === salvo.id);
    if (idx >= 0) RNC_REGISTROS[idx] = salvo;
    else RNC_REGISTROS.push(salvo);

    fecharRnc();
    renderRnc();
    App.toast(editando ? 'RNC atualizada no Supabase.' : 'RNC cadastrada no Supabase.');
    await carregarRnc();
  } catch (err) {
    console.error('Erro ao salvar RNC de dormentes:', err);
    App.toast(mensagemErroBanco(err, 'Não foi possível salvar a RNC no Supabase.'), 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = textoOriginal; }
  }
}

async function excluirRnc(id) {
  if (!RNC.isAdmin()) {
    App.toast('Somente o administrador pode excluir a RNC.', 'erro');
    return;
  }
  const r = RNC_REGISTROS.find((x) => x.id === id);
  if (!r) return;
  if (!App.confirmar(`Excluir o quadro "${r.titulo || 'Não conformidade'}"? Esta ação não pode ser desfeita.`)) return;

  try {
    await StoreSupabase.removerRncDormente(id);
    RNC_REGISTROS = RNC_REGISTROS.filter((x) => x.id !== id);
    renderRnc();
    App.toast('RNC excluída do Supabase.', 'aviso');
    await carregarRnc();
  } catch (err) {
    console.error('Erro ao excluir RNC de dormentes:', err);
    App.toast(mensagemErroBanco(err, 'Não foi possível excluir a RNC no Supabase.'), 'erro');
  }
}

function mensagemErroBanco(err, fallback) {
  const msg = String(err?.message || err || '').trim();
  if (!msg) return fallback;
  if (msg.includes('rnc_dormentes') && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find'))) {
    return 'A tabela rnc_dormentes ainda não existe no Supabase. Rode o SQL supabase/2026-06-19-rnc-dormentes.sql no SQL Editor.';
  }
  if (msg.includes('row-level security') || msg.includes('violates row-level security')) {
    return 'Seu perfil não tem permissão para esta ação na RNC.';
  }
  return msg || fallback;
}

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') fecharRnc();
});

document.addEventListener('click', (ev) => {
  const modal = document.getElementById('rncModal');
  if (modal && ev.target === modal) fecharRnc();
});

window.carregarRnc = carregarRnc;
window.abrirRnc = abrirRnc;
window.fecharRnc = fecharRnc;
window.salvarRnc = salvarRnc;
window.excluirRnc = excluirRnc;
