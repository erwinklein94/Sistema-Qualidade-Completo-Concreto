/* =====================================================================
   CONPREM-PRODUCAO.JS — Produção de Dormentes da CONPREM

   Os campos são os do Mapa de Rastreabilidade (FR. 98/00), e só eles.
   A Conprem não reporta slump, temperatura, desprotensão, resistência de
   corpo de prova nem cura térmica — o que ela manda é a rastreabilidade
   dos insumos de cada lote. Por isso esta tela não é a da Cavan com
   campos a mais: é outra tela.

   A mecânica (listar, filtrar, ficha, editar, exportar) vem de
   js/conprem-tela.js; aqui ficam só os campos e o que é próprio daqui.
   ===================================================================== */

const CAMPOS_PRODUCAO_CONPREM = [
  { grupo: 'Identificação do lote', itens: [
    ['semanaRef', 'Semana', 'semana', 'semana'],
    ['ordemFabricacao', 'Ordem de fabricação', 'ordem_fabricacao', 'texto'],
    ['pedido', 'Pedido', 'pedido', 'texto'],
    ['cliente', 'Cliente', 'cliente', 'texto'],
    ['produto', 'Produto', 'produto', 'texto'],
    ['lote', 'Lote', 'lote', 'texto'],
    ['dataFabricacao', 'Data fabricação', 'data_fabricacao', 'data'],
    ['total', 'Qtd. dormentes', 'total_produzido', 'inteiro'],
    ['serieConcreto', 'Série concreto', 'serie_concreto', 'texto'],
    ['projeto', 'Projeto', 'projeto', 'select:projetos'],
    ['bitola', 'Bitola', 'bitola', 'select:bitolas'],
  ]},
  { grupo: 'Aço', itens: [
    ['acoSeqNf', 'Seq./NF', 'aco_seq_nf', 'texto'],
    ['acoCertInterno', 'Cert. interno', 'aco_cert_interno', 'texto'],
    ['acoCertExterno', 'Cert. externo', 'aco_cert_externo', 'texto'],
  ]},
  { grupo: 'Cimento', itens: [
    ['cimentoSeqNf', 'Seq./NF', 'cimento_seq_nf', 'texto'],
    ['cimentoCertInterno', 'Cert. interno', 'cimento_cert_interno', 'texto'],
    ['cimentoCertExterno', 'Cert. externo', 'cimento_cert_externo', 'texto'],
  ]},
  { grupo: 'Areia', itens: [
    ['areiaSeqNf', 'Seq./NF', 'areia_seq_nf', 'texto'],
    ['areiaCertInterno', 'Cert. interno', 'areia_cert_interno', 'texto'],
    ['areiaCertExterno', 'Cert. externo', 'areia_cert_externo', 'texto'],
  ]},
  { grupo: 'Brita', itens: [
    ['britaSeqNf', 'Seq./NF', 'brita_seq_nf', 'texto'],
    ['britaCertInterno', 'Cert. interno', 'brita_cert_interno', 'texto'],
    ['britaCertExterno', 'Cert. externo', 'brita_cert_externo', 'texto'],
  ]},
  { grupo: 'Aditivo e adição', itens: [
    ['aditivoSeqNf', 'Aditivo — Seq./NF', 'aditivo_seq_nf', 'texto'],
    ['aditivoCertExterno', 'Aditivo — Cert. externo', 'aditivo_cert_externo', 'texto'],
    ['adicaoSeqNf', 'Adição — Seq./NF', 'adicao_seq_nf', 'texto'],
    ['adicaoCertExterno', 'Adição — Cert. externo', 'adicao_cert_externo', 'texto'],
  ]},
  { grupo: 'Fixações', itens: [
    ['loteOmbreira', 'Ombreira — lote', 'lote_ombreira', 'texto'],
    ['grampo', 'Grampo', 'grampo', 'texto'],
    ['isoladorFrontal', 'Isolador frontal', 'isolador_frontal', 'texto'],
    ['isoladorLateral', 'Isolador lateral', 'isolador_lateral', 'texto'],
    ['palmilhaTrilho', 'Palmilha trilho', 'palmilha_trilho', 'texto'],
    ['palmilhaUsp', 'Palmilha USP', 'palmilha_usp', 'texto'],
    ['observacoes', 'Observações', 'observacoes', 'textarea'],
  ]},
];

