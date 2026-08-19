/* =====================================================================
   CONPREM-TELA.JS — Motor das telas de registro da área Conprem

   A Conprem não preenche os campos da Cavan. O que ela manda toda semana
   são três relatórios, cada um com o seu conjunto de colunas:

     Mapa de Rastreabilidade (FR. 98/00)  -> Produção de Dormentes
     Ensaio de Dormentes (FR.10/08)       -> Ensaios de Dormentes
     Resumo Semanal CONPREM - RUMO        -> Dormentes Reprovados

   As três telas têm a mesma mecânica — listar, filtrar, ver a ficha,
   editar, exportar — e mudam só na lista de campos. Em vez de três
   arquivos quase iguais, cada tela declara os seus campos e chama
   ConpremTela.iniciar(); tudo o mais sai daqui.

   Um campo é [id, rótulo, coluna no Supabase, tipo]:
     texto | textarea | data | inteiro | numero | semana | select:<lista>
   "semana" é o par semana+ano do banco mostrado como "2026-S33", que é
   como o relatório escreve.
   ===================================================================== */

const ConpremTela = (() => {
  let cfg = null;
  let registros = [];
  let carregando = true;
  let erro = '';

  /* --------------------------------------------------------- utilidades */

  function todosCampos() {
    return cfg.campos.flatMap(g => g.itens);
  }

  function tipoDe(campo) {
    return (todosCampos().find(([id]) => id === campo) || [])[3] || 'texto';
  }

  /** "2026-S33" a partir do par semana/ano do banco. */
  function rotuloSemana(semana, ano) {
    if (!semana || !ano) return '';
    return `${ano}-S${String(semana).padStart(2, '0')}`;
  }

  function partesSemana(valor) {
    const m = String(valor || '').match(/(\d{4})\D+(\d{1,2})/);
    return m ? { ano: Number(m[1]), semana: Number(m[2]) } : { ano: null, semana: null };
  }

  /* Zero é resposta: "0 vazios" não é o mesmo que "não informado". Só o campo
     em branco vira null; zero é gravado. */
  function paraBanco(bruto, tipo) {
    const s = String(bruto == null ? '' : bruto).trim();
    if (!s) return null;
    if (tipo === 'data') return /^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10)) ? s.slice(0, 10) : null;
    if (tipo === 'inteiro') { const n = parseInt(s.replace(/[^0-9-]/g, ''), 10); return Number.isNaN(n) ? null : n; }
    if (tipo === 'numero') { const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : null; }
    return s;
  }

  function mapDoBanco(r) {
    const reg = { id: r.id, criadoEm: r.criado_em || '', semana: r.semana || '', ano: r.ano || '' };
    todosCampos().forEach(([campo, , coluna, tipo]) => {
      if (tipo === 'semana') reg[campo] = rotuloSemana(r.semana, r.ano);
      else if (tipo === 'data') reg[campo] = String(r[coluna] || '').slice(0, 10);
      else reg[campo] = r[coluna] == null ? '' : String(r[coluna]);
    });
    return reg;
  }

  function mapParaBanco(reg) {
    const payload = {};
    todosCampos().forEach(([campo, , coluna, tipo]) => {
      if (tipo === 'semana') return; // vira semana + ano, abaixo
      payload[coluna] = paraBanco(reg[campo], tipo);
    });
    const campoSemana = todosCampos().find(([, , , tipo]) => tipo === 'semana');
    if (campoSemana) {
      const { semana, ano } = partesSemana(reg[campoSemana[0]]);
      payload.semana = semana;
      payload.ano = ano;
    }
    payload.fornecedor = Area.fornecedor();
    if (cfg.aoSalvar) cfg.aoSalvar(payload, reg);
    if (reg.id) payload.id = reg.id;
    return payload;
  }

  function mensagemErro(err) {
    const msg = String(err?.message || err || '');
    if (/relation .* does not exist|could not find the table|schema cache/i.test(msg)) {
      return `Tabela ainda não criada no Supabase. Rode ${cfg.migracao || 'a migração desta tela'}.`;
    }
    if (/permission denied/i.test(msg)) return 'Sem permissão nesta tabela. Verifique os grants no Supabase.';
    return msg || 'Não foi possível carregar os dados.';
  }

  /* -------------------------------------------------------------- dados */

  async function carregar() {
    carregando = true;
    erro = '';
    render();
    try {
      const dados = await cfg.listar();
      registros = (dados || []).map(mapDoBanco);
      atualizarFiltroSemana();
      carregando = false;
      render();
    } catch (err) {
      console.error(`Erro ao carregar ${cfg.titulo}`, err);
      carregando = false;
      erro = mensagemErro(err);
      App.toast(erro, 'erro');
      render();
    }
  }

  /* ------------------------------------------------------------ filtros */

  function campoSemanaId() {
    return (todosCampos().find(([, , , tipo]) => tipo === 'semana') || [])[0] || '';
  }

  function atualizarFiltroSemana() {
    const el = document.getElementById('fSemana');
    const campo = campoSemanaId();
    if (!el || !campo) return;
    const atual = el.value;
    const semanas = [...new Set(registros.map(r => r[campo]).filter(Boolean))].sort((a, b) => b.localeCompare(a));
    el.innerHTML = U.opcoes(semanas, atual, 'Todas as semanas');
    el.value = atual;
  }

  function listaFiltrada() {
    const busca = (document.getElementById('busca')?.value || '').toLowerCase().trim();
    const semana = document.getElementById('fSemana')?.value || '';
    const campoSemana = campoSemanaId();
    const extras = (cfg.filtros || []).map(f => [f.campo, document.getElementById(f.id)?.value || '']);

    return registros.filter(r => {
      if (semana && campoSemana && r[campoSemana] !== semana) return false;
      for (const [campo, valor] of extras) if (valor && r[campo] !== valor) return false;
      if (busca) {
        const blob = todosCampos().map(([campo]) => r[campo]).join(' ').toLowerCase();
        if (!blob.includes(busca)) return false;
      }
      return true;
    }).sort(cfg.ordenar || ((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))));
  }

  /* ------------------------------------------------------------- render */

  function render() {
    const lista = listaFiltrada();
    renderKpis(lista);
    registrarExportacao(lista);
    renderTabela(lista);
  }

  function renderKpis(lista) {
    const alvo = document.getElementById('kpis');
    if (!alvo || !cfg.kpis) return;
    alvo.innerHTML = cfg.kpis(lista)
      .map(k => `<div class="kpi ${k.cor || ''}"><div class="rotulo">${U.esc(k.rotulo)}</div><div class="valor">${U.esc(k.valor)}</div><div class="extra">${k.extra || ''}</div></div>`)
      .join('');
  }

  function renderTabela(lista) {
    const contador = document.getElementById('contador');
    if (contador) contador.textContent = carregando
      ? 'Carregando do Supabase...'
      : `${lista.length} de ${registros.length} ${cfg.substantivo || 'registro(s)'}`;

    const alvo = document.getElementById('lista');
    if (!alvo) return;

    if (carregando) {
      alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Carregando</h3><p>Buscando os dados no Supabase...</p></div>`;
      return;
    }
    if (erro) {
      alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Dados indisponíveis</h3><p>${U.esc(erro)}</p><button class="btn btn-secundario" onclick="ConpremTela.carregar()">Tentar novamente</button></div>`;
      return;
    }
    if (!lista.length) {
      alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nada encontrado</h3><p>${registros.length
        ? 'Ajuste os filtros para ver outros registros.'
        : U.esc(cfg.textoVazio || 'Importe o relatório no Leitor de Recebidos, ou lance um registro manualmente.')}</p></div>`;
      return;
    }

    const linhas = lista.map(r => `<tr>
      ${cfg.colunas.map(c => `<td class="${c.classe || ''}">${c.html ? c.html(r) : U.esc(valorExibicao(r, c.campo) || '—')}</td>`).join('')}
      <td class="acoes-cel">
        <button class="icone-btn" title="Ver" onclick="ConpremTela.ver('${r.id}')">${ICN.olho}</button>
        ${Auth.pode('editar') ? `<button class="icone-btn" title="Editar" onclick="ConpremTela.editar('${r.id}')">${ICN.edit}</button>` : ''}
        ${Auth.pode('excluir') ? `<button class="icone-btn" title="Excluir" onclick="ConpremTela.excluir('${r.id}')">${ICN.del}</button>` : ''}
      </td>
    </tr>`).join('');

    alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
      <thead><tr>${cfg.colunas.map(c => `<th class="${c.classe || ''}">${U.esc(c.rotulo)}</th>`).join('')}<th></th></tr></thead>
      <tbody>${linhas}</tbody>
    </table></div>`;
  }

  function valorExibicao(r, campo) {
    const valor = r[campo];
    return tipoDe(campo) === 'data' ? U.dataBR(valor) : valor;
  }

  function registrarExportacao(lista) {
    if (!window.Exportacoes?.registrar) return;
    Exportacoes.registrar({
      titulo: cfg.titulo,
      nomeArquivo: cfg.nomeArquivo,
      filtros: Exportacoes.filtrosDaTela ? Exportacoes.filtrosDaTela() : undefined,
      secoes: [{
        titulo: cfg.titulo,
        columns: todosCampos().map(([campo, rotulo]) => ({ key: campo, label: rotulo })),
        rows: lista,
      }],
    });
  }

  /* --------------------------------------------------------- formulário */

  function montarFormulario() {
    const alvo = document.getElementById('formCampos');
    if (!alvo) return;
    alvo.innerHTML = cfg.campos.map(g => `
      <div class="form-secao">${U.esc(g.grupo)}</div>
      ${g.itens.map(([campo, rotulo, , tipo]) => campoHtml(campo, rotulo, tipo)).join('')}
    `).join('');

    todosCampos()
      .filter(([, , , tipo]) => tipo.startsWith('select:'))
      .forEach(([campo, , , tipo]) => {
        const nome = tipo.slice('select:'.length);
        const lista = (cfg.listas && cfg.listas[nome]) || [];
        const el = document.getElementById(campo);
        if (el) el.innerHTML = U.opcoes(lista, '', 'Selecione...');
      });
  }

  function campoHtml(campo, rotulo, tipo) {
    const id = U.esc(campo);
    const obrig = (cfg.obrigatorios || []).includes(campo) ? ' <span class="obrig">*</span>' : '';
    if (tipo === 'textarea') return `<div class="campo full"><label>${U.esc(rotulo)}${obrig}</label><textarea id="${id}"></textarea></div>`;
    if (tipo.startsWith('select:')) return `<div class="campo"><label>${U.esc(rotulo)}${obrig}</label><select id="${id}"></select></div>`;
    if (tipo === 'data') return `<div class="campo"><label>${U.esc(rotulo)}${obrig}</label><input id="${id}" type="date"></div>`;
    if (tipo === 'inteiro') return `<div class="campo"><label>${U.esc(rotulo)}${obrig}</label><input id="${id}" type="number" min="0"></div>`;
    if (tipo === 'numero') return `<div class="campo"><label>${U.esc(rotulo)}${obrig}</label><input id="${id}" type="number" step="any"></div>`;
    if (tipo === 'semana') return `<div class="campo"><label>${U.esc(rotulo)}${obrig} <span class="dica">(2026-S33)</span></label><input id="${id}" type="text" placeholder="2026-S33"></div>`;
    return `<div class="campo"><label>${U.esc(rotulo)}${obrig}</label><input id="${id}" type="text"></div>`;
  }

  function registroDoFormulario() {
    const reg = { id: document.getElementById('id')?.value || undefined };
    todosCampos().forEach(([campo]) => {
      const el = document.getElementById(campo);
      if (el) reg[campo] = el.value;
    });
    return reg;
  }

  function obter(id) {
    return registros.find(r => String(r.id) === String(id)) || null;
  }

  function abrirNovo() {
    if (!Auth.pode('criar')) { App.toast(Auth.mensagemSemPermissao('criar registros'), 'aviso'); return; }
    document.getElementById('id').value = '';
    todosCampos().forEach(([campo]) => { const el = document.getElementById(campo); if (el) el.value = ''; });
    if (cfg.aoAbrirNovo) cfg.aoAbrirNovo();
    document.getElementById('modalTitulo').textContent = cfg.tituloNovo || 'Novo registro';
    document.getElementById('modal').classList.add('aberto');
  }

  function editar(id) {
    if (!Auth.pode('editar')) { App.toast(Auth.mensagemSemPermissao('editar registros'), 'aviso'); return; }
    const r = obter(id);
    if (!r) return;
    document.getElementById('id').value = r.id;
    todosCampos().forEach(([campo]) => { const el = document.getElementById(campo); if (el) el.value = r[campo] || ''; });
    document.getElementById('modalTitulo').textContent = cfg.tituloEditar ? cfg.tituloEditar(r) : 'Editar registro';
    document.getElementById('modal').classList.add('aberto');
  }

  async function salvar() {
    const editando = !!document.getElementById('id')?.value;
    if (!Auth.pode(editando ? 'editar' : 'criar')) {
      App.toast(Auth.mensagemSemPermissao(editando ? 'editar registros' : 'criar registros'), 'aviso');
      return;
    }
    const reg = registroDoFormulario();
    const faltando = (cfg.obrigatorios || []).filter(c => !String(reg[c] || '').trim());
    if (faltando.length) {
      const rotulos = faltando.map(c => (todosCampos().find(([id]) => id === c) || [])[1] || c);
      App.toast(`Preencha: ${rotulos.join(', ')}.`, 'aviso');
      return;
    }

    const btn = document.querySelector('#modal .form-acoes .btn-primario');
    const texto = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando...'; }
    try {
      const salvo = await cfg.salvar(mapParaBanco(reg));
      const convertido = mapDoBanco(salvo);
      const idx = registros.findIndex(x => x.id === convertido.id);
      if (idx >= 0) registros[idx] = convertido;
      else registros.unshift(convertido);
      atualizarFiltroSemana();
      App.toast('Registro salvo no Supabase.');
      fecharModal();
      render();
    } catch (err) {
      console.error(`Erro ao salvar ${cfg.titulo}`, err);
      App.toast(mensagemErro(err), 'erro');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = texto || 'Salvar'; }
    }
  }

  async function excluir(id) {
    if (!Auth.pode('excluir')) { App.toast(Auth.mensagemSemPermissao('excluir registros'), 'aviso'); return; }
    const r = obter(id);
    if (!r) return;
    if (!App.confirmar(cfg.textoExcluir ? cfg.textoExcluir(r) : 'Excluir este registro?')) return;
    try {
      await cfg.remover(id);
      registros = registros.filter(x => String(x.id) !== String(id));
      atualizarFiltroSemana();
      App.toast('Registro excluído.', 'aviso');
      render();
    } catch (err) {
      console.error(`Erro ao excluir ${cfg.titulo}`, err);
      App.toast(mensagemErro(err), 'erro');
    }
  }

  /* -------------------------------------------------------------- ficha */

  function ver(id) {
    const r = obter(id);
    if (!r) return;
    const item = (rot, val) => `<div class="detalhe-item"><div class="rot">${U.esc(rot)}</div><div class="val">${U.esc(val || '—')}</div></div>`;
    const textareas = todosCampos().filter(([, , , tipo]) => tipo === 'textarea');

    const html = cfg.campos.map(g => {
      const itens = g.itens.filter(([, , , tipo]) => tipo !== 'textarea');
      if (!itens.length) return '';
      return `<div class="detalhe-secao">${U.esc(g.grupo)}</div>
        <div class="detalhe-grid">${itens.map(([campo, rotulo]) => item(rotulo, valorExibicao(r, campo))).join('')}</div>`;
    }).join('') + textareas
      .filter(([campo]) => r[campo])
      .map(([campo, rotulo]) => `<div class="detalhe-secao">${U.esc(rotulo)}</div><p style="font-size:13.5px;color:var(--cinza-texto)">${U.esc(r[campo])}</p>`)
      .join('');

    document.getElementById('verTitulo').textContent = cfg.tituloFicha ? cfg.tituloFicha(r) : 'Detalhe do registro';
    document.getElementById('verCorpo').innerHTML = html +
      `<div class="form-acoes">
        <button class="btn btn-secundario" onclick="ConpremTela.exportarFicha('${r.id}')">Exportar PDF</button>
        <button class="btn btn-secundario" onclick="ConpremTela.fecharVer()">Fechar</button>
        ${Auth.pode('editar') ? `<button class="btn btn-primario" onclick="ConpremTela.fecharVer(); ConpremTela.editar('${r.id}')">Editar</button>` : ''}
      </div>`;
    document.getElementById('modalVer').classList.add('aberto');
  }

  function exportarFicha(id) {
    const r = obter(id);
    if (!r || !window.Exportacoes?.exportarFichaPDF) return;
    Exportacoes.exportarFichaPDF({
      titulo: cfg.tituloFicha ? cfg.tituloFicha(r) : cfg.titulo,
      nomeArquivo: `${cfg.nomeArquivo}-${r.id}`,
      secoes: cfg.campos.map(g => ({
        titulo: g.grupo,
        itens: g.itens.map(([campo, rotulo]) => ({ rot: rotulo, val: valorExibicao(r, campo) })),
      })),
    });
  }

  function fecharModal() { document.getElementById('modal')?.classList.remove('aberto'); }
  function fecharVer() { document.getElementById('modalVer')?.classList.remove('aberto'); }

  /* ------------------------------------------------------------- início */

  async function iniciar(configuracao) {
    cfg = configuracao;
    if (!await Auth.exigirLogin()) return;

    App.montarLayout(cfg.chaveMenu, cfg.titulo, cfg.subtitulo);
    App.acoesTopo(`
      <button class="btn btn-secundario" onclick="location.href='conprem-leitor.html'">${ICN.upload}Leitor de Recebidos</button>
      ${Auth.pode('criar') ? `<button class="btn btn-primario" onclick="ConpremTela.abrirNovo()">${ICN.add}${U.esc(cfg.rotuloNovo || 'Novo registro')}</button>` : App.avisoModoConsulta()}
    `);

    montarFormulario();
    (cfg.filtros || []).forEach(f => {
      const el = document.getElementById(f.id);
      if (el) el.innerHTML = U.opcoes(f.opcoes(), '', f.placeholder || 'Todos');
    });

    ['busca', 'fSemana', ...(cfg.filtros || []).map(f => f.id)].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', render);
      el.addEventListener('change', render);
    });

    render();
    await carregar();
  }

  return {
    iniciar, carregar, render,
    abrirNovo, editar, salvar, excluir, ver, exportarFicha,
    fecharModal, fecharVer,
    registros: () => registros,
  };
})();

if (typeof window !== 'undefined') window.ConpremTela = ConpremTela;
