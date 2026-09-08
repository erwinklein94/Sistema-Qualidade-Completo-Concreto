/* =====================================================================
   ESPECIFICACOES-DORMENTES.JS — Requisitos por projeto/bitola (consulta)
   Leitura: todos os perfis. Criar/editar/excluir: somente Admin.
   Aba consultiva: não cruza com Produção nem Ensaios.
   ===================================================================== */

let ESPEC_REGISTROS = [];
let ESPEC_CARREGANDO = false;
let ESPEC_ERRO = '';

const SECOES_CAMPOS = [
  {
    titulo: 'Fonte e pontos a confirmar',
    campos: [
      { id: 'revisao_fonte', label: 'Revisão da referência' },
      { id: 'fonte_documental', label: 'Arquivo e células de origem', tipo: 'textarea', full: true },
      { id: 'desenho_referencia', label: 'Desenho de referência' },
      { id: 'pendencias_confirmacao', label: 'Divergências e requisitos a confirmar', tipo: 'textarea', full: true }
    ]
  },
  {
    titulo: 'Identificação',
    campos: [
      { id: 'projeto', label: 'Projeto', tipo: 'select', obrigatorio: true },
      { id: 'bitola', label: 'Bitola', tipo: 'select', obrigatorio: true },
      { id: 'tipo_dormente', label: 'Tipo de dormente' }
    ]
  },
  {
    titulo: 'Slump Test (mm)',
    campos: [
      { id: 'slump_abatimento_inicio', label: 'Abatimento — início' },
      { id: 'slump_abatimento_meio', label: 'Abatimento — meio' },
      { id: 'slump_abatimento_fim', label: 'Abatimento — fim' },
      { id: 'slump_espalhamento_inicio', label: 'Espalhamento — início' },
      { id: 'slump_espalhamento_meio', label: 'Espalhamento — meio' },
      { id: 'slump_espalhamento_fim', label: 'Espalhamento — fim' }
    ]
  },
  {
    titulo: 'Desprotensão',
    campos: [
      { id: 'desprotensao', label: 'Desprotensão' }
    ]
  },
  {
    titulo: 'Resistências — Compressão axial (MPa) e Tração na flexão',
    campos: [
      { id: 'idades_ensaios_concreto', label: 'Idades previstas no anexo', tipo: 'textarea', full: true },
      { id: 'comp_axial_3_dias', label: 'Comp. axial — 3 dias' },
      { id: 'comp_axial_7_dias', label: 'Comp. axial — 7 dias' },
      { id: 'tracao_flexao_7_dias', label: 'Tração flexão — 7 dias' },
      { id: 'comp_axial_14_dias', label: 'Comp. axial — 14 dias' },
      { id: 'tracao_flexao_14_dias', label: 'Tração flexão — 14 dias' },
      { id: 'comp_axial_28_dias', label: 'Comp. axial — 28 dias' },
      { id: 'tracao_flexao_28_dias', label: 'Tração flexão — 28 dias' },
      { id: 'compressao_minima', label: 'Compressão mínima — referência antiga' },
      { id: 'tracao_minima', label: 'Tração mínima — referência antiga' }
    ]
  },
  {
    titulo: 'Cargas de ensaio (kN) e critérios de aceitação',
    campos: [
      { id: 'momento_positivo_apoio_trilho', label: 'Momento positivo no apoio dos trilhos' },
      { id: 'fissura_apoio_positivo', label: 'Apresentou fissuras? — apoio positivo' },
      { id: 'momento_negativo_apoio_trilho', label: 'Momento negativo no apoio dos trilhos' },
      { id: 'fissura_apoio_negativo', label: 'Apresentou fissuras? — apoio negativo' },
      { id: 'momento_positivo_centro', label: 'Momento positivo no centro do dormente' },
      { id: 'fissura_centro_positivo', label: 'Apresentou fissuras? — centro positivo' },
      { id: 'momento_negativo_centro', label: 'Momento negativo no centro do dormente' },
      { id: 'fissura_centro_negativo', label: 'Apresentou fissuras? — centro negativo' },
      { id: 'ancoragem', label: 'Ancoragem' },
      { id: 'ensaio_ruina', label: 'Ensaio de ruína', tipo: 'textarea', full: true },
      { id: 'verificacao_trincas_ombreira', label: 'Verificação de trincas na ombreira' },
      { id: 'ancoragem_fissura_descarga', label: 'Ancoragem: fissura > 0,5 mm após descarga?' },
      { id: 'aderencia_escorregamento_aco', label: 'Aderência — escorregamento do aço' },
      { id: 'arrancamento_ombreira_a', label: 'Arrancamento na ombreira A' },
      { id: 'arrancamento_ombreira_b', label: 'Arrancamento na ombreira B' },
      { id: 'arrancamento_ombreira_c', label: 'Arrancamento na ombreira C' },
      { id: 'torque', label: 'Torque' },
      { id: 'arrancamento', label: 'Arrancamento — referência antiga' }
    ]
  },
  {
    titulo: 'Ensaios dimensionais — medidas e tolerâncias',
    campos: [
      { id: 'inclinacao_base_apoio_trilhos', label: 'Inclinação da base de apoio dos trilhos' },
      { id: 'leitura_gabarito_inclinacao', label: 'Leitura do gabarito — Cavan' },
      { id: 'empeno_transversal_entre_apoios', label: 'Empeno transversal (torção) entre apoios' },
      { id: 'torcao_ombreira_a', label: 'Torção na ombreira A' },
      { id: 'torcao_ombreira_b', label: 'Torção na ombreira B' },
      { id: 'torcao_ombreira_c', label: 'Torção na ombreira C' },
      { id: 'comprimento_dormente', label: 'Comprimento do dormente' },
      { id: 'base_retangular', label: 'Base retangular' },
      { id: 'largura_base_apoio', label: 'Base variável — largura no apoio' },
      { id: 'largura_base_centro', label: 'Base variável — largura no centro' },
      { id: 'altura_secao_testeira', label: 'Altura na seção da testeira' },
      { id: 'altura_secao_plataforma', label: 'Altura na seção da plataforma' },
      { id: 'altura_entre_ombreiras', label: 'Altura entre ombreiras' },
      { id: 'altura_secao_centro', label: 'Altura na seção do centro' },
      { id: 'distancia_apoio_centro', label: 'Distância ao centro — pontos definidos na ficha' },
      { id: 'ombreiras_externas_mesa', label: 'Ombreiras externas — mesa (W/X)' },
      { id: 'ombreiras_externas_faces', label: 'Ombreiras externas — faces (A/B)' },
      { id: 'ombreiras_locais_mesa', label: 'Ombreiras do mesmo apoio — mesa (W/X)' },
      { id: 'ombreiras_locais_faces', label: 'Ombreiras do mesmo apoio — faces (A/B)' },
      { id: 'tolerancias_ombreiras', label: 'Tolerâncias e divergências das ombreiras', tipo: 'textarea', full: true },
      { id: 'dist_interna_ombreiras_externas', label: 'Dist. interna entre ombreiras externas' },
      { id: 'dist_interna_ombreiras_mesmo_trilho', label: 'Dist. interna entre ombreiras do mesmo trilho' },
      { id: 'dist_interna_ombreiras_mesmo_apoio', label: 'Dist. interna entre ombreiras do mesmo apoio' },
      { id: 'altura_ombreira', label: 'Altura da ombreira' },
    ]
  },
  {
    titulo: 'Concretagem, cura e acondicionamento',
    campos: [
      { id: 'temperatura_maxima', label: 'Temperatura máxima de cura' },
      { id: 'temperatura_inicial_concretagem', label: 'Temperatura inicial da concretagem' },
      { id: 'diferenca_temperatura_nucleo_superficie', label: 'Diferença núcleo/superfície' },
      { id: 'taxa_aquecimento_cura', label: 'Taxa máxima de aquecimento' },
      { id: 'monitoramento_cura', label: 'Monitoramento e cobertura dos moldes', tipo: 'textarea', full: true },
      { id: 'peso_total_com_insumos', label: 'Peso total com insumos — ficha' },
      { id: 'armazenamento_acondicionamento', label: 'Armazenamento e acondicionamento', tipo: 'textarea', full: true }
    ]
  },
  {
    titulo: 'Parâmetros de projeto — EM-SPE-035 rev.10',
    campos: [
      { id: 'carga_eixo_projeto', label: 'Carga nominal estática por eixo' },
      { id: 'velocidade_maxima_projeto', label: 'Velocidade máxima' },
      { id: 'espacamento_dormentes', label: 'Espaçamento entre dormentes' },
      { id: 'peso_maximo_dormente', label: 'Peso máximo do dormente' },
      { id: 'inclinacao_trilho', label: 'Inclinação do trilho' },
      { id: 'pressao_max_lastro', label: 'Taxa de compressão máx. no lastro' },
      { id: 'bitola_grade_montada', label: 'Bitola na grade montada' },
      { id: 'dist_centro_eixo_via', label: 'Dist. centro do dormente ao eixo da via' }
    ]
  },
  {
    titulo: 'Momentos fletores de projeto (kN·m) — EM-SPE-035 Tabela 1',
    campos: [
      { id: 'momento_fletor_positivo_apoio', label: 'Positivo no apoio do trilho' },
      { id: 'momento_fletor_negativo_apoio', label: 'Negativo no apoio do trilho' },
      { id: 'momento_fletor_negativo_centro', label: 'Negativo no centro' },
      { id: 'momento_fletor_positivo_centro', label: 'Positivo no centro' }
    ]
  },
  {
    titulo: 'Protensão, acabamento e danos admissíveis',
    campos: [
      { id: 'fio_protensao', label: 'Fio de protensão' },
      { id: 'quantidade_fios_protensao', label: 'Quantidade de fios de protensão' },
      { id: 'posicionamento_fios_protensao', label: 'Posicionamento dos fios de protensão' },
      { id: 'superficie_apoio_trilho', label: 'Superfície de apoio do trilho' },
      { id: 'danos_admissiveis_movimentacao', label: 'Danos admissíveis (movimentação/transporte)' }
    ]
  },
  {
    titulo: 'Palmilha USP — EM-SPE-055 rev.05',
    campos: [
      { id: 'usp_distancia_bordos', label: 'Distância da palmilha aos bordos' },
      { id: 'usp_imersao_elastomero', label: 'Imersão mín. do elastômero no concreto' },
      { id: 'usp_espessura_elastomero_externo', label: 'Espessura do elastômero externo' },
      { id: 'usp_planicidade', label: 'Planicidade / empeno da palmilha' },
      { id: 'usp_rigidez_estatica', label: 'Rigidez estática (Cstat)' },
      { id: 'usp_area_contato', label: 'Área de contato' },
      { id: 'usp_resistencia_arrancamento', label: 'Resistência ao arrancamento' },
      { id: 'usp_carga_arrancamento', label: 'Carga de arrancamento USP — kgf' },
      { id: 'usp_resistencia_tracao', label: 'Resistência à tração' }
    ]
  },
  {
    titulo: 'Requisitos documentais dos insumos',
    campos: [
      { id: 'documental_agregado_miudo', label: 'Agregado miúdo', tipo: 'textarea', full: true },
      { id: 'documental_agregado_graudo', label: 'Agregado graúdo', tipo: 'textarea', full: true },
      { id: 'documental_aco', label: 'Aço', tipo: 'textarea', full: true },
      { id: 'documental_cimento', label: 'Cimento — resistências próprias do material', tipo: 'textarea', full: true },
      { id: 'documental_concreto', label: 'Concreto — laudos e requisitos sem limite informado', tipo: 'textarea', full: true }
    ]
  },
  {
    titulo: 'Observações',
    campos: [
      { id: 'observacao', label: 'Observação', tipo: 'textarea', full: true }
    ]
  }
];

