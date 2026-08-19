/* =====================================================================
   CONPREM-REPROVADOS.JS — Dormentes Reprovados da CONPREM

   Os campos são os do Resumo Semanal CONPREM - RUMO, e só eles. A
   Conprem não reporta reprova lote a lote com molde e cavidade como a
   Cavan: ela fecha a semana, com o refugo já repartido por tipo. Por
   isso aqui é uma linha por SEMANA, e não uma por reprova.

   A mecânica vem de js/conprem-tela.js; aqui ficam só os campos.
   ===================================================================== */

const CAMPOS_REPROVADOS_CONPREM = [
  { grupo: 'Resumo da semana', itens: [
    ['semanaRef', 'Semana', 'semana', 'semana'],
    ['numeroResumo', 'Nº resumo', 'numero_resumo', 'texto'],
    ['dataEmissao', 'Data emissão', 'data_emissao', 'data'],
    ['periodoIni', 'Período início', 'periodo_inicio', 'data'],
    ['periodoFim', 'Período fim', 'periodo_fim', 'data'],
    ['unidade', 'Unidade', 'unidade', 'texto'],
    ['produtoMaterial', 'Produto/Material', 'produto_material', 'texto'],
    ['pedidoLocal', 'Pedido/Local', 'pedido_local', 'texto'],
    ['projeto', 'Projeto', 'projeto', 'select:projetos'],
  ]},
  { grupo: 'Produção e ensaios', itens: [
    ['qtdFabricada', 'Qtd. fabricada', 'qtd_fabricada', 'inteiro'],
    ['ensaiosRealizados', 'Ensaios realizados', 'ensaios_realizados', 'inteiro'],
    ['ensaiosPorMil', 'Ensaios por 1.000', 'ensaios_por_mil', 'numero'],
  ]},
  { grupo: 'Refugos da semana', itens: [
    ['refugoFissuras', 'Fissuras', 'refugo_fissuras', 'inteiro'],
    ['refugoVazios', 'Vazios', 'refugo_vazios', 'inteiro'],
    ['refugoOmbreiras', 'Ombreiras', 'refugo_ombreiras', 'inteiro'],
    ['refugoQuebras', 'Quebras', 'refugo_quebras', 'inteiro'],
    ['refugoUsp', 'USP', 'refugo_usp', 'inteiro'],
    ['refugoFalhasFabricacao', 'Falhas fabricação', 'refugo_falhas_fabricacao', 'inteiro'],
    ['refugoOutros', 'Outros', 'refugo_outros', 'inteiro'],
    ['totalRefugos', 'Total refugos', 'total_refugos', 'inteiro'],
    ['taxaRefugo', 'Taxa de refugo', 'taxa_refugo', 'numero'],
  ]},
  { grupo: 'Planejamento da semana seguinte', itens: [
    ['planejamentoInicio', 'Planejamento início', 'planejamento_inicio', 'data'],
    ['planejamentoFim', 'Planejamento fim', 'planejamento_fim', 'data'],
    ['qtdPlanejada', 'Qtd. planejada', 'qtd_planejada', 'inteiro'],
  ]},
];

/* Cada coluna de refugo no vocabulário de motivo que o resto do sistema usa. */
const REFUGOS_CONPREM = [
  ['refugoFissuras', 'Fissuras'],
  ['refugoVazios', 'Vazios'],
  ['refugoOmbreiras', 'Ombreiras'],
  ['refugoQuebras', 'Quebras'],
  ['refugoUsp', 'USP'],
  ['refugoFalhasFabricacao', 'Falhas fabricação'],
  ['refugoOutros', 'Outros'],
];

function refugosPorTipo(lista) {
  const mapa = new Map(REFUGOS_CONPREM.map(([, nome]) => [nome, 0]));
  lista.forEach(r => REFUGOS_CONPREM.forEach(([campo, nome]) => {
    mapa.set(nome, mapa.get(nome) + (parseInt(r[campo], 10) || 0));
  }));
  return [...mapa.entries()].filter(([, qtd]) => qtd > 0).sort((a, b) => b[1] - a[1]);
}

