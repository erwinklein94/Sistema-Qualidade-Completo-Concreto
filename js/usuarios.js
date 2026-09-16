/* =====================================================================
   USUARIOS.JS — Administração de perfis do sistema
   ===================================================================== */
let usuarios = [];
// usuario_id -> { total, ultimo, paginas: [{ pagina, titulo, acessos, ultimo_acesso }] }
let acessosPorUsuario = new Map();
let acessosErro = '';

const PERFIL_BADGE = {
  admin: 'usuarios-badge-admin',
  fiscalizacao: 'usuarios-badge-fiscalizacao',
  qualidade: 'usuarios-badge-fiscalizacao',
  consulta: 'usuarios-badge-consulta',
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  App.montarLayout('usuarios', 'Usuários', 'Perfis reais de acesso: Admin, Fiscalização e Consulta');
  document.getElementById('formUsuario')?.addEventListener('submit', salvarUsuario);
  document.getElementById('usuariosBusca')?.addEventListener('input', renderUsuarios);
  document.getElementById('usuariosFiltroPerfil')?.addEventListener('change', renderUsuarios);
  document.getElementById('usuariosFiltroAtivo')?.addEventListener('change', renderUsuarios);

  const perfil = window.USUARIO_ATUAL?.perfil || await Auth.perfilAtual().catch(() => null);
  if (!Auth.pode('gerenciarUsuarios', perfil)) {
    document.querySelector('.container').innerHTML = `
      <div class="card aviso-erro">
        <div class="card-titulo"><span class="acento">Acesso restrito</span></div>
        <p>Somente usuários com perfil <strong>admin</strong> podem administrar usuários.</p>
      </div>`;
    return;
  }

  await carregarUsuarios();
});

async function carregarUsuarios() {
  const status = document.getElementById('usuariosStatus');
  const tbody = document.getElementById('usuariosTabela');
  if (status) status.textContent = 'Carregando usuários...';
  if (tbody) tbody.innerHTML = '';

  try {
    const [lista, acessos] = await Promise.all([
      StoreSupabase.listarUsuariosApp(),
      StoreSupabase.listarResumoAcessos().then(dados => ({ dados }), err => ({ err })),
    ]);
    usuarios = lista;
    usuarios.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
    acessosErro = acessos.err ? 'Não foi possível carregar os acessos dos usuários.' : '';
    if (acessos.err) console.error('Erro ao carregar acessos', acessos.err);
    acessosPorUsuario = agruparAcessos(acessos.dados || []);
    atualizarResumoUsuarios();
    renderUsuarios();
    registrarExportacaoUsuarios();
  } catch (err) {
    console.error('Erro ao carregar usuários', err);
    atualizarResumoUsuarios();
    if (status) status.textContent = 'Não foi possível carregar usuários. Confira se seu perfil é admin.';
    App.toast('Erro ao carregar usuários.', 'erro');
  }
}

function atualizarResumoUsuarios() {
  const normalizados = usuarios.map(u => Auth.normalizarPerfil(u.perfil || 'consulta'));
  setTexto('usuariosKpiTotal', usuarios.length);
  setTexto('usuariosKpiAdmin', normalizados.filter(p => p === 'admin').length);
  setTexto('usuariosKpiFiscalizacao', normalizados.filter(p => p === 'fiscalizacao').length);
  setTexto('usuariosKpiConsulta', normalizados.filter(p => p === 'consulta').length);
}

function setTexto(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(valor);
}

function filtrosUsuarios() {
  return {
    busca: String(document.getElementById('usuariosBusca')?.value || '').trim().toLowerCase(),
    perfil: document.getElementById('usuariosFiltroPerfil')?.value || 'todos',
    ativo: document.getElementById('usuariosFiltroAtivo')?.value || 'todos',
  };
}

function usuariosFiltrados() {
  const filtros = filtrosUsuarios();
  return usuarios.filter(u => {
    const perfil = Auth.normalizarPerfil(u.perfil || 'consulta');
    const ativo = !!u.ativo;
    const texto = [u.nome, u.email, u.id, Auth.rotuloPerfil(perfil)].join(' ').toLowerCase();

    if (filtros.busca && !texto.includes(filtros.busca)) return false;
    if (filtros.perfil !== 'todos' && perfil !== filtros.perfil) return false;
    if (filtros.ativo === 'ativo' && !ativo) return false;
    if (filtros.ativo === 'inativo' && ativo) return false;
    return true;
  });
}

