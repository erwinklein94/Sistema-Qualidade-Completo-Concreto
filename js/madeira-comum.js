'use strict';
const Madeira = (() => {
  const DEFEITOS = Object.freeze(['Podre','Esmoado','Casca','Empeno','Resina','Rachadura e Fendilhamento']);
  const VERSOES = Object.freeze({
    recebimento_v1:'Recebimento v1', recebimento_v2:'Recebimento v2 · tipo de dormente',
    recebimento_v3:'Recebimento v3 · umidade', recebimento_v4:'Recebimento v4 · atual',
    dormente_lei_fornecedor:'Dormente de lei · fornecedor',
  });
  const nome = v => String(v ?? '').trim();
  const chave = v => nome(v).toLocaleLowerCase('pt-BR');
  const numero = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  function resumo(lista) {
    const r={inspecoes:lista.length,concluidas:0,entregues:0,reprovadas:0,comQuantidades:0};
    for(const i of lista){
      if(i.status==='concluida') r.concluidas++;
      if(i.qtd_entregue!==null && i.qtd_reprovada!==null){
        r.entregues+=numero(i.qtd_entregue); r.reprovadas+=numero(i.qtd_reprovada); r.comQuantidades++;
      }
    }
    r.taxa=r.entregues>0 ? r.reprovadas/r.entregues*100 : null;
    return r;
  }
  function totaisDefeitos(lista){
    return DEFEITOS.map(nomeDefeito=>[nomeDefeito,lista.reduce((s,i)=>s+numero(i.defeitos?.[nomeDefeito]?.quantidade),0)]);
  }
  function filtrar(lista,f){
    return lista.filter(i=>(!f.fornecedor||chave(i.fornecedor)===f.fornecedor)
      &&(!f.responsavel||chave(i.responsavel)===f.responsavel)
      &&(!f.projeto||chave(i.projeto)===f.projeto)
      &&(!f.tipo||chave(i.tipo_dormente)===f.tipo)
      &&(!f.versao||i.tipo_relatorio===f.versao)
      &&(!f.status||i.status===f.status)
      &&(!f.ini||(i.data_inspecao&&i.data_inspecao>=f.ini))
      &&(!f.fim||(i.data_inspecao&&i.data_inspecao<=f.fim))
      &&(!f.busca||chave([i.audit_nome,i.audit_id,i.fornecedor,i.responsavel,i.localizacao,i.nota_fiscal,i.numero_pedido].join(' ')).includes(chave(f.busca))));
  }
  function ordenarMaisRecentes(lista){
    return [...lista].sort((a,b)=>nome(b.data_inspecao).localeCompare(nome(a.data_inspecao))||numero(b.id)-numero(a.id));
  }
  return { DEFEITOS, VERSOES, nome, chave, resumo, totaisDefeitos, filtrar, ordenarMaisRecentes };
})();
if(typeof window!=='undefined') window.Madeira=Madeira;
if(typeof module!=='undefined') module.exports=Madeira;