const CAMPOS = SECOES_CAMPOS.flatMap(secao => secao.campos.map(campo => campo.id));
const ROTULOS = Object.fromEntries(SECOES_CAMPOS.flatMap(secao => secao.campos.map(campo => [campo.id, campo.label])));

const ESPEC_PADROES_DORMENTES = ESPEC_CAVAN.padroes;

function ehAdmin() { return !!(window.Auth?.permissoesAtuais?.().admin); }

function padraoId(projeto) {
  return `padrao-${String(projeto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function chaveRegistro(r) {
  return `${String(r?.projeto || '').trim().toUpperCase()}|${String(r?.bitola || '').trim().toUpperCase()}`;
}

function listaComPadroes() {
  const lista = (ESPEC_REGISTROS || []).map(r => ({ ...r, _padrao: false }));
  const existentes = new Set(lista.map(chaveRegistro));
  Object.values(ESPEC_PADROES_DORMENTES).forEach(p => {
    if (!existentes.has(chaveRegistro(p))) lista.push({ ...p, id: padraoId(p.projeto), _padrao: true });
  });
  return lista;
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  App.montarLayout('especDormentes', 'Especificações e Limites — Dormentes',
    'Tabela de referência dos requisitos de aceitação por projeto e bitola.');

  App.acoesTopo(ehAdmin()
    ? `<button class="btn btn-primario" onclick="abrirNovo()">${ICN.add}<span>Nova especificação</span></button>
       <button class="btn btn-secundario" onclick="carregar()">Atualizar</button>`
    : `${App.avisoModoConsulta()} <button class="btn btn-secundario" onclick="carregar()">Atualizar</button>`);

  gerarFormulario();
  preencherSelect('projeto', CFG.listas.projetos, 'Selecione...');
  preencherSelect('bitola', CFG.listas.bitolas, 'Selecione...');
  preencherSelect('fProjeto', CFG.listas.projetos, 'Todos');
  preencherSelect('fBitola', CFG.listas.bitolas, 'Todas');

  ['busca', 'fProjeto', 'fBitola'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', render); el.addEventListener('change', render); }
  });

  document.getElementById('projeto')?.addEventListener('change', () => aplicarPadraoProjeto(false));

  render();
  await carregar();
});

function preencherSelect(id, arr, ph) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = U.opcoes(arr, '', ph);
}

function gerarFormulario() {
  const cont = document.getElementById('camposDinamicos');
  if (!cont) return;
  cont.innerHTML = SECOES_CAMPOS.map(secao => {
    const campos = secao.campos.map(campo => campoHtml(campo)).join('');
    return `<div class="form-secao">${U.esc(secao.titulo)}</div>${campos}`;
  }).join('');
}

function campoHtml(campo) {
  const obrig = campo.obrigatorio ? '<span class="obrig">*</span>' : '';
  const cls = campo.full ? 'campo full' : 'campo';
  const label = `<label>${U.esc(campo.label)} ${obrig}</label>`;
  if (campo.tipo === 'select') return `<div class="${cls}">${label}<select id="${campo.id}" ${campo.obrigatorio ? 'required' : ''}></select></div>`;
  if (campo.tipo === 'textarea') return `<div class="${cls}">${label}<textarea id="${campo.id}" rows="3" placeholder="Norma de referência, condições do ensaio, etc."></textarea></div>`;
  return `<div class="${cls}">${label}<input id="${campo.id}" type="text" placeholder="A preencher"></div>`;
}

async function carregar() {
  ESPEC_CARREGANDO = true; ESPEC_ERRO = ''; render();
  try {
    await Auth.exigirLogin();
    ESPEC_REGISTROS = await StoreSupabase.listarEspecDormentes();
    ESPEC_CARREGANDO = false; render();
  } catch (err) {
    console.error('Erro ao carregar especificações', err);
    ESPEC_CARREGANDO = false;
    ESPEC_ERRO = mensagemErroBanco(err, 'Não foi possível carregar as especificações do Supabase.');
    App.toast(ESPEC_ERRO, 'erro');
    render();
  }
}

function filtros() {
  return {
    busca: document.getElementById('busca')?.value.toLowerCase().trim() || '',
    projeto: document.getElementById('fProjeto')?.value || '',
    bitola: document.getElementById('fBitola')?.value || '',
  };
}

function render() {
  const todos = listaComPadroes();
  const f = filtros();
  const lista = todos.filter(r => {
    if (f.projeto && r.projeto !== f.projeto) return false;
    if (f.bitola && r.bitola !== f.bitola) return false;
    if (f.busca) {
      const blob = CAMPOS.map(c => r[c]).join(' ').toLowerCase();
      if (!blob.includes(f.busca)) return false;
    }
    return true;
  });

  const contador = document.getElementById('contador');
  const qtdPadroes = lista.filter(r => r._padrao).length;
  if (contador) contador.textContent = ESPEC_CARREGANDO
    ? 'Carregando do Supabase...'
    : `${lista.length} de ${todos.length} especificação(ões)${qtdPadroes ? ` · ${qtdPadroes} modelo(s) pré-preenchido(s)` : ''}`;

  const cont = document.getElementById('lista');
  if (!cont) return;

  if (ESPEC_CARREGANDO) {
    cont.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Carregando</h3><p>Buscando especificações no Supabase...</p></div>`;
    return;
  }
  if (ESPEC_ERRO) {
    cont.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${U.esc(ESPEC_ERRO)}</p><button class="btn btn-secundario" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (!lista.length) {
    cont.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhuma especificação</h3>
      <p>Ajuste os filtros ou ${ehAdmin() ? 'cadastre um requisito de referência.' : 'solicite cadastro ao Admin.'}</p></div>`;
    return;
  }

  cont.innerHTML = lista.map(cardEspecificacao).join('');
}

function cardEspecificacao(r) {
  const secoes = SECOES_CAMPOS
    .filter(secao => secao.titulo !== 'Identificação')
    .map(secao => secaoCard(r, secao))
    .filter(Boolean)
    .join('');

  return `<div class="card especificacao-card">
    <div class="card-titulo">
      <span class="acento">${U.badgeProjeto(r.projeto)} ${U.badgeBitola(r)} ${r._padrao ? '<span class="badge badge-amarelo">Pré-preenchido</span>' : ''}</span>
      <span class="card-sub">${val(r.tipo_dormente)}</span>
    </div>
    ${valBruto(r.pendencias_confirmacao) ? '<div class="aviso-info"><strong>Há pontos a confirmar nas fontes.</strong> Consulte a seção abaixo antes de usar os valores para aceitação.</div>' : ''}
    ${secoes}
    <div class="form-acoes" style="justify-content:flex-end;margin-top:18px;">
      ${acoesRegistro(r)}
    </div>
  </div>`;
}

function secaoCard(r, secao) {
  const itens = secao.campos
    .filter(campo => valBruto(r[campo.id]))
    .map(campo => detalheItem(campo.label, r[campo.id], campo.full))
    .join('');
  if (!itens) return '';
  return `<div class="detalhe-secao">${U.esc(secao.titulo)}</div><div class="detalhe-grid">${itens}</div>`;
}

function detalheItem(rotulo, valor, full = false) {
  return `<div class="detalhe-item"${full ? ' style="grid-column:1/-1"' : ''}><div class="rot">${U.esc(rotulo)}</div><div class="val">${val(valor)}</div></div>`;
}

function acoesRegistro(r) {
  if (!ehAdmin()) return `<span class="txt-mini txt-cinza">${r._padrao ? 'Modelo pré-preenchido' : 'Consulta'}</span>`;
  const editarTxt = r._padrao ? 'Usar como modelo' : 'Editar';
  const excluirBtn = r._padrao ? '' : `<button class="icone-btn del" title="Excluir" onclick="excluir('${r.id}')">${ICN.del}</button>`;
  return `<button class="btn btn-secundario" type="button" onclick="editar('${r.id}')">${ICN.edit}<span>${editarTxt}</span></button>${excluirBtn}`;
}

function valBruto(v) { return String(v == null ? '' : v).trim(); }
function val(v) { const s = valBruto(v); return s ? U.esc(s) : '—'; }

function abrirNovo() {
  if (!ehAdmin()) { App.toast(Auth.mensagemSemPermissao('criar especificações'), 'aviso'); return; }
  document.getElementById('form').reset();
  document.getElementById('id').value = '';
  document.getElementById('modalTitulo').textContent = 'Nova especificação';
  document.getElementById('modal').classList.add('aberto');
}

function editar(id) {
  if (!ehAdmin()) { App.toast(Auth.mensagemSemPermissao('editar especificações'), 'aviso'); return; }
  const r = listaComPadroes().find(x => x.id === id);
  if (!r) return;
  document.getElementById('form').reset();
  document.getElementById('id').value = r._padrao ? '' : r.id;
  CAMPOS.forEach(c => setValor(c, r[c] != null ? r[c] : ''));
  document.getElementById('modalTitulo').textContent = `${r._padrao ? 'Salvar padrão' : 'Editar'} — ${r.projeto || ''} ${r.bitola || ''}`.trim();
  document.getElementById('modal').classList.add('aberto');
}

function aplicarPadraoProjeto(forcar = false) {
  const projeto = document.getElementById('projeto')?.value;
  const id = document.getElementById('id')?.value;
  if (!projeto || (id && !forcar)) return;
  const padrao = ESPEC_PADROES_DORMENTES[projeto];
  if (!padrao) return;

  CAMPOS.forEach(campo => {
    if (campo === 'projeto') return;
    // A nova seleção precisa substituir também os campos do projeto anterior.
    // Registros existentes só recebem o modelo mediante o botão explícito.
    setValor(campo, padrao[campo] ?? '');
  });
}

async function salvar() {
  if (!ehAdmin()) { App.toast(Auth.mensagemSemPermissao('salvar especificações'), 'aviso'); return; }
  const projeto = document.getElementById('projeto').value;
  const bitola = document.getElementById('bitola').value;
  if (!projeto || !bitola) { App.toast('Selecione projeto e bitola (*).', 'aviso'); return; }

  const reg = { id: document.getElementById('id').value || undefined };
  CAMPOS.forEach(c => { const el = document.getElementById(c); if (el) reg[c] = limpar(el.value); });

  const btn = document.querySelector('.form-acoes .btn-primario');
  const txt = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando...'; }
  try {
    const salvo = await StoreSupabase.salvarEspecDormente(reg);
    const idx = ESPEC_REGISTROS.findIndex(x => x.id === salvo.id);
    if (idx >= 0) ESPEC_REGISTROS[idx] = salvo; else ESPEC_REGISTROS.unshift(salvo);
    App.toast('Especificação salva no Supabase.');
    fecharModal(); render();
  } catch (err) {
    console.error('Erro ao salvar especificação', err);
    App.toast(mensagemErroBanco(err, 'Não foi possível salvar a especificação.'), 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = txt || 'Salvar especificação'; }
  }
}

async function excluir(id) {
  if (!ehAdmin()) { App.toast(Auth.mensagemSemPermissao('excluir especificações'), 'aviso'); return; }
  const r = ESPEC_REGISTROS.find(x => x.id === id);
  if (!r) return;
  if (!App.confirmar(`Excluir a especificação de ${r.projeto || ''} ${r.bitola || ''}?`)) return;
  try {
    await StoreSupabase.removerEspecDormente(id);
    ESPEC_REGISTROS = ESPEC_REGISTROS.filter(x => x.id !== id);
    App.toast('Especificação excluída.', 'aviso');
    render();
  } catch (err) {
    console.error('Erro ao excluir especificação', err);
    App.toast(mensagemErroBanco(err, 'Não foi possível excluir a especificação.'), 'erro');
  }
}

function setValor(id, valor) { const el = document.getElementById(id); if (el) el.value = valor == null ? '' : valor; }
function limpar(v) { const s = String(v == null ? '' : v).trim(); return s ? s : null; }

function mensagemErroBanco(err, padrao) {
  const msg = err?.message || err?.details || '';
  if (!msg) return padrao;
  if (/row-level security|violates row-level security/i.test(msg)) return 'Acesso bloqueado pelas regras de segurança do Supabase. Esta área só pode ser editada por Admin.';
  if (/column .* does not exist|Could not find .* column|schema cache/i.test(msg)) return 'A estrutura das especificações precisa ser atualizada. Solicite ao administrador a migração das referências Cavan de 08/09/2026.';
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
window.aplicarPadraoProjeto = aplicarPadraoProjeto;
