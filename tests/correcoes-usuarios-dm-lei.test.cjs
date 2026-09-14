const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const raiz=path.join(__dirname,'..');
const ler=arquivo=>fs.readFileSync(path.join(raiz,arquivo),'utf8');

test('página de usuários usa o contêiner global do cabeçalho',()=>{
  const html=ler('usuarios.html');
  assert.match(html,/<div class="app" id="app">/);
});

test('títulos dos gráficos DM Lei não exibem a barra azul',()=>{
  const css=ler('css/madeira-lei-integrado.css');
  assert.match(css,/\.madeira-lei-pagina \.chart-card \.card__head::before/);
  assert.match(css,/content:\s*none/);
  assert.match(css,/display:\s*none/);
});

test('todas as referências de autoria permitem excluir usuários sem apagar registros',()=>{
  const sql=ler('supabase/migrations/20260914110800_permitir_exclusao_usuarios_auth.sql');
  assert.equal((sql.match(/references auth\.users\(id\) on delete set null/gi)||[]).length,14);
  assert.doesNotMatch(sql,/anira|darci|@ext\.rumolog\.com/i);
});
