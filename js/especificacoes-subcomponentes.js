/* =====================================================================
   ESPECIFICACOES-SUBCOMPONENTES.JS — Medidas e tolerâncias (consulta)
   Leitura: todos os perfis. Criar/editar/excluir: somente Admin.
   Aba consultiva: não cruza com Inspeções nem Estoque.
   ===================================================================== */

let SUB_REGISTROS = [];
let SUB_CARREGANDO = false;
let SUB_ERRO = '';

const CAMPOS = ['subcomponente', 'referencia', 'medidas_tolerancias', 'observacao'];

const SUB_PADROES = [
  {
    "subcomponente": "Palmilha Branca TR68 FAST-CLIP",
    "referencia": "ENG-DVP-D183 / INF-FX-0003",
    "medidas_tolerancias": "M1: 187,5 a 191,5 mm; M2: 151 a 155 mm; M3: 111,5 a 114,5 mm; M4: 5,5 a 7,5 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  },
  {
    "subcomponente": "Palmilha Verde UIC60",
    "referencia": "ENG-DVP-D135 / INF-FX-0003",
    "medidas_tolerancias": "M1: 148,5 a 150 mm; M2: 113 a 114 mm; M3: 7,05 a 7,55 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  },
  {
    "subcomponente": "Isolador Lateral Verde 3510W",
    "referencia": "ENG-DVP-D136",
    "medidas_tolerancias": "M1: 61,5 a 63 mm; M2: 9,6 a 10,2 mm; M3: 7,4 a 8 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  },
  {
    "subcomponente": "Isolador Lateral Amarelo 3510W",
    "referencia": "ENG-DVP-D136",
    "medidas_tolerancias": "M1: 61,5 a 63 mm; M2: 9,6 a 10,2 mm; M3: 7,4 a 8 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  },
  {
    "subcomponente": "Isolador Lateral Preto 3502W",
    "referencia": "ENG-DVP-D084",
    "medidas_tolerancias": "M1: 61,5 a 63 mm; M2: 7,6 a 8,2 mm; M3: 7,4 a 8 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  },
  {
    "subcomponente": "Isolador Lateral Branco 8mm PANDROL",
    "referencia": "ENG-DVP-D084",
    "medidas_tolerancias": "M1: 61,5 a 63 mm; M2: 7,6 a 8,2 mm; M3: 7,4 a 8 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  },
  {
    "subcomponente": "Isolador Lateral Branco 3502W",
    "referencia": "ENG-DVP-D084",
    "medidas_tolerancias": "M1: 61,5 a 63 mm; M2: 7,6 a 8,2 mm; M3: 7,4 a 8 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  },
  {
    "subcomponente": "UNDER SLEEPER PAD — USP GETZNER",
    "referencia": "ENG-DVP-D131",
    "medidas_tolerancias": "Comprimento: 1360 a 1390 mm; Largura: 225 a 245 mm; Espessura: 7 a 11 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  },
  {
    "subcomponente": "Grampo W c/ isolador Capa Branca",
    "referencia": "ENG-DVP-T040",
    "medidas_tolerancias": "M1: 106,5 a 111 mm; M2: 15,75 a 16,25 mm; M3: 74,5 a 79 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  },
  {
    "subcomponente": "Grampo W c/ isolador frontal",
    "referencia": "ENG-DVP-T040",
    "medidas_tolerancias": "M1: 106,5 a 111 mm; M2: 15,75 a 16,25 mm; M3: 74,5 a 79 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  },
  {
    "subcomponente": "Ombreira E-CLIP HFOB02",
    "referencia": "ENG-DVP-D139",
    "medidas_tolerancias": "M1: 73,5 a 76,5 mm; M2: mínimo 24 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  },
  {
    "subcomponente": "Ombreira FAST-CLIP HFOB08",
    "referencia": "ENG-DVP-D074",
    "medidas_tolerancias": "M1: 99,75 a 102,25 mm; M2: 58,7 a 60,7 mm; M3: 95,9 a 98,1 mm; M4: 70,3 a 72,5 mm; M5: 34,9 a 36,7 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  },
  {
    "subcomponente": "Palmilha Verde Almofada 6980",
    "referencia": "ENG-DVP-D135",
    "medidas_tolerancias": "M1: 148,5 a 150 mm; M2: 113 a 114 mm; M3: 7,05 a 7,55 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  },
  {
    "subcomponente": "Palmilha Branca Almofada 7552",
    "referencia": "ENG-DVP-D183",
    "medidas_tolerancias": "M1: 187,5 a 191,5 mm; M2: 151 a 155 mm; M3: 111,5 a 114,5 mm; M4: 5,5 a 7,5 mm",
    "caracteristica": "Medidas / tolerâncias",
    "unidade": "mm",
    "valor_nominal": null,
    "tolerancia_inferior": null,
    "tolerancia_superior": null,
    "observacao": "Padrão pré-preenchido conforme tabela de medidas e tolerâncias de subcomponentes."
  }
];

function ehAdmin() { return !!(window.Auth?.permissoesAtuais?.().admin); }

function padraoId(indice) { return `padrao-sub-${indice}`; }
function normalizar(v) { return String(v == null ? '' : v).trim().toUpperCase(); }
function chaveRegistro(r) { return `${normalizar(r?.subcomponente)}|${normalizar(r?.referencia)}`; }
function valBruto(v) { return String(v == null ? '' : v).trim(); }
function val(v) { const s = valBruto(v); return s ? U.esc(s) : '—'; }

function medidasDoRegistro(r) {
  const direto = valBruto(r?.medidas_tolerancias);
  if (direto) return direto;
  const legado = [r?.caracteristica, r?.valor_nominal, r?.tolerancia_inferior, r?.tolerancia_superior]
    .map(valBruto).filter(Boolean).join(' · ');
  return legado || '';
}

function listaComPadroes() {
  const lista = (SUB_REGISTROS || []).map(r => ({ ...r, _padrao: false }));
  const existentes = new Set(lista.map(chaveRegistro));
  SUB_PADROES.forEach((p, idx) => {
    if (!existentes.has(chaveRegistro(p))) lista.push({ ...p, id: padraoId(idx), _padrao: true });
  });
  return lista;
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  App.montarLayout('especSubcomponentes', 'Medidas e Tolerâncias — Subcomponentes',
    'Tabela de referência com medidas e tolerâncias pré-preenchidas por subcomponente.');

  const btnGlossario = `<button class="btn btn-secundario" onclick="abrirGlossarioSub()">${ICN.olho}<span>Glossário de subcomponentes</span></button>`;
  App.acoesTopo(`${btnGlossario}${ehAdmin()
    ? `<button class="btn btn-primario" onclick="abrirNovo()">${ICN.add}<span>Novo subcomponente</span></button>
       <button class="btn btn-secundario" onclick="carregar()">Atualizar</button>`
    : `${App.avisoModoConsulta()} <button class="btn btn-secundario" onclick="carregar()">Atualizar</button>`}`);

  ['busca', 'fSubcomponente'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', render); el.addEventListener('change', render); }
  });

  document.getElementById('subcomponente')?.addEventListener('input', () => aplicarPadraoSubcomponente(false));
  document.getElementById('subcomponente')?.addEventListener('change', () => aplicarPadraoSubcomponente(false));
  popularDatalist();
  render();
  await carregar();
});

async function carregar() {
  SUB_CARREGANDO = true; SUB_ERRO = ''; render();
  try {
    await Auth.exigirLogin();
    SUB_REGISTROS = await StoreSupabase.listarEspecSubcomponentes();
    atualizarFiltroSubcomponente();
    popularDatalist();
    SUB_CARREGANDO = false; render();
  } catch (err) {
    console.error('Erro ao carregar medidas', err);
    SUB_CARREGANDO = false;
    SUB_ERRO = mensagemErroBanco(err, 'Não foi possível carregar as medidas do Supabase.');
    App.toast(SUB_ERRO, 'erro');
    render();
  }
}

function nomesSubcomponentes() {
  return Array.from(new Set(listaComPadroes()
    .map(r => valBruto(r.subcomponente))
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function popularDatalist() {
  const dl = document.getElementById('listaSubcomponentes');
  if (!dl) return;
  dl.innerHTML = nomesSubcomponentes().map(n => `<option value="${U.esc(n)}"></option>`).join('');
}

function atualizarFiltroSubcomponente() {
  const el = document.getElementById('fSubcomponente');
  if (!el) return;
  const atual = el.value;
  const nomes = nomesSubcomponentes();
  let html = '<option value="">Todos</option>';
  nomes.forEach(n => { html += `<option value="${U.esc(n)}" ${n === atual ? 'selected' : ''}>${U.esc(n)}</option>`; });
  el.innerHTML = html;
  if (atual && nomes.includes(atual)) el.value = atual;
}

function filtros() {
  return {
    busca: document.getElementById('busca')?.value.toLowerCase().trim() || '',
    subcomponente: document.getElementById('fSubcomponente')?.value || '',
  };
}

function render() {
  const todos = listaComPadroes();
  const f = filtros();
  const lista = todos.filter(r => {
    if (f.subcomponente && r.subcomponente !== f.subcomponente) return false;
    if (f.busca) {
      const blob = `${r.subcomponente} ${r.referencia} ${medidasDoRegistro(r)} ${r.observacao} ${r.caracteristica}`.toLowerCase();
      if (!blob.includes(f.busca)) return false;
    }
    return true;
  }).sort((a, b) =>
    String(a.subcomponente || '').localeCompare(String(b.subcomponente || ''), 'pt-BR') ||
    String(a.referencia || '').localeCompare(String(b.referencia || ''), 'pt-BR'));

  const contador = document.getElementById('contador');
  const qtdPadroes = lista.filter(r => r._padrao).length;
  if (contador) contador.textContent = SUB_CARREGANDO
    ? 'Carregando do Supabase...'
    : `${lista.length} de ${todos.length} subcomponente(s)${qtdPadroes ? ` · ${qtdPadroes} modelo(s) pré-preenchido(s)` : ''}`;

  const cont = document.getElementById('lista');
  if (!cont) return;

  if (SUB_CARREGANDO) {
    cont.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Carregando</h3><p>Buscando medidas no Supabase...</p></div>`;
    return;
  }
  if (SUB_ERRO) {
    cont.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${U.esc(SUB_ERRO)}</p><button class="btn btn-secundario" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (!lista.length) {
    cont.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhuma medida</h3>
      <p>Ajuste os filtros ou ${ehAdmin() ? 'cadastre um subcomponente de referência.' : 'solicite cadastro ao Admin.'}</p></div>`;
    return;
  }

  let linhas = '';
  lista.forEach(r => {
    linhas += `<tr>
      <td><strong>${val(r.subcomponente)}</strong>${r._padrao ? '<div><span class="badge badge-amarelo">Pré-preenchido</span></div>' : ''}</td>
      <td>${val(r.referencia)}</td>
      <td>${formatarMedidas(medidasDoRegistro(r))}</td>
      <td>${val(r.observacao)}</td>
      <td class="acoes-cel">${acoesRegistro(r)}</td>
    </tr>`;
  });

  cont.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Subcomponente</th><th>Referência</th><th>Medidas / tolerâncias</th><th>Observação</th><th>Ações</th>
    </tr></thead><tbody>${linhas}</tbody></table></div>`;
}

function formatarMedidas(texto) {
  const partes = valBruto(texto).split(';').map(p => p.trim()).filter(Boolean);
  if (!partes.length) return '—';
  return `<div class="medidas-lista">${partes.map(p => `<span class="badge">${U.esc(p)}</span>`).join(' ')}</div>`;
}

function acoesRegistro(r) {
  if (!ehAdmin()) return `<span class="txt-mini txt-cinza">${r._padrao ? 'Modelo pré-preenchido' : 'Consulta'}</span>`;
  const editarTxt = r._padrao ? 'Usar como modelo' : 'Editar';
  const excluirBtn = r._padrao ? '' : `<button class="icone-btn del" title="Excluir" onclick="excluir('${r.id}')">${ICN.del}</button>`;
  return `<button class="btn btn-secundario" type="button" onclick="editar('${r.id}')">${ICN.edit}<span>${editarTxt}</span></button>${excluirBtn}`;
}

function abrirNovo() {
  if (!ehAdmin()) { App.toast(Auth.mensagemSemPermissao('criar medidas'), 'aviso'); return; }
  document.getElementById('form').reset();
  document.getElementById('id').value = '';
  document.getElementById('modalTitulo').textContent = 'Novo subcomponente';
  document.getElementById('modal').classList.add('aberto');
}

function editar(id) {
  if (!ehAdmin()) { App.toast(Auth.mensagemSemPermissao('editar medidas'), 'aviso'); return; }
  const r = listaComPadroes().find(x => x.id === id);
  if (!r) return;
  document.getElementById('form').reset();
  document.getElementById('id').value = r._padrao ? '' : r.id;
  setValor('subcomponente', r.subcomponente || '');
  setValor('referencia', r.referencia || '');
  setValor('medidas_tolerancias', medidasDoRegistro(r));
  setValor('observacao', r.observacao || '');
  document.getElementById('modalTitulo').textContent = `${r._padrao ? 'Salvar padrão' : 'Editar'} — ${r.subcomponente || ''}`.trim();
  document.getElementById('modal').classList.add('aberto');
}

function aplicarPadraoSubcomponente(forcar = false) {
  const subcomponente = valBruto(document.getElementById('subcomponente')?.value);
  const id = document.getElementById('id')?.value;
  if (!subcomponente || (id && !forcar)) return;
  const padrao = SUB_PADROES.find(p => normalizar(p.subcomponente) === normalizar(subcomponente));
  if (!padrao) return;
  ['referencia', 'medidas_tolerancias', 'observacao'].forEach(campo => {
    const atual = valBruto(document.getElementById(campo)?.value);
    if (forcar || !atual) setValor(campo, padrao[campo] || '');
  });
}

async function salvar() {
  if (!ehAdmin()) { App.toast(Auth.mensagemSemPermissao('salvar medidas'), 'aviso'); return; }
  const subcomponente = valBruto(document.getElementById('subcomponente')?.value);
  const referencia = valBruto(document.getElementById('referencia')?.value);
  const medidas = valBruto(document.getElementById('medidas_tolerancias')?.value);
  if (!subcomponente || !referencia || !medidas) { App.toast('Informe Subcomponente, Referência e Medidas / tolerâncias (*).', 'aviso'); return; }

  const reg = {
    id: document.getElementById('id').value || undefined,
    subcomponente,
    referencia,
    medidas_tolerancias: medidas,
    caracteristica: 'Medidas / tolerâncias',
    unidade: 'mm',
    valor_nominal: null,
    tolerancia_inferior: null,
    tolerancia_superior: null,
    observacao: limpar(document.getElementById('observacao')?.value)
  };

  const btn = document.querySelector('.form-acoes .btn-primario');
  const txt = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando...'; }
  try {
    const salvo = await StoreSupabase.salvarEspecSubcomponente(reg);
    const idx = SUB_REGISTROS.findIndex(x => x.id === salvo.id);
    if (idx >= 0) SUB_REGISTROS[idx] = salvo; else SUB_REGISTROS.unshift(salvo);
    atualizarFiltroSubcomponente();
    popularDatalist();
    App.toast('Medida salva no Supabase.');
    fecharModal(); render();
  } catch (err) {
    console.error('Erro ao salvar medida', err);
    App.toast(mensagemErroBanco(err, 'Não foi possível salvar a medida.'), 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = txt || 'Salvar medida'; }
  }
}

async function excluir(id) {
  if (!ehAdmin()) { App.toast(Auth.mensagemSemPermissao('excluir medidas'), 'aviso'); return; }
  const r = SUB_REGISTROS.find(x => x.id === id);
  if (!r) return;
  if (!App.confirmar(`Excluir as medidas de "${r.subcomponente || ''}"?`)) return;
  try {
    await StoreSupabase.removerEspecSubcomponente(id);
    SUB_REGISTROS = SUB_REGISTROS.filter(x => x.id !== id);
    atualizarFiltroSubcomponente();
    popularDatalist();
    App.toast('Medida excluída.', 'aviso');
    render();
  } catch (err) {
    console.error('Erro ao excluir medida', err);
    App.toast(mensagemErroBanco(err, 'Não foi possível excluir a medida.'), 'erro');
  }
}

function setValor(id, valor) { const el = document.getElementById(id); if (el) el.value = valor == null ? '' : valor; }
function limpar(v) { const s = String(v == null ? '' : v).trim(); return s ? s : null; }

function mensagemErroBanco(err, padrao) {
  const msg = err?.message || err?.details || '';
  if (!msg) return padrao;
  if (/row-level security|violates row-level security/i.test(msg)) return 'Acesso bloqueado pelas regras de segurança do Supabase. Esta área só pode ser editada por Admin.';
  if (/column .* does not exist|Could not find .* column|schema cache/i.test(msg)) return 'Campos novos ainda não existem no Supabase. Rode novamente supabase/2026-05-31-especificacoes-e-equipamentos.sql.';
  if (/relation .* does not exist|could not find the table/i.test(msg)) return 'Tabela ainda não criada no Supabase. Rode supabase/2026-05-31-especificacoes-e-equipamentos.sql.';
  if (/JWT|token|auth/i.test(msg)) return 'Sessão expirada ou inválida. Saia e faça login novamente.';
  return msg;
}

function fecharModal() { document.getElementById('modal')?.classList.remove('aberto'); }

window.render = render;
window.abrirNovo = abrirNovo;
window.editar = editar;
window.excluir = excluir;
window.salvar = salvar;
window.fecharModal = fecharModal;
window.carregar = carregar;
window.aplicarPadraoSubcomponente = aplicarPadraoSubcomponente;

/* =====================================================================
   GLOSSÁRIO DE SUBCOMPONENTES — página suspensa sobre Medidas e Tolerâncias.
   Leitura: todos os perfis. Criar/editar/excluir: somente admin.
   Foto WEBP é gravada como data URL base64 na tabela glossario_subcomponentes.
   Espelha o "Glossário de defeitos" da aba Reprovados.
   ===================================================================== */

let GLOS_SUB_REGISTROS = [];
let GLOS_SUB_CARREGADO = false;
let GLOS_SUB_CARREGANDO = false;
let GLOS_SUB_ERRO = '';
let glosSubImagemAtual = '';

const GLOS_SUB_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function mensagemErroGlosSub(err, padrao) {
  const msg = err?.message || err?.details || '';
  if (!msg) return padrao;
  if (/row-level security|violates row-level security/i.test(msg)) return 'Acesso bloqueado pelas regras de segurança do Supabase. Este glossário só pode ser editado por Admin.';
  if (/relation .* does not exist|could not find the table|schema cache/i.test(msg)) return 'Tabela ainda não criada no Supabase. Rode supabase/2026-06-05-glossario-subcomponentes.sql.';
  if (/JWT|token|auth/i.test(msg)) return 'Sessão expirada ou inválida. Saia e faça login novamente.';
  return msg;
}

function abrirGlossarioSub() {
  const overlay = document.getElementById('glosSubOverlay');
  if (!overlay) return;
  const btn = document.getElementById('btnNovoGlosSub');
  if (btn) btn.hidden = !ehAdmin();
  overlay.classList.add('aberto');
  document.body.classList.add('glossario-aberto');
  if (!GLOS_SUB_CARREGADO) carregarGlossarioSub();
  else renderGlossarioSub();
}

function fecharGlossarioSub() {
  fecharFormGlosSub();
  document.getElementById('glosSubOverlay')?.classList.remove('aberto');
  document.body.classList.remove('glossario-aberto');
}

async function carregarGlossarioSub() {
  GLOS_SUB_CARREGANDO = true;
  GLOS_SUB_ERRO = '';
  renderGlossarioSub();
  try {
    const dados = await StoreSupabase.listarGlossarioSubcomponentes();
    GLOS_SUB_REGISTROS = (dados || []).map(mapGlosSubDoBanco);
    GLOS_SUB_CARREGADO = true;
  } catch (err) {
    console.error('Erro ao carregar glossário de subcomponentes', err);
    GLOS_SUB_ERRO = mensagemErroGlosSub(err, 'Não foi possível carregar o glossário de subcomponentes do Supabase.');
  } finally {
    GLOS_SUB_CARREGANDO = false;
    renderGlossarioSub();
  }
}

function renderGlossarioSub() {
  const cont = document.getElementById('glosSubLista');
  if (!cont) return;
  const admin = ehAdmin();
  const btn = document.getElementById('btnNovoGlosSub');
  if (btn) btn.hidden = !admin;

  if (GLOS_SUB_CARREGANDO) {
    cont.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Carregando glossário</h3><p>Buscando subcomponentes no Supabase...</p></div>`;
    return;
  }
  if (GLOS_SUB_ERRO) {
    cont.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${U.esc(GLOS_SUB_ERRO)}</p>
      <button class="btn btn-secundario" onclick="carregarGlossarioSub()">Tentar novamente</button></div>`;
    return;
  }
  if (!GLOS_SUB_REGISTROS.length) {
    cont.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhum subcomponente cadastrado</h3>
      <p>${admin ? 'Use o botão "Adicionar subcomponente" para incluir a primeira foto, título e descrição.' : 'O administrador ainda não cadastrou subcomponentes no glossário.'}</p></div>`;
    return;
  }

  cont.innerHTML = `<div class="defeitos-grid">${GLOS_SUB_REGISTROS.map(d => {
    const img = (d.imagem || '').startsWith('data:image/')
      ? `<img class="defeito-img" src="${d.imagem}" alt="${U.esc(d.titulo)}" loading="lazy">`
      : `<div class="defeito-img defeito-img-vazia">${ICN.vazioBox}<span>Sem imagem</span></div>`;
    const acoes = admin
      ? `<div class="defeito-acoes">
          <button class="icone-btn" title="Editar" onclick="editarGlosSub('${d.id}')">${ICN.edit}</button>
          <button class="icone-btn del" title="Excluir" onclick="excluirGlosSub('${d.id}')">${ICN.del}</button>
        </div>`
      : '';
    return `<article class="defeito-card">
      ${img}
      <div class="defeito-corpo">
        <div class="defeito-card-topo">
          <h3>${U.esc(d.titulo || 'Sem título')}</h3>
          ${acoes}
        </div>
        ${d.descricao ? `<p class="defeito-desc">${U.esc(d.descricao)}</p>` : '<p class="defeito-desc txt-cinza">Sem descrição.</p>'}
      </div>
    </article>`;
  }).join('')}</div>`;
}

function abrirNovoGlosSub() {
  if (!ehAdmin()) { App.toast(Auth.mensagemSemPermissao('cadastrar subcomponentes'), 'aviso'); return; }
  document.getElementById('formGlosSub').reset();
  document.getElementById('glosSubId').value = '';
  glosSubImagemAtual = '';
  atualizarPreviewGlosSub();
  document.getElementById('glosSubFormTitulo').textContent = 'Novo subcomponente';
  document.getElementById('glosSubForm').classList.add('aberto');
}

function editarGlosSub(id) {
  if (!ehAdmin()) { App.toast(Auth.mensagemSemPermissao('editar subcomponentes'), 'aviso'); return; }
  const d = GLOS_SUB_REGISTROS.find(x => x.id === id);
  if (!d) return;
  document.getElementById('formGlosSub').reset();
  document.getElementById('glosSubId').value = d.id;
  document.getElementById('glosSubTitulo').value = d.titulo || '';
  document.getElementById('glosSubDescricao').value = d.descricao || '';
  glosSubImagemAtual = d.imagem || '';
  atualizarPreviewGlosSub();
  document.getElementById('glosSubFormTitulo').textContent = `Editar subcomponente — ${d.titulo || ''}`;
  document.getElementById('glosSubForm').classList.add('aberto');
}

function fecharFormGlosSub() {
  document.getElementById('glosSubForm')?.classList.remove('aberto');
}

function aoSelecionarFotoGlosSub(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.type !== 'image/webp') {
    App.toast('Selecione um arquivo no formato WEBP (.webp).', 'aviso');
    input.value = '';
    return;
  }
  if (file.size > GLOS_SUB_MAX_BYTES) {
    App.toast('A imagem WEBP deve ter no máximo 2 MB.', 'aviso');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    glosSubImagemAtual = String(reader.result || '');
    atualizarPreviewGlosSub();
  };
  reader.onerror = () => App.toast('Não foi possível ler a imagem selecionada.', 'erro');
  reader.readAsDataURL(file);
}

function atualizarPreviewGlosSub() {
  const alvo = document.getElementById('glosSubPreview');
  if (!alvo) return;
  alvo.innerHTML = (glosSubImagemAtual || '').startsWith('data:image/')
    ? `<img src="${glosSubImagemAtual}" alt="Pré-visualização do subcomponente">`
    : '<div class="defeito-preview-vazio">Nenhuma imagem selecionada</div>';
}

async function salvarGlosSub() {
  if (!ehAdmin()) { App.toast(Auth.mensagemSemPermissao('cadastrar subcomponentes'), 'aviso'); return; }
  const titulo = document.getElementById('glosSubTitulo').value.trim();
  if (!titulo) { App.toast('Informe o título do subcomponente.', 'aviso'); return; }

  const registro = {
    id: document.getElementById('glosSubId').value || undefined,
    titulo,
    descricao: document.getElementById('glosSubDescricao').value.trim() || null,
    imagem: glosSubImagemAtual || null,
  };

  const btn = document.querySelector('#glosSubForm .form-acoes .btn-primario');
  const textoOriginal = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando...'; }

  try {
    const salvo = mapGlosSubDoBanco(await StoreSupabase.salvarGlossarioSubcomponente(registro));
    const idx = GLOS_SUB_REGISTROS.findIndex(x => x.id === salvo.id);
    if (idx >= 0) GLOS_SUB_REGISTROS[idx] = salvo;
    else GLOS_SUB_REGISTROS.push(salvo);
    App.toast('Subcomponente salvo no Supabase.');
    fecharFormGlosSub();
    renderGlossarioSub();
  } catch (err) {
    console.error('Erro ao salvar subcomponente do glossário', err);
    App.toast(mensagemErroGlosSub(err, 'Não foi possível salvar o subcomponente no Supabase.'), 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = textoOriginal || 'Salvar subcomponente'; }
  }
}

async function excluirGlosSub(id) {
  if (!ehAdmin()) { App.toast(Auth.mensagemSemPermissao('excluir subcomponentes'), 'aviso'); return; }
  const d = GLOS_SUB_REGISTROS.find(x => x.id === id);
  if (!d) return;
  if (!App.confirmar(`Excluir o subcomponente "${d.titulo || ''}" do glossário?`)) return;
  try {
    await StoreSupabase.removerGlossarioSubcomponente(id);
    GLOS_SUB_REGISTROS = GLOS_SUB_REGISTROS.filter(x => x.id !== id);
    App.toast('Subcomponente excluído do Supabase.', 'aviso');
    renderGlossarioSub();
  } catch (err) {
    console.error('Erro ao excluir subcomponente do glossário', err);
    App.toast(mensagemErroGlosSub(err, 'Não foi possível excluir o subcomponente no Supabase.'), 'erro');
  }
}

function mapGlosSubDoBanco(r) {
  return {
    id: r.id,
    titulo: r.titulo || '',
    descricao: r.descricao || '',
    imagem: r.imagem || '',
  };
}

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (document.getElementById('glosSubForm')?.classList.contains('aberto')) { fecharFormGlosSub(); return; }
  if (document.getElementById('glosSubOverlay')?.classList.contains('aberto')) fecharGlossarioSub();
});

window.abrirGlossarioSub = abrirGlossarioSub;
window.fecharGlossarioSub = fecharGlossarioSub;
window.carregarGlossarioSub = carregarGlossarioSub;
window.abrirNovoGlosSub = abrirNovoGlosSub;
window.editarGlosSub = editarGlosSub;
window.fecharFormGlosSub = fecharFormGlosSub;
window.aoSelecionarFotoGlosSub = aoSelecionarFotoGlosSub;
window.salvarGlosSub = salvarGlosSub;
window.excluirGlosSub = excluirGlosSub;