function renderUsuarios() {
  const tbody = document.getElementById('usuariosTabela');
  const status = document.getElementById('usuariosStatus');
  if (!tbody) return;

  const lista = usuariosFiltrados();
  if (status) {
    const total = usuarios.length;
    const exibindo = lista.length;
    status.textContent = total === exibindo
      ? `${total} usuário(s) cadastrado(s)`
      : `${exibindo} de ${total} usuário(s) exibido(s)`;
  }

  tbody.innerHTML = lista.map(u => {
    const perfil = Auth.normalizarPerfil(u.perfil || 'consulta');
    const perfilRotulo = Auth.rotuloPerfil(perfil);
    const iniciais = iniciaisUsuario(u.nome || u.email || 'Usuário');
    const badgePerfil = PERFIL_BADGE[perfil] || 'usuarios-badge-consulta';
    const ativoBadge = u.ativo ? 'usuarios-badge-ativo' : 'usuarios-badge-inativo';

    return `
      <tr>
        <td>
          <div class="usuarios-identidade">
            <span class="usuarios-avatar">${U.esc(iniciais)}</span>
            <div>
              <strong>${U.esc(u.nome || '—')}</strong>
              <small>${U.esc(u.email || '—')}</small>
            </div>
          </div>
        </td>
        <td><span class="badge ${badgePerfil}">${U.esc(perfilRotulo)}</span></td>
        <td><span class="badge ${ativoBadge}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
        ${celulasAcessos(u, perfil)}
        <td><code class="usuarios-uid">${U.esc(u.id || '')}</code></td>
        <td>${formatarDataHora(u.atualizado_em)}</td>
        <td><button class="btn btn-secundario btn-sm" onclick="editarUsuario('${u.id}')">Editar</button></td>
      </tr>`;
  }).join('') || `
    <tr>
      <td colspan="8">
        <div class="vazio compacto">
          <h3>Nenhum usuário encontrado</h3>
          <p>Ajuste os filtros ou cadastre um novo perfil.</p>
        </div>
      </td>
    </tr>`;
}

/* ---------- Acessos (usuarios_acessos) ---------- */
function agruparAcessos(linhas) {
  const mapa = new Map();
  for (const l of linhas) {
    if (!mapa.has(l.usuario_id)) mapa.set(l.usuario_id, { total: 0, ultimo: null, paginas: [] });
    const item = mapa.get(l.usuario_id);
    item.total += Number(l.acessos) || 0;
    item.paginas.push(l);
    if (!item.ultimo || String(l.ultimo_acesso) > String(item.ultimo.ultimo_acesso)) item.ultimo = l;
  }
  mapa.forEach(item => item.paginas.sort((a, b) => String(b.ultimo_acesso).localeCompare(String(a.ultimo_acesso))));
  return mapa;
}

// Nome amigável da página: título do menu (inclui abas #hash); senão o título gravado.
function nomePaginaAcesso(pagina, titulo) {
  if (!nomePaginaAcesso.mapa) {
    nomePaginaAcesso.mapa = new Map();
    const grupos = { conprem: ' · Conprem', 'madeira-lei': ' · DM Lei' };
    (window.App?.menuBase?.() || []).forEach(m => {
      if (m.href && !m.external && !nomePaginaAcesso.mapa.has(m.href)) nomePaginaAcesso.mapa.set(m.href, m.t + (grupos[m.group] || ''));
    });
  }
  const mapa = nomePaginaAcesso.mapa;
  const [arquivo, hash] = String(pagina || '').split('#');
  if (mapa.has(pagina)) return mapa.get(pagina);
  const base = mapa.get(arquivo) || titulo || arquivo || '—';
  return hash && !mapa.has(pagina) && mapa.get(arquivo) ? `${base} #${hash}` : base;
}

