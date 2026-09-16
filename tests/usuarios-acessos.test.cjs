const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

test('acessos: só não admin grava, só admin lê, usuário e horário vêm do banco', () => {
  const sql = ler('supabase/migrations/20260916133527_usuarios_acessos.sql');
  assert.match(sql, /revoke all on table public\.usuarios_acessos from anon, authenticated/);
  assert.match(sql, /grant insert \(pagina, titulo\) on table public\.usuarios_acessos to authenticated/);
  assert.doesNotMatch(sql, /grant (update|delete|all)/i);
  assert.match(sql, /for insert to authenticated\s+with check \(usuario_id = \(select auth\.uid\(\)\) and \(select public\.usuario_ativo\(\)\) and not \(select public\.eh_admin\(\)\)\)/);
  assert.match(sql, /for select to authenticated\s+using \(\(select public\.eh_admin\(\)\)\)/);
  assert.match(sql, /usuarios_acessos_resumo with \(security_invoker = true\)/);
});

test('auth.js registra a página ao validar o login, ignorando admin e parâmetros da URL', () => {
  const auth = ler('js/auth.js');
  assert.match(auth, /window\.USUARIO_ATUAL = \{ session, perfil \};\s+registrarAcesso\(perfil\);/);
  assert.match(auth, /normalizarPerfil\(perfil\) === 'admin'/);
  assert.match(auth, /\.from\('usuarios_acessos'\)\.insert\(\{ pagina, titulo \}\)/);
  const pagina = auth.match(/function paginaDoAcesso\(\) \{[\s\S]*?\n  \}/);
  assert.ok(pagina, 'paginaDoAcesso não encontrada');
  assert.doesNotMatch(pagina[0], /location\.(search|href)/);
});

test('tela de usuários mostra último acesso, páginas e histórico', () => {
  const html = ler('usuarios.html');
  const js = ler('js/usuarios.js');
  assert.match(html, /<th>Último acesso<\/th>\s*<th>Páginas acessadas<\/th>/);
  assert.match(html, /id="dialogAcessosUsuario"/);
  assert.match(html, /css\/usuarios-acessos\.css/);
  assert.match(js, /StoreSupabase\.listarResumoAcessos\(\)/);
  assert.match(js, /StoreSupabase\.listarAcessosUsuario\(id, 100\)/);
  assert.match(js, /colspan="8"/);
});
