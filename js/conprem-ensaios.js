/* =====================================================================
   CONPREM-ENSAIOS.JS — Ensaio de Dormentes (FR.10/08) da CONPREM

   As 45 colunas do relatório que a CONPREM envia toda semana: um ensaio
   completo por lote, com gabaritos, dimensional, cargas, USP e resultado
   geral. Não é o ensaio de liberação da Cavan, que registra a decisão de
   liberar uma série — é o laudo do dormente.

   A mecânica vem de js/conprem-tela.js; aqui ficam só os campos.
   ===================================================================== */

const RESULTADOS_ENSAIO = ['Aprovado', 'Reprovado', 'Pendente'];
const TURNOS = ['DIA', 'NOITE'];

const CAMPOS_ENSAIOS_CONPREM = [
  { grupo: 'Identificação', itens: [
    ['semanaRef', 'Semana', 'semana', 'semana'],
    ['ordemFabricacao', 'OF', 'ordem_fabricacao', 'texto'],
    ['pedido', 'Pedido', 'pedido', 'texto'],
    ['cliente', 'Cliente', 'cliente', 'texto'],
    ['lote', 'Lote', 'lote_ensaiado', 'texto'],
    ['dataFabricacao', 'Data fabricação', 'data_fabricacao', 'data'],
    ['turno', 'Turno', 'turno', 'select:turnos'],
    ['dataEnsaio', 'Data ensaio', 'data_ensaio', 'data'],
    ['pista', 'Pista', 'pista', 'numero'],
    ['molde', 'Molde', 'molde', 'numero'],
    ['linha', 'Linha', 'linha', 'numero'],
    ['projeto', 'Projeto', 'projeto', 'select:projetos'],
  ]},
  { grupo: 'Gabaritos e geometria', itens: [
    ['medExtPassa', 'Medida externa — passa', 'med_ext_passa', 'texto'],
    ['medExtNaoPassa', 'Medida externa — não passa', 'med_ext_nao_passa', 'texto'],
    ['medIntPassa', 'Medida interna — passa', 'med_int_passa', 'texto'],
    ['medIntNaoPassa', 'Medida interna — não passa', 'med_int_nao_passa', 'texto'],
    ['inclinacao1', 'Inclinação 1', 'inclinacao_1', 'texto'],
    ['inclinacao2', 'Inclinação 2', 'inclinacao_2', 'texto'],
    ['torcaoRelativa', 'Torção relativa', 'torcao_relativa', 'numero'],
    ['alturaOmbreira1', 'Altura ombreira 1', 'altura_ombreira_1', 'texto'],
    ['alturaOmbreira2', 'Altura ombreira 2', 'altura_ombreira_2', 'texto'],
    ['posicaoInsertos', 'Posição insertos', 'posicao_insertos', 'texto'],
    ['montagemFixacoes', 'Montagem fixações', 'montagem_fixacoes', 'texto'],
  ]},
  { grupo: 'Dimensional (mm)', itens: [
    ['comprimento', 'Comprimento mm', 'comprimento_mm', 'numero'],
    ['larguraApoioSup', 'Largura apoio sup. mm', 'largura_apoio_sup_mm', 'numero'],
    ['larguraApoioInf', 'Largura apoio inf. mm', 'largura_apoio_inf_mm', 'numero'],
    ['alturaApoio', 'Altura apoio mm', 'altura_apoio_mm', 'numero'],
    ['larguraCentroSup', 'Largura centro sup. mm', 'largura_centro_sup_mm', 'numero'],
    ['larguraCentroInf', 'Largura centro inf. mm', 'largura_centro_inf_mm', 'numero'],
    ['alturaCentro', 'Altura centro mm', 'altura_centro_mm', 'numero'],
  ]},
  { grupo: 'Cargas, USP e aderência', itens: [
    ['momentoPosApoio', 'Momento + apoio', 'momento_pos_apoio', 'texto'],
    ['momentoNegApoio', 'Momento − apoio', 'momento_neg_apoio', 'texto'],
    ['momentoPosCentro', 'Momento + centro', 'momento_pos_centro', 'texto'],
    ['momentoNegCentro', 'Momento − centro', 'momento_neg_centro', 'texto'],
    ['arrancamentoOmbreiras', 'Arrancamento ombreiras', 'arrancamento_ombreiras', 'texto'],
    ['precargaUsp', 'Pré-carga USP kgf', 'precarga_usp_kgf', 'numero'],
    ['cargaMaxUsp', 'Carga máx. USP kgf', 'carga_max_usp_kgf', 'numero'],
    ['resultadoUsp', 'Resultado USP', 'resultado_usp', 'texto'],
    ['torcaoOmbreiras', 'Torção ombreiras', 'torcao_ombreiras', 'texto'],
    ['aderenciaCargaFinal', 'Aderência/carga final', 'aderencia_carga_final', 'texto'],
  ]},
  { grupo: 'Conclusão', itens: [
    ['bitola', 'Bitola', 'bitola', 'select:bitolas'],
    ['executor', 'Executor', 'executor', 'texto'],
    ['relatorioFotografico', 'Relatório fotográfico', 'relatorio_fotografico', 'texto'],
    ['fiscalizacao', 'Fiscalização', 'fiscalizacao', 'texto'],
    ['resultado', 'Resultado geral', 'resultado', 'select:resultados'],
    ['observacoes', 'Observações', 'observacoes', 'textarea'],
  ]},
];