function celulasAcessos(u, perfil) {
  if (perfil === 'admin') return '<td colspan="2"><span class="usuarios-acessos-vazio">Admin: acessos não registrados</span></td>';
  if (acessosErro) return '<td colspan="2"><span class="usuarios-acessos-vazio">Indisponível</span></td>';
  const a = acessosPorUsuario.get(u.id);
  if (!a) return '<td colspan="2"><span class="usuarios-acessos-vazio">Nenhum acesso registrado</span></td>';
  const nome = nomePaginaAcesso(a.ultimo.pagina, a.ultimo.titulo);
  return `
    <td>
      <div class="usuarios-acesso-ultimo">
        <strong>${formatarDataHora(a.ultimo.ultimo_acesso)}</strong>
        <small>em ${U.esc(nome)}</small>
      </div>
    </td>
    <td>
      <div class="usuarios-acesso-paginas">
        <span>${a.paginas.length} ${a.paginas.length === 1 ? 'página' : 'páginas'} · ${a.total} ${a.total === 1 ? 'acesso' : 'acessos'}</span>
        <button class="btn btn-secundario btn-sm" type="button" onclick="abrirAcessosUsuario('${U.esc(u.id)}')">Ver acessos</button>
      </div>
    </td>`;
}

async function abrirAcessosUsuario(id) {
  const u = usuarios.find(x => x.id === id);
  const a = acessosPorUsuario.get(id);
  const dialog = document.getElementById('dialogAcessosUsuario');
  const corpo = document.getElementById('corpoAcessosUsuario');
  if (!u || !a || !dialog || !corpo) return;
  document.getElementById('tituloAcessosUsuario').textContent = `Acessos de ${u.nome || u.email || 'usuário'}`;
  corpo.innerHTML = `
    <p class="usuarios-acessos-resumo">Último acesso em <strong>${formatarDataHora(a.ultimo.ultimo_acesso)}</strong>, na página ${U.esc(nomePaginaAcesso(a.ultimo.pagina, a.ultimo.titulo))}. ${a.paginas.length} ${a.paginas.length === 1 ? 'página diferente' : 'páginas diferentes'}, ${a.total} ${a.total === 1 ? 'acesso' : 'acessos'} no total.</p>
    <h3 class="usuarios-acessos-titulo">Páginas acessadas</h3>
    <div class="tabela-wrap"><table class="tabela usuarios-acessos-tabela">
      <thead><tr><th>Página</th><th class="right">Acessos</th><th>Primeiro acesso</th><th>Último acesso</th></tr></thead>
      <tbody>${a.paginas.map(p => `<tr>
        <td><strong>${U.esc(nomePaginaAcesso(p.pagina, p.titulo))}</strong><small class="usuarios-acessos-arquivo">${U.esc(p.pagina)}</small></td>
        <td class="right">${Number(p.acessos) || 0}</td>
        <td>${formatarDataHora(p.primeiro_acesso)}</td>
        <td>${formatarDataHora(p.ultimo_acesso)}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <h3 class="usuarios-acessos-titulo">Últimos acessos</h3>
    <div id="historicoAcessosUsuario"><p class="usuarios-acessos-vazio">Carregando histórico...</p></div>`;
  if (!dialog.open) dialog.showModal();
  try {
    const historico = await StoreSupabase.listarAcessosUsuario(id, 100);
    const alvo = document.getElementById('historicoAcessosUsuario');
    if (!alvo) return;
    alvo.innerHTML = historico.length ? `
      <div class="tabela-wrap"><table class="tabela usuarios-acessos-tabela">
        <thead><tr><th>Data e hora</th><th>Página</th></tr></thead>
        <tbody>${historico.map(h => `<tr><td>${formatarDataHora(h.acessado_em)}</td><td>${U.esc(nomePaginaAcesso(h.pagina, h.titulo))}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="usuarios-acessos-vazio">${historico.length === 100 ? 'Mostrando os 100 acessos mais recentes.' : `${historico.length} ${historico.length === 1 ? 'acesso' : 'acessos'}.`}</p>`
      : '<p class="usuarios-acessos-vazio">Nenhum acesso encontrado.</p>';
  } catch (err) {
    console.error('Erro ao carregar histórico de acessos', err);
    const alvo = document.getElementById('historicoAcessosUsuario');
    if (alvo) alvo.innerHTML = '<p class="usuarios-acessos-vazio">Não foi possível carregar o histórico.</p>';
  }
}

function iniciaisUsuario(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return 'U';
  return partes.slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function editarUsuario(id) {
  const u = usuarios.find(x => x.id === id);
  if (!u) return;
  document.getElementById('uId').value = u.id || '';
  document.getElementById('uNome').value = u.nome || '';
  document.getElementById('uEmail').value = u.email || '';
  document.getElementById('uPerfil').value = Auth.normalizarPerfil(u.perfil || 'consulta');
  document.getElementById('uAtivo').value = u.ativo ? 'true' : 'false';
  App.toast('Usuário carregado no formulário para edição.', 'info');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limparFormUsuario() {
  document.getElementById('formUsuario')?.reset();
  document.getElementById('uPerfil').value = 'consulta';
  document.getElementById('uAtivo').value = 'true';
}

async function salvarUsuario(ev) {
  ev.preventDefault();
  const registro = {
    id: document.getElementById('uId').value.trim(),
    nome: document.getElementById('uNome').value.trim(),
    email: document.getElementById('uEmail').value.trim(),
    perfil: Auth.normalizarPerfil(document.getElementById('uPerfil').value),
    ativo: document.getElementById('uAtivo').value === 'true',
  };

  if (!registro.id || !registro.email || !registro.nome) {
    App.toast('Preencha UID, nome e e-mail.', 'erro');
    return;
  }

  try {
    await StoreSupabase.salvarUsuarioApp(registro);
    App.toast('Perfil salvo em usuarios_app.');
    limparFormUsuario();
    await carregarUsuarios();
  } catch (err) {
    console.error('Erro ao salvar usuário', err);
    App.toast(mensagemErroUsuario(err), 'erro');
  }
}

function mensagemErroUsuario(err) {
  const msg = String(err?.message || err || 'Erro desconhecido');
  if (msg.includes('violates foreign key')) {
    return 'Esse UID ainda não existe em Authentication > Users. Crie o usuário no Supabase Auth antes de salvar o perfil.';
  }
  if (msg.includes('row-level security')) {
    return 'Sem permissão para salvar usuário. Use um perfil admin.';
  }
  return msg;
}

function formatarDataHora(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch (_) { return iso; }
}

function registrarExportacaoUsuarios() {
  if (!window.Exportacoes) return;
  Exportacoes.registrar({
    titulo: 'Usuários do Sistema',
    nomeArquivo: 'usuarios-sistema',
    filtros: Exportacoes.filtrosDaTela(),
    secoes: [{
      titulo: 'Usuários',
      columns: [
        { key: 'nome', label: 'Nome' },
        { key: 'email', label: 'E-mail' },
        { key: 'perfilRotulo', label: 'Perfil' },
        { key: 'ativo', label: 'Ativo' },
        { key: 'ultimoAcesso', label: 'Último acesso' },
        { key: 'paginaUltimoAcesso', label: 'Página do último acesso' },
        { key: 'paginasAcessadas', label: 'Páginas acessadas' },
        { key: 'totalAcessos', label: 'Total de acessos' },
        { key: 'id', label: 'UID' },
        { key: 'atualizado_em', label: 'Atualizado em' },
      ],
      rows: usuarios.map(u => {
        const admin = Auth.normalizarPerfil(u.perfil) === 'admin';
        const a = acessosPorUsuario.get(u.id);
        return {
          ...u,
          perfilRotulo: Auth.rotuloPerfil(u.perfil),
          ativo: u.ativo ? 'Sim' : 'Não',
          ultimoAcesso: admin ? 'Não registrado (admin)' : a ? formatarDataHora(a.ultimo.ultimo_acesso) : '—',
          paginaUltimoAcesso: a ? nomePaginaAcesso(a.ultimo.pagina, a.ultimo.titulo) : '',
          paginasAcessadas: a ? a.paginas.map(p => `${nomePaginaAcesso(p.pagina, p.titulo)} (${p.acessos})`).join('; ') : '',
          totalAcessos: a ? a.total : '',
          atualizado_em: formatarDataHora(u.atualizado_em),
        };
      })
    }]
  });
}
