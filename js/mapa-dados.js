/* Dados autenticados do mapa. Não exporta registros operacionais para arquivos públicos. */
const MapaDados = (() => {
  const FONTES = [
    ['madeira_inspecoes', 'Madeira', 'madeira-inspecoes.html', 'id'],
    ['lastro_inspecoes', 'Lastro', 'lastro-inspecoes.html', 'id'],
    ['amv_inspecoes', 'AMV', 'amv-inspecoes.html', 'id'],
    ['inspecoes_subcomponentes', 'Subcomponentes', 'subcomponentes.html#inspecoes'],
    ['madeira_lei_registros', 'Madeira de lei', 'madeira-lei.html#registros'],
    ['inspecoes_pista', 'Cavan · Pista', 'inspecao-pista.html', 'lote', 'CAVAN'],
    ['inspecoes_concretagem', 'Cavan · Concretagem', 'inspecao-concretagem.html', 'lote', 'CAVAN'],
    ['ensaios_liberacao', 'Cavan · Liberação', 'ensaios-liberacao.html', 'lote', 'CAVAN'],
    ['ensaios_acompanhamento', 'Cavan · Acompanhamento', 'ensaios-acompanhamento.html', '', 'CAVAN'],
    ['ensaios_bitola', 'Cavan · Bitola', 'ensaio-bitola.html', '', 'CAVAN'],
    ['ensaios_arrancamento_usp', 'Cavan · Arrancamento USP', 'ensaio-arrancamento-usp.html', '', 'CAVAN'],
    ['conprem_inspecoes_pista', 'Conprem · Pista', 'conprem-inspecao-pista.html', 'lote', 'CONPREM-MG'],
    ['conprem_inspecoes_concretagem', 'Conprem · Concretagem', 'conprem-inspecao-concretagem.html', 'lote', 'CONPREM-MG'],
    ['conprem_ensaios_dormentes', 'Conprem · Ensaios', 'conprem-ensaios.html', '', 'CONPREM-MG']
  ];
  const PREFIXO = 'mapa.localizacao.';
  const norm = valor => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');
  function coordenadas(lat, lng) {
    if (lat == null || lng == null || String(lat).trim() === '' || String(lng).trim() === '') return null;
    lat = Number(String(lat).replace(',', '.')); lng = Number(String(lng).replace(',', '.'));
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
  }
  function extrairCoordenadas(valor) {
    const s = String(valor || '').trim();
    const match = s.match(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/)
      || s.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*$/);
    return match ? coordenadas(match[1], match[2]) : null;
  }
  function indiceMunicipios(linhas) {
    const indice = new Map();
    for (const [nome, uf, lat, lng] of linhas) {
      indice.set(`${norm(nome)}|${uf}`, [lat, lng]);
      const chave = norm(nome);
      indice.set(chave, indice.has(chave) ? null : [lat, lng]);
    }
    return indice;
  }
  function municipio(texto, indice) {
    const s = norm(texto).replace(/\([^)]*\)/g, '').trim();
    // Cidade/UF, Cidade - UF e endereços com município explícito; sem busca aproximada por nome.
    const partes = s.split(',').map(v => v.trim());
    for (let i = partes.length - 1; i >= 0; i--) {
      const m = partes[i].match(/^(.+?)\s*[-/]\s*([A-Z]{2})$/);
      const chave = m ? `${m[1].trim()}|${m[2]}` : /^[A-Z]{2}$/.test(partes[i + 1] || '') ? `${partes[i]}|${partes[i + 1]}` : null;
      if (chave && indice.has(chave)) return indice.get(chave);
    }
    return indice.get(s) || null;
  }
  function resolver(item, ajustes, indice) {
    const ajuste = ajustes.get(item.chave);
    const manual = ajuste && coordenadas(ajuste.lat, ajuste.lng);
    if (manual) return { posicao: manual, precisao: 'Coordenadas informadas pelo admin', endereco: ajuste.endereco || item.local || '' };
    const exata = coordenadas(item.raw.latitude, item.raw.longitude) || extrairCoordenadas(item.local);
    if (exata) return { posicao: exata, precisao: 'Coordenadas do registro', endereco: item.local || '' };
    const aproximada = municipio(item.local, indice);
    if (aproximada) return { posicao: aproximada, precisao: 'Referência aproximada do município; não é o endereço exato', endereco: item.local };
    return { posicao: null, precisao: 'Localização pendente', endereco: item.local || '' };
  }
  function urlSegura(valor) {
    try { const u = new URL(String(valor)); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch (_) { return null; }
  }
  function linkOrigem(fonte, raw) {
    const [, , pagina, filtro] = fonte;
    const valor = filtro === 'id' ? raw.id : filtro === 'lote' ? raw.lote || raw.lote_ensaiado : '';
    return valor ? `${pagina}?${filtro}=${encodeURIComponent(valor)}` : pagina;
  }
  function montar(tabelas, municipios, ajustes = new Map()) {
    const indice = indiceMunicipios(municipios);
    const fornecedores = new Map();
    for (const r of tabelas.empresas_subcomponentes || []) {
      const item = { chave: `fornecedor.${r.id}`, tipo: 'fornecedores', nome: r.nome, local: r.cidade || '', raw: r, origem: 'Cadastro de empresas', pagina: 'subcomponentes.html#empresas', relatorios: [] };
      Object.assign(item, resolver(item, ajustes, indice)); fornecedores.set(norm(r.nome), item);
    }
    for (const r of tabelas.listas_configuracao || []) {
      if (r.ativo === false || !/fornec/i.test(r.tipo_lista) || !r.valor || fornecedores.has(norm(r.valor))) continue;
      const item = { chave: `fornecedor.nome.${norm(r.valor)}`, tipo: 'fornecedores', nome: r.valor, local: '', raw: r, origem: 'Cadastro de fornecedores do sistema', pagina: 'dados.html', relatorios: [] };
      Object.assign(item, resolver(item, ajustes, indice)); fornecedores.set(norm(r.valor), item);
    }
    const relatorios = [];
    for (const fonte of FONTES) {
      for (const r of tabelas[fonte[0]] || []) {
        const empresa = [...fornecedores.values()].find(f => r.empresa_id && f.raw.id === r.empresa_id);
        const fornecedor = (norm(r.fornecedor) === 'OUTRO' ? r.fornecedor_outro : r.fornecedor) || empresa?.nome || r.empresa_nome || fonte[4] || '';
        const item = { chave: `${fonte[0]}.${r.id}`, tipo: 'relatorios', nome: r.audit_nome || `${fonte[1]} · ${fornecedor || 'Fornecedor não informado'}`, fornecedor, local: r.localizacao || r.local || '', data: r.data_inspecao || r.dia_inspecao || r.data_ensaio || r.data_ref || '', raw: r, origem: fonte[1], pagina: linkOrigem(fonte, r) };
        Object.assign(item, resolver(item, ajustes, indice));
        // Só usa a unidade quando declarada como local ou quando o módulo é específico da fábrica.
        const unidade = fornecedores.get(norm(item.local || fonte[4]));
        if (!item.posicao && unidade?.posicao && !ajustes.has(item.chave)) {
          item.posicao = unidade.posicao; item.precisao = `Referência da unidade ${unidade.nome}; posição da inspeção não informada`;
        }
        relatorios.push(item);
        if (fornecedor) {
          const chave = norm(fornecedor);
          if (!fornecedores.has(chave)) {
            const f = { chave: `fornecedor.nome.${chave}`, tipo: 'fornecedores', nome: fornecedor.trim(), local: '', raw: { nome: fornecedor.trim() }, origem: 'Fornecedor citado nos relatórios', pagina: fonte[2], relatorios: [] };
            Object.assign(f, resolver(f, ajustes, indice)); fornecedores.set(chave, f);
          }
          fornecedores.get(chave).relatorios.push(item);
        }
      }
    }
    return { fornecedores: [...fornecedores.values()], relatorios };
  }
  function exigirAdmin() { if (!window.Auth?.pode('gerenciarSistema')) throw new Error('Acesso restrito ao admin.'); }
  async function listar(cliente, tabela, filtro) {
    const resultado = [];
    for (let inicio = 0; ; inicio += 500) {
      exigirAdmin();
      let q = cliente.from(tabela).select('*').order('id').range(inicio, inicio + 499);
      if (filtro) q = q.like('chave', `${PREFIXO}%`);
      const { data, error } = await q;
      if (error) throw error;
      resultado.push(...data);
      if (data.length < 500) return resultado;
    }
  }
  async function carregar() {
    exigirAdmin();
    const cliente = Auth.cliente();
    if (!cliente) throw new Error('Conexão indisponível.');
    const nomes = ['empresas_subcomponentes', 'listas_configuracao', ...FONTES.map(f => f[0]), 'configuracoes_sistema'];
    const resultados = await Promise.allSettled(nomes.map(n => listar(cliente, n, n === 'configuracoes_sistema')));
    exigirAdmin();
    const tabelas = {}, erros = [], ajustes = new Map();
    resultados.forEach((r, i) => {
      if (r.status === 'fulfilled') tabelas[nomes[i]] = r.value;
      else erros.push(nomes[i]);
    });
    for (const config of tabelas.configuracoes_sistema || []) {
      try { ajustes.set(config.chave.slice(PREFIXO.length), JSON.parse(config.valor)); } catch (_) { erros.push('Localização salva inválida'); }
    }
    const resposta = await fetch('assets/data/municipios-mapa.json?v=1');
    if (!resposta.ok) throw new Error('Não foi possível carregar as referências de municípios.');
    const { municipios } = await resposta.json();
    exigirAdmin();
    return { tabelas, municipios, ajustes, erros, ...montar(tabelas, municipios, ajustes) };
  }
  async function salvarLocalizacao(chave, lat, lng, endereco) {
    exigirAdmin();
    const posicao = coordenadas(lat, lng);
    if (!posicao) throw new Error('Informe latitude entre -90 e 90 e longitude entre -180 e 180.');
    const valor = { lat: posicao[0], lng: posicao[1], endereco: String(endereco || '').trim() };
    const { error } = await Auth.cliente().from('configuracoes_sistema').upsert({ chave: PREFIXO + chave, valor: JSON.stringify(valor), descricao: 'Localização confirmada no mapa de origens' }, { onConflict: 'chave' });
    if (error) throw error;
    return valor;
  }
  return { FONTES, norm, coordenadas, extrairCoordenadas, indiceMunicipios, municipio, montar, carregar, salvarLocalizacao, urlSegura };
})();
if (typeof window !== 'undefined') window.MapaDados = MapaDados;
if (typeof module !== 'undefined') module.exports = MapaDados;