document.addEventListener('DOMContentLoaded', () => {
  ConpremTela.iniciar({
    chaveMenu: 'ensaios',
    titulo: 'Ensaios de Dormentes — Conprem',
    subtitulo: 'Relatório FR.10/08: gabaritos, dimensional, cargas, USP e resultado geral por lote ensaiado',
    migracao: 'supabase/2026-08-19-conprem-ensaios-dormentes.sql',
    listar: () => StoreSupabase.listarEnsaiosDormentesConprem({ limite: 5000 }),
    salvar: reg => StoreSupabase.salvarEnsaioDormenteConprem(reg),
    remover: id => StoreSupabase.removerEnsaioDormenteConprem(id),
    campos: CAMPOS_ENSAIOS_CONPREM,
    listas: {
      turnos: TURNOS,
      resultados: RESULTADOS_ENSAIO,
      get projetos() { return CFG.listas.projetos; },
      get bitolas() { return CFG.listas.bitolas; },
    },
    obrigatorios: ['lote', 'dataEnsaio'],
    substantivo: 'ensaio(s)',
    nomeArquivo: 'conprem-ensaios-dormentes',
    rotuloNovo: 'Novo ensaio',
    tituloNovo: 'Novo ensaio de dormente',
    tituloEditar: r => `Editar ensaio do lote ${r.lote}`,
    tituloFicha: r => `Ensaio do lote ${r.lote} — ${U.dataBR(r.dataEnsaio)}`,
    textoExcluir: r => `Excluir o ensaio do lote ${r.lote} de ${U.dataBR(r.dataEnsaio)}?`,
    textoVazio: 'Importe o Ensaio de Dormentes no Leitor de Recebidos, ou lance um ensaio manualmente.',

    // Resultado é enum no banco e não aceita vazio.
    aoSalvar: payload => {
      if (!RESULTADOS_ENSAIO.includes(payload.resultado)) payload.resultado = 'Pendente';
    },
    aoAbrirNovo: () => {
      const hoje = U.isoLocal(new Date());
      const data = document.getElementById('dataEnsaio');
      const res = document.getElementById('resultado');
      if (data) data.value = hoje;
      if (res) res.value = 'Pendente';
    },

    filtros: [
      { id: 'fProjeto', campo: 'projeto', placeholder: 'Todos', opcoes: () => CFG.listas.projetos },
      { id: 'fBitola', campo: 'bitola', placeholder: 'Todas', opcoes: () => CFG.listas.bitolas },
      { id: 'fResultado', campo: 'resultado', placeholder: 'Todos', opcoes: () => RESULTADOS_ENSAIO },
    ],

    ordenar: (a, b) =>
      String(b.dataEnsaio).localeCompare(String(a.dataEnsaio)) ||
      String(a.lote).localeCompare(String(b.lote), 'pt-BR', { numeric: true }),

    colunas: [
      { campo: 'dataEnsaio', rotulo: 'Data ensaio' },
      { campo: 'semanaRef', rotulo: 'Semana' },
      { campo: 'lote', rotulo: 'Lote', html: r => `<strong>${U.esc(r.lote)}</strong>` },
      { campo: 'projeto', rotulo: 'Projeto', html: r => U.badgeProjeto(r.projeto) },
      { campo: 'dataFabricacao', rotulo: 'Fabricação' },
      { campo: 'turno', rotulo: 'Turno' },
      { campo: 'molde', rotulo: 'Molde', classe: 'right' },
      { campo: 'comprimento', rotulo: 'Compr. mm', classe: 'right' },
      { campo: 'torcaoRelativa', rotulo: 'Torção', classe: 'right' },
      { rotulo: 'Resultado', html: r => badgeResultadoEnsaio(r.resultado) },
      { campo: 'executor', rotulo: 'Executor' },
    ],

    kpis: lista => {
      const aprovados = lista.filter(r => r.resultado === 'Aprovado').length;
      const reprovados = lista.filter(r => r.resultado === 'Reprovado').length;
      const pendentes = lista.filter(r => r.resultado === 'Pendente').length;
      const lotes = new Set(lista.map(r => r.lote).filter(Boolean)).size;
      const pct = lista.length ? Math.round((aprovados / lista.length) * 100) : 0;
      return [
        { rotulo: 'Ensaios no filtro', valor: lista.length, extra: `${lotes} lote(s) distinto(s)`, cor: 'escuro' },
        { rotulo: 'Aprovados', valor: aprovados, extra: `${pct}% do recorte`, cor: 'verde' },
        { rotulo: 'Reprovados', valor: reprovados, extra: 'resultado geral do relatório', cor: 'vermelho' },
        { rotulo: 'Pendentes', valor: pendentes, extra: 'aguardando conclusão', cor: 'amarelo' },
      ];
    },
  });
});

function badgeResultadoEnsaio(v) {
  const cls = v === 'Aprovado' ? 'badge-ok' : v === 'Reprovado' ? 'badge-reprovado' : 'badge-amarelo';
  return `<span class="badge ${cls}">${U.esc(v || 'Pendente')}</span>`;
}