document.addEventListener('DOMContentLoaded', () => {
  ConpremTela.iniciar({
    chaveMenu: 'reprovados',
    titulo: 'Dormentes Reprovados — Conprem',
    subtitulo: 'Resumo Semanal CONPREM - RUMO: uma linha por semana, com o refugo repartido por tipo',
    migracao: 'supabase/2026-08-19-reprovados-campos-resumo-semanal.sql',
    listar: () => StoreSupabase.listarReprovados({ limite: 5000 }),
    salvar: reg => StoreSupabase.salvarReprovado(reg),
    remover: id => StoreSupabase.removerReprovado(id),
    campos: CAMPOS_REPROVADOS_CONPREM,
    listas: { get projetos() { return CFG.listas.projetos; } },
    obrigatorios: ['semanaRef'],
    substantivo: 'semana(s)',
    nomeArquivo: 'conprem-reprovados',
    rotuloNovo: 'Novo resumo semanal',
    tituloNovo: 'Novo resumo semanal da Conprem',
    tituloEditar: r => `Editar resumo ${r.semanaRef}`,
    tituloFicha: r => `Resumo Semanal ${r.semanaRef}`,
    textoExcluir: r => `Excluir o resumo semanal ${r.semanaRef}?`,
    textoVazio: 'Importe o Resumo Semanal no Leitor de Recebidos, ou lance a semana manualmente.',

    filtros: [
      { id: 'fProjeto', campo: 'projeto', placeholder: 'Todos', opcoes: () => CFG.listas.projetos },
    ],

    // A tabela exige lote e o resumo é da semana toda: a semana ocupa o campo,
    // escrita de forma que ninguém confunda com número de lote de verdade.
    aoSalvar: (payload, reg) => {
      payload.lote = `Semana ${reg.semanaRef}`;
      payload.data_producao = payload.periodo_fim || payload.periodo_inicio;
      payload.motivo_detalhado = 'Resumo Semanal CONPREM — fechamento da semana';
      // total_refugos é NOT NULL no banco; campo em branco vira zero, não nulo.
      payload.total_refugos = payload.total_refugos ?? 0;
    },

    ordenar: (a, b) => String(b.periodoFim).localeCompare(String(a.periodoFim)) || String(b.semanaRef).localeCompare(String(a.semanaRef)),

    colunas: [
      { campo: 'semanaRef', rotulo: 'Semana', html: r => `<strong>${U.esc(r.semanaRef || '—')}</strong>` },
      { rotulo: 'Período', html: r => U.esc(`${U.dataBR(r.periodoIni)} a ${U.dataBR(r.periodoFim)}`) },
      { campo: 'qtdFabricada', rotulo: 'Fabricados', classe: 'right' },
      { campo: 'ensaiosRealizados', rotulo: 'Ensaios', classe: 'right' },
      { campo: 'totalRefugos', rotulo: 'Refugos', classe: 'right', html: r => `<span class="badge badge-reprovado">${U.esc(r.totalRefugos || '0')}</span>` },
      { rotulo: 'Taxa', classe: 'right', html: r => U.esc(formatarTaxa(r.taxaRefugo)) },
      { rotulo: 'Motivos dos refugos', html: r => chipsRefugos(r) },
      { campo: 'qtdPlanejada', rotulo: 'Planejado p/ semana seguinte', classe: 'right' },
    ],

    kpis: lista => {
      const fabricados = soma(lista, 'qtdFabricada');
      const refugos = soma(lista, 'totalRefugos');
      const ensaios = soma(lista, 'ensaiosRealizados');
      const taxa = fabricados ? refugos / fabricados : 0;
      const top = refugosPorTipo(lista)[0];
      return [
        { rotulo: 'Semanas no filtro', valor: lista.length, extra: 'resumos recebidos', cor: 'escuro' },
        { rotulo: 'Dormentes fabricados', valor: fabricados.toLocaleString('pt-BR'), extra: `${ensaios} ensaio(s) realizado(s)` },
        { rotulo: 'Refugos', valor: refugos.toLocaleString('pt-BR'), extra: `taxa de ${formatarTaxa(taxa)} no período`, cor: 'vermelho' },
        { rotulo: 'Maior motivo', valor: top ? top[0] : '—', extra: top ? `${top[1]} refugo(s)` : 'sem refugo no recorte', cor: 'amarelo' },
      ];
    },
  });
});

/* Motivo e quantidade lado a lado na própria lista: é o que se quer ver de
   relance na semana, sem abrir a ficha. Só os tipos com refugo aparecem. */
function chipsRefugos(r) {
  const tipos = refugosPorTipo([r]);
  if (!tipos.length) return '<span class="txt-mini txt-cinza">Sem refugo na semana</span>';
  const chips = tipos
    .map(([nome, qtd]) => `<span class="badge badge-reprovado" title="${U.esc(nome)}: ${qtd} dormente(s)">${U.esc(nome)} <strong>${qtd}</strong></span>`)
    .join(' ');
  return `<div class="refugo-chips">${chips}${divergencia(r)}</div>`;
}

/* O relatório traz o total num campo e o detalhamento em outro. Quando os dois
   não fecham, quem olha a tela precisa saber — o detalhamento pode ter vindo
   errado do PDF, ou alguém editou só um dos lados. */
function divergencia(r) {
  const declarado = parseInt(r.totalRefugos, 10);
  if (!Number.isFinite(declarado)) return '';
  const somaTipos = refugosPorTipo([r]).reduce((n, [, q]) => n + q, 0);
  if (somaTipos === declarado) return '';
  return ` <span class="badge badge-amarelo" title="O campo Total refugos diz ${declarado}, mas os tipos somam ${somaTipos}.">total ${declarado} ≠ ${somaTipos}</span>`;
}

function soma(lista, campo) {
  return lista.reduce((n, r) => n + (parseInt(r[campo], 10) || 0), 0);
}

/* A taxa vem como fração no relatório (0,0065 = 0,65%). */
function formatarTaxa(v) {
  const n = Number(String(v == null ? '' : v).replace(',', '.'));
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}
