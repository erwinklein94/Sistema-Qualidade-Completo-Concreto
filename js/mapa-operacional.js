const MapaOperacional = (() => {
  let mapa, dados, dialogo, painel, ultimoFoco;
  let geracao = 0, limite = 40;
  const grupos = {}, ativos = { fornecedores: false, relatorios: false };
  const el = id => document.getElementById(id);
  function no(tag, texto, classe) {
    const elemento = document.createElement(tag);
    if (texto != null) elemento.textContent = texto;
    if (classe) elemento.className = classe;
    return elemento;
  }
  function botao(texto, acao) {
    const b = no('button', texto, 'btn btn-secundario'); b.type = 'button'; b.addEventListener('click', acao); return b;
  }
  function link(texto, href) {
    const a = no('a', texto, 'btn btn-secundario'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
  }
  function campo(lista, titulo, valor) {
    if (valor == null || valor === '') return;
    lista.append(no('dt', titulo), no('dd', Array.isArray(valor) ? valor.join(', ') : String(valor)));
  }
  function abrir(titulo) {
    if (!Auth.pode('gerenciarSistema')) return null;
    el('mapaModalTitulo').textContent = titulo;
    const corpo = el('mapaModalCorpo'); corpo.replaceChildren();
    if (!dialogo.open) { ultimoFoco = document.activeElement; dialogo.showModal(); }
    corpo.scrollTop = 0;
    return corpo;
  }
  function listaRelacionados(corpo, itens, titulo) {
    corpo.append(no('h3', `${titulo} (${itens.length})`));
    const lista = no('div', null, 'mapa-relacionados'); corpo.append(lista);
    let exibidos = 0;
    const mais = botao('Mostrar mais registros', adicionar);
    function adicionar() {
      for (const item of itens.slice(exibidos, exibidos + 30)) {
        lista.append(botao(`${item.nome}${item.data ? ' · ' + item.data : ''}`, () => abrirItem(item)));
      }
      exibidos += 30;
      if (exibidos >= itens.length) mais.remove();
    }
    corpo.append(mais); adicionar();
  }
  function abrirItem(item) {
    const corpo = abrir(item.nome); if (!corpo) return;
    const lista = no('dl', null, 'mapa-detalhes');
    campo(lista, 'Categoria', item.tipo === 'fornecedores' ? 'Fornecedor' : 'Relatório / registro');
    campo(lista, 'Módulo de origem', item.origem);
    campo(lista, 'Fornecedor', item.fornecedor);
    campo(lista, 'Data', item.data);
    campo(lista, 'Local informado', item.endereco || item.local || 'Não informado');
    campo(lista, 'Precisão da localização', item.precisao);
    campo(lista, 'Coordenadas', item.posicao?.map(n => n.toFixed(6)).join(', '));
    const rotulos = { status: 'Situação', resultado: 'Resultado', responsavel: 'Responsável', fiscal: 'Fiscal', contato: 'Contato', tipo: 'Tipo', projeto: 'Projeto', projetos: 'Projetos', subcomponente: 'Subcomponente', lote: 'Lote', lote_ensaiado: 'Lote ensaiado', numero_pedido: 'Pedido', nota_fiscal: 'Nota fiscal', qtd_inspecionado: 'Quantidade inspecionada', qtd_nc: 'Não conformidades', observacao: 'Observação', observacoes: 'Observações', informacoes_adicionais: 'Informações adicionais', audit_id: 'Identificador da auditoria', fonte_arquivo: 'Arquivo de origem' };
    for (const [k, label] of Object.entries(rotulos)) campo(lista, label, item.raw[k]);
    corpo.append(lista);
    const links = no('div', null, 'mapa-links');
    links.append(link('Abrir página de origem', item.pagina));
    if (item.posicao) links.append(link('Ver localização no Google Maps', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.posicao.join(','))}`));
    for (const [k, valor] of Object.entries(item.raw)) {
      if (!/link|url|arquivo/.test(k)) continue;
      const href = MapaDados.urlSegura(valor);
      if (href) links.append(link(k.replaceAll('_', ' '), href));
    }
    corpo.append(links);
    const detalhes = no('details'); detalhes.append(no('summary', 'Todos os campos do registro'));
    const dl = no('dl', null, 'mapa-detalhes');
    for (const [k, v] of Object.entries(item.raw)) {
      if (v == null || v === '') continue;
      campo(dl, k.replaceAll('_', ' '), typeof v === 'object' ? JSON.stringify(v, null, 2) : v);
    }
    detalhes.append(dl); corpo.append(detalhes);
    editorLocalizacao(corpo, item);
    const relacionados = item.relatorios || dados?.fornecedores.find(f => MapaDados.norm(f.nome) === MapaDados.norm(item.fornecedor))?.relatorios.filter(r => r.chave !== item.chave) || [];
    if (relacionados.length) listaRelacionados(corpo, relacionados, 'Relatórios relacionados ao fornecedor');
  }
  function editorLocalizacao(corpo, item) {
    const detalhes = no('details'); detalhes.append(no('summary', 'Informar ou corrigir localização deste registro'));
    detalhes.append(no('p', 'Informe coordenadas confirmadas. A alteração fica salva para os administradores e não modifica o relatório original.'));
    const form = no('form', null, 'mapa-form-local');
    for (const [nome, titulo, valor] of [['lat', 'Latitude', item.posicao?.[0]], ['lng', 'Longitude', item.posicao?.[1]], ['endereco', 'Endereço / referência', item.endereco || item.local]]) {
      const label = no('label', titulo); const input = no('input'); input.name = nome; input.value = valor ?? '';
      input.type = 'text'; if (nome !== 'endereco') { input.required = true; input.inputMode = 'decimal'; }
      label.append(input); form.append(label);
    }
    const salvar = no('button', 'Salvar localização', 'btn btn-primario'); salvar.type = 'submit';
    const status = no('p'); status.setAttribute('role', 'status'); form.append(salvar, status);
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); if (!Auth.pode('gerenciarSistema') || salvar.disabled) return;
      salvar.disabled = true; status.textContent = 'Salvando...';
      try {
        const valores = new FormData(form);
        const ajuste = await MapaDados.salvarLocalizacao(item.chave, valores.get('lat'), valores.get('lng'), valores.get('endereco'));
        if (!Auth.pode('gerenciarSistema') || !dados) return;
        dados.ajustes.set(item.chave, ajuste);
        Object.assign(dados, MapaDados.montar(dados.tabelas, dados.municipios, dados.ajustes));
        render(); abrirItem([...dados.fornecedores, ...dados.relatorios].find(i => i.chave === item.chave));
      } catch (_) { status.textContent = 'Não foi possível salvar. Confira as coordenadas, sua conexão e a permissão de administrador.'; }
      finally { salvar.disabled = false; }
    });
    detalhes.append(form); corpo.append(detalhes);
  }
  function abrirMalha(feature) {
    const corpo = abrir(feature.properties.nome || 'Ponto da malha Rumo'); if (!corpo) return;
    const [lng, lat, altitude] = feature.geometry.coordinates;
    const lista = no('dl', null, 'mapa-detalhes');
    campo(lista, 'Origem', 'Arquivo Malha Rumo.kmz.zip');
    campo(lista, 'Identificação', feature.properties.nome);
    campo(lista, 'Descrição original', feature.properties.descricao);
    campo(lista, 'Latitude', lat); campo(lista, 'Longitude', lng); campo(lista, 'Altitude informada no arquivo', altitude);
    corpo.append(lista, link('Ver localização no Google Maps', `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`));
    const proximos = dados ? [...dados.fornecedores, ...dados.relatorios].filter(i => i.posicao && mapa.distance([lat, lng], i.posicao) <= 50000).sort((a, b) => mapa.distance([lat, lng], a.posicao) - mapa.distance([lat, lng], b.posicao)) : [];
    corpo.append(no('p', 'Registros próximos são referências geográficas em até 50 km; não indicam vínculo com este ponto ferroviário.'));
    if (proximos.length) listaRelacionados(corpo, proximos, 'Fornecedores e relatórios próximos');
    else corpo.append(no('p', dados ? 'Nenhum registro localizado neste raio.' : 'Carregue as camadas de dados para consultar registros próximos.'));
  }
  function filtrados(tipo) {
    if (!dados) return [];
    const busca = MapaDados.norm(el('mapaBusca').value);
    return dados[tipo].filter(i => !busca || MapaDados.norm([i.nome, i.fornecedor, i.origem, i.local, i.data].join(' ')).includes(busca));
  }
  function render() {
    if (!dados || !mapa || !Auth.pode('gerenciarSistema')) return;
    for (const tipo of ['fornecedores', 'relatorios']) {
      grupos[tipo].clearLayers();
      const itens = filtrados(tipo), localizados = itens.filter(i => i.posicao);
      el(`mapaContagem-${tipo}`).textContent = `${localizados.length}/${itens.length} localizados`;
      const agrupados = new Map();
      for (const item of localizados) {
        const chave = item.posicao.map(n => n.toFixed(5)).join(',');
        if (!agrupados.has(chave)) agrupados.set(chave, []);
        agrupados.get(chave).push(item);
      }
      for (const itensPonto of agrupados.values()) {
        const marcador = L.marker(itensPonto[0].posicao, {
          title: `${tipo === 'fornecedores' ? 'Fornecedor' : 'Relatório'}: ${itensPonto[0].nome} (${itensPonto.length})`,
          icon: L.divIcon({ className: `mapa-marcador mapa-marcador-${tipo}`, html: String(itensPonto.length), iconSize: [26, 26], iconAnchor: tipo === 'fornecedores' ? [13, 30] : [13, -4] })
        });
        marcador.on('click', () => {
          if (itensPonto.length === 1) abrirItem(itensPonto[0]);
          else { const corpo = abrir(`${itensPonto.length} ${tipo} nesta localização`); if (corpo) listaRelacionados(corpo, itensPonto, 'Selecione um registro'); }
        });
        marcador.addTo(grupos[tipo]);
      }
    }
    const filtro = el('mapaListaTipo').value;
    const itens = ['fornecedores', 'relatorios'].filter(t => !filtro || t === filtro).flatMap(filtrados);
    const pendentes = el('mapaSomentePendentes').checked;
    const lista = pendentes ? itens.filter(i => !i.posicao) : itens;
    el('mapaListaResumo').textContent = `${lista.length} registros · ${itens.filter(i => !i.posicao).length} sem localização. Referências municipais são aproximadas.`;
    el('mapaLista').replaceChildren(...lista.slice(0, limite).map(item => {
      const b = botao('', () => abrirItem(item));
      b.classList.add('mapa-registro'); b.append(no('strong', item.nome), no('span', `${item.origem} · ${item.posicao ? item.precisao : 'Sem localização'}${item.data ? ' · ' + item.data : ''}`)); return b;
    }));
    el('mapaMais').hidden = lista.length <= limite;
  }
  async function carregar() {
    const versao = ++geracao;
    el('mapaAtualizarDados').disabled = true;
    el('mapaDadosStatus').textContent = 'Consultando fornecedores e relatórios do site...';
    try {
      const novos = await MapaDados.carregar();
      if (versao !== geracao || !Auth.pode('gerenciarSistema')) return;
      dados = novos;
      el('mapaDadosStatus').textContent = dados.erros.length ? `Carregamento parcial. Fontes indisponíveis: ${dados.erros.join(', ')}. Use Atualizar dados para tentar novamente.` : 'Dados atualizados. Ative as camadas desejadas. Registros sem localização estão disponíveis na lista.';
      for (const tipo of ['fornecedores', 'relatorios']) el(`mapaCamada-${tipo}`).disabled = false;
      render();
    } catch (_) { if (versao === geracao) el('mapaDadosStatus').textContent = 'Não foi possível carregar os dados. Verifique sua conexão e clique em Atualizar dados.'; }
    finally { if (versao === geracao) el('mapaAtualizarDados').disabled = false; }
  }
  function iniciar(instancia) {
    mapa = instancia;
    painel = el('mapaDadosPainel');
    painel.innerHTML = `
      <div class="mapa-camadas">
        <label><input type="checkbox" id="mapaCamada-fornecedores" disabled> <span class="mapa-legenda fornecedor"></span> Fornecedores <small id="mapaContagem-fornecedores"></small></label>
        <label><input type="checkbox" id="mapaCamada-relatorios" disabled> <span class="mapa-legenda relatorio"></span> Origem dos relatórios <small id="mapaContagem-relatorios"></small></label>
        <button type="button" class="btn btn-secundario" id="mapaEnquadrarDados">Enquadrar camadas ativas</button>
        <button type="button" class="btn btn-secundario" id="mapaAtualizarDados">Atualizar dados</button>
      </div><p id="mapaDadosStatus" role="status"></p>
      <details class="mapa-catalogo"><summary>Consultar registros e localizações pendentes</summary>
        <div class="mapa-filtros"><label>Buscar nome, módulo ou local<input id="mapaBusca" type="search" placeholder="Fornecedor, relatório ou cidade"></label>
          <label>Categoria<select id="mapaListaTipo"><option value="">Todas</option><option value="fornecedores">Fornecedores</option><option value="relatorios">Relatórios</option></select></label>
          <label><input id="mapaSomentePendentes" type="checkbox"> Somente sem localização</label></div>
        <p id="mapaListaResumo"></p><div id="mapaLista" class="mapa-lista"></div><button type="button" class="btn btn-secundario" id="mapaMais" hidden>Mostrar mais</button>
        <p class="mapa-fonte">Referências municipais: <a href="https://github.com/kelvins/municipios-brasileiros" target="_blank" rel="noopener noreferrer">Municípios Brasileiros</a>. Não representam o endereço exato das instalações.</p>
      </details>`;
    dialogo = document.createElement('dialog'); dialogo.id = 'mapaModal'; dialogo.className = 'mapa-modal';
    dialogo.setAttribute('aria-labelledby', 'mapaModalTitulo');
    dialogo.innerHTML = '<header><h2 id="mapaModalTitulo"></h2><button type="button" class="btn btn-secundario" id="mapaModalFechar" aria-label="Fechar detalhes">Fechar</button></header><div id="mapaModalCorpo"></div>';
    document.body.append(dialogo);
    el('mapaModalFechar').addEventListener('click', () => dialogo.close());
    dialogo.addEventListener('keydown', e => { if (e.key === 'Escape') e.stopPropagation(); });
    dialogo.addEventListener('close', () => ultimoFoco?.isConnected && ultimoFoco.focus());
    for (const tipo of ['fornecedores', 'relatorios']) {
      grupos[tipo] = L.layerGroup();
      el(`mapaCamada-${tipo}`).addEventListener('change', e => {
        ativos[tipo] = e.target.checked;
        if (ativos[tipo]) grupos[tipo].addTo(mapa); else mapa.removeLayer(grupos[tipo]);
      });
    }
    for (const id of ['mapaBusca', 'mapaListaTipo', 'mapaSomentePendentes']) el(id).addEventListener(id === 'mapaBusca' ? 'input' : 'change', () => { limite = 40; render(); });
    el('mapaMais').addEventListener('click', () => { limite += 40; render(); });
    el('mapaAtualizarDados').addEventListener('click', carregar);
    el('mapaEnquadrarDados').addEventListener('click', () => {
      const posicoes = Object.keys(ativos).filter(t => ativos[t]).flatMap(t => filtrados(t)).filter(i => i.posicao).map(i => i.posicao);
      if (posicoes.length) mapa.fitBounds(posicoes, { padding: [40, 40], maxZoom: 14 });
      else el('mapaDadosStatus').textContent = 'Ative uma camada com registros localizados para enquadrar seus pontos.';
    });
    carregar();
  }
  function limpar() {
    geracao++; dados = null; mapa = null;
    Object.values(grupos).forEach(grupo => grupo.clearLayers());
    dialogo?.close(); dialogo?.remove(); painel?.replaceChildren();
  }
  return { iniciar, abrirMalha, limpar };
})();
window.MapaOperacional = MapaOperacional;
