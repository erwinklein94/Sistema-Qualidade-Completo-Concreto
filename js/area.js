/* =====================================================================
   AREA.JS — Qual empresa a página está exibindo (Cavan ou Conprem)

   As telas de dormentes de concreto são as mesmas para as duas empresas;
   o que muda é a tabela do Supabase de onde leem e gravam e o fornecedor
   que aparece nos formulários. Cada página da área Conprem declara
   `window.AREA_EMPRESA = 'conprem'` ANTES de carregar os scripts; sem essa
   declaração, tudo continua como sempre foi — Cavan.

   As tabelas da Conprem foram separadas de verdade em
   supabase/2026-08-19-area-conprem.sql: são as mesmas colunas, com o
   prefixo conprem_.
   ===================================================================== */
const Area = (() => {
  const AREAS = Object.freeze({
    cavan: {
      id: 'cavan',
      nome: 'Cavan',
      rotulo: 'Cavan SP',
      fornecedor: 'Cavan SP',
      grupoMenu: 'concreto',
      home: 'index.html',
    },
    conprem: {
      id: 'conprem',
      nome: 'Conprem',
      rotulo: 'Conprem MG',
      fornecedor: 'Conprem MG',
      grupoMenu: 'conprem',
      home: 'conprem-dashboard.html',
    },
  });

  // Só estas têm tabela própria da Conprem. Qualquer outra continua única
  // (usuários, auditoria, especificações, subcomponentes, glossários...).
  const TABELAS_SEPARADAS = Object.freeze([
    'producao_lotes',
    'reprovados',
    'inspecoes_pista',
    'inspecoes_concretagem',
    'pedidos_dormentes',
    'ensaios_liberacao',
  ]);

  function atual() {
    const chave = String(window.AREA_EMPRESA || 'cavan').toLowerCase();
    return AREAS[chave] || AREAS.cavan;
  }

  function id() { return atual().id; }
  function ehConprem() { return id() === 'conprem'; }
  function nome() { return atual().nome; }
  function fornecedor() { return atual().fornecedor; }
  function fornecedores() { return [atual().fornecedor]; }
  function home() { return atual().home; }
  function grupoMenu() { return atual().grupoMenu; }

  /** Nome real da tabela no Supabase para a área ativa. */
  function tabela(nome) {
    return ehConprem() && TABELAS_SEPARADAS.includes(nome) ? `conprem_${nome}` : nome;
  }

  /** Chave do item de menu correspondente à página na área ativa. */
  function chaveMenu(chave) {
    return ehConprem() ? `conprem-${chave}` : chave;
  }

  /** Sufixo para chaves de configuração por área (quadro de avisos etc.). */
  function sufixoChave(chave) {
    return ehConprem() ? `${chave}-conprem` : chave;
  }

  /** Título de página com a empresa explícita, para não confundir as áreas. */
  function titulo(base) {
    return ehConprem() ? `${base} — Conprem` : base;
  }

  // Páginas que existem nas duas áreas. Os botões de atalho das telas
  // compartilhadas passam por aqui para não jogar o usuário da Conprem
  // na tela equivalente da Cavan.
  const PAGINAS_CONPREM = Object.freeze({
    'index.html': 'conprem-dashboard.html',
    'producao.html': 'conprem-producao.html',
    'reprovados.html': 'conprem-reprovados.html',
    'inspecao-concretagem.html': 'conprem-inspecao-concretagem.html',
    'inspecao-pista.html': 'conprem-inspecao-pista.html',
    'pedidos.html': 'conprem-pedidos.html',
  });

  /** Arquivo equivalente da página na área ativa. Sem par, devolve o original. */
  function pagina(arquivo) {
    return ehConprem() ? (PAGINAS_CONPREM[arquivo] || arquivo) : arquivo;
  }

  /** A página existe na área ativa? Usado para esconder atalhos só da Cavan. */
  function temPagina(arquivo) {
    return !ehConprem() || Object.prototype.hasOwnProperty.call(PAGINAS_CONPREM, arquivo);
  }

  return {
    AREAS,
    TABELAS_SEPARADAS,
    atual,
    id,
    ehConprem,
    nome,
    fornecedor,
    fornecedores,
    home,
    grupoMenu,
    tabela,
    chaveMenu,
    sufixoChave,
    titulo,
    pagina,
    temPagina,
  };
})();

if (typeof window !== 'undefined') window.Area = Area;