document.addEventListener('DOMContentLoaded', () => {
  ConpremTela.iniciar({
    // A chave vai sem prefixo: montarLayout passa por Area.chaveMenu.
    chaveMenu: 'producao',
    titulo: 'Produção de Dormentes — Conprem',
    subtitulo: 'Mapa de Rastreabilidade (FR. 98/00): um lote por linha, com os insumos e certificados de cada um',
    migracao: 'supabase/2026-08-19-producao-campos-rastreabilidade-conprem.sql',
    listar: () => StoreSupabase.listarProducao({ limite: 5000 }),
    salvar: reg => StoreSupabase.salvarProducao(reg),
    remover: id => StoreSupabase.removerProducao(id),
    campos: CAMPOS_PRODUCAO_CONPREM,
    listas: {
      get projetos() { return CFG.listas.projetos; },
      get bitolas() { return CFG.listas.bitolas; },
    },
    obrigatorios: ['lote', 'projeto'],
    substantivo: 'lote(s)',
    nomeArquivo: 'conprem-producao',
    rotuloNovo: 'Novo lote',
    tituloNovo: 'Novo lote da Conprem',
    tituloEditar: r => `Editar lote ${r.lote}`,
    tituloFicha: r => `Lote ${r.lote} — ${U.dataBR(r.dataFabricacao)}`,
    textoExcluir: r => `Excluir o lote ${r.lote} da produção da Conprem?`,
    textoVazio: 'Importe o Mapa de Rastreabilidade no Leitor de Recebidos, ou lance um lote manualmente.',

    // total_produzido é NOT NULL no banco; campo em branco vira zero, não nulo.
    aoSalvar: payload => { payload.total_produzido = payload.total_produzido ?? 0; },

    filtros: [
      { id: 'fProjeto', campo: 'projeto', placeholder: 'Todos', opcoes: () => CFG.listas.projetos },
      { id: 'fBitola', campo: 'bitola', placeholder: 'Todas', opcoes: () => CFG.listas.bitolas },
    ],

    ordenar: (a, b) =>
      String(b.dataFabricacao).localeCompare(String(a.dataFabricacao)) ||
      String(a.lote).localeCompare(String(b.lote), 'pt-BR', { numeric: true }),

    colunas: [
      { campo: 'dataFabricacao', rotulo: 'Fabricação' },
      { campo: 'semanaRef', rotulo: 'Semana' },
      { campo: 'lote', rotulo: 'Lote', html: r => `<strong>${U.esc(r.lote)}</strong>` },
      { campo: 'projeto', rotulo: 'Projeto', html: r => U.badgeProjeto(r.projeto) },
      { campo: 'total', rotulo: 'Qtd.', classe: 'right' },
      { campo: 'serieConcreto', rotulo: 'Série concreto' },
      { campo: 'ordemFabricacao', rotulo: 'OF' },
      { campo: 'loteOmbreira', rotulo: 'Ombreira' },
      { rotulo: 'Certificados', html: r => badgeCertificados(r) },
    ],

    kpis: lista => {
      const dormentes = lista.reduce((n, r) => n + (parseInt(r.total, 10) || 0), 0);
      const semanas = new Set(lista.map(r => r.semanaRef).filter(Boolean)).size;
      const semCert = lista.filter(r => insumosSemCertificado(r).length).length;
      const media = lista.length ? Math.round(dormentes / lista.length) : 0;
      return [
        { rotulo: 'Lotes no filtro', valor: lista.length, extra: `${semanas} semana(s)`, cor: 'escuro' },
        { rotulo: 'Dormentes', valor: dormentes.toLocaleString('pt-BR'), extra: `média de ${media} por lote` },
        { rotulo: 'Rastreabilidade completa', valor: lista.length - semCert, extra: 'lotes com todos os certificados externos' },
        { rotulo: 'Certificado pendente', valor: semCert, extra: 'lotes com algum insumo sem certificado externo', cor: semCert ? 'amarelo' : 'verde' },
      ];
    },
  });
});

/* O certificado externo é o que prova a procedência do insumo. O relatório
   escreve "-", "Aguardando" ou deixa em branco quando ele não chegou — é a
   pendência que mais aparece no recebimento, então vale destaque na lista. */
const INSUMOS_CERTIFICADO = [
  ['acoCertExterno', 'Aço'],
  ['cimentoCertExterno', 'Cimento'],
  ['areiaCertExterno', 'Areia'],
  ['britaCertExterno', 'Brita'],
  ['aditivoCertExterno', 'Aditivo'],
  ['adicaoCertExterno', 'Adição'],
];

function insumosSemCertificado(r) {
  return INSUMOS_CERTIFICADO
    .filter(([campo]) => {
      const v = String(r[campo] || '').trim();
      return !v || v === '-' || /aguardando/i.test(v);
    })
    .map(([, nome]) => nome);
}

function badgeCertificados(r) {
  const faltando = insumosSemCertificado(r);
  if (!faltando.length) return '<span class="badge badge-ok">Completa</span>';
  return `<span class="badge badge-amarelo" title="Sem certificado externo: ${U.esc(faltando.join(', '))}">${faltando.length} pendente(s)</span>`;
}
