const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const raiz=path.join(__dirname,'..');
const ler=arquivo=>fs.readFileSync(path.join(raiz,arquivo),'utf8');
const html=ler('madeira-lei.html');
const app=ler('js/madeira-lei-operacao.js');
const bootstrap=ler('js/madeira-lei-bootstrap.js');
const menu=ler('js/comum.js');
const css=ler('css/madeira-lei-operacao.css');
const migration=ler('supabase/migrations/20260914100647_integrar_controle_madeira_lei.sql');

test('integra somente Dashboard e Registros, sem login de fornecedor',()=>{
  assert.match(html,/id="view-dashboard"/);
  assert.match(html,/id="view-registros"/);
  assert.equal((html.match(/id="view-/g)||[]).length,2);
  assert.doesNotMatch(html,/auth-screen|data-access|Área do fornecedor|Acesso do fornecedor/i);
  assert.doesNotMatch(bootstrap,/signInWithPassword|profiles|rgafzmmnpjlrxfjkabsl/);
  assert.doesNotMatch(css,/\.auth__|auth__card--fornecedor/);
  assert.match(bootstrap,/Auth\.exigirLogin\(\)/);
  assert.match(bootstrap,/window\.sbClient=cliente/);
});

test('usa o cabeçalho global e começa cada tela pelos filtros',()=>{
  assert.match(html,/id="conteudo"/);
  assert.match(html,/css\/style\.css/);
  assert.match(html,/js\/config\.js/);
  assert.match(html,/js\/comum\.js/);
  assert.match(bootstrap,/App\.montarLayout\(pagina\.menu,pagina\.titulo,pagina\.subtitulo\)/);
  assert.doesNotMatch(html,/class="top-menu"|class="sidebar"|class="page-head"/);
  assert.match(html,/id="view-registros"[\s\S]*?<!-- Filtros da tabela -->\s*<section class="card filters">/);
  assert.match(html,/id="view-dashboard"[\s\S]*?<!-- Conteúdo do dashboard -->[\s\S]*?<!-- Filtros -->\s*<section class="card filters">/);
});

test('usa tabelas isoladas no Supabase principal',()=>{
  assert.match(app,/from\("madeira_lei_registros"\)/);
  assert.match(app,/from\("madeira_lei_sincronizacao"\)/);
  assert.doesNotMatch(app,/\.from\("registros"\)/);
  assert.doesNotMatch(app,/\.insert\(|\.update\(|\.delete\(/);
  assert.match(migration,/enable row level security/g);
  assert.match(migration,/using \(\(select public\.usuario_ativo\(\)\)\)/g);
  assert.match(migration,/grant select on table public\.madeira_lei_registros to authenticated/);
  assert.doesNotMatch(migration,/grant (insert|update|delete|all).*authenticated/i);
});

test('migração preserva os 92 registros operacionais',()=>{
  const linhas=migration.match(/^  \('[0-9a-f-]{36}'/gm)||[];
  assert.equal(linhas.length,92);
  assert.match(migration,/2026-08-12 12:04:02\.789\+00/);
});

test('menu principal agrupa as duas telas na seção DM Lei',()=>{
  assert.match(menu,/madeira-lei\.html#dashboard/);
  assert.match(menu,/madeira-lei\.html#registros/);
  assert.match(menu,/group: 'madeira-lei'/);
  assert.match(menu,/\{ grupo: 'madeira-lei', titulo: 'DM Lei' \}/);
});
