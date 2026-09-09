'use strict';
const StoreMadeira=(()=>{
  const tabela='madeira_inspecoes';
  const colunas='id,audit_id,audit_nome,template_nome,tipo_relatorio,fornecedor,data_inspecao,localizacao,responsavel,projeto,tipo_dormente,nota_fiscal,numero_pedido,data_entrega,qtd_entregue,qtd_reprovada,taxa_reprovacao,teor_umidade_medido,teor_umidade_aprovado,marcacao_lado,carimbo_fiscalizadora,defeitos,informacoes_adicionais,status,fonte_arquivo,fonte_aba,fonte_linha';
  function db(){const c=window.Auth?.cliente?.();if(!c)throw new Error('Não foi possível conectar ao banco de dados.');return c;}
  async function listar(){
    const registros=[],tamanho=500;
    for(let inicio=0;;inicio+=tamanho){
      const {data,error}=await db().from(tabela).select(colunas).order('data_inspecao',{ascending:false,nullsFirst:false}).order('id').range(inicio,inicio+tamanho-1);
      if(error)throw error; registros.push(...data); if(data.length<tamanho)return registros;
    }
  }
  async function detalhe(id){const {data,error}=await db().from(tabela).select('*').eq('id',id).single();if(error)throw error;return data;}
  function erro(err){
    if(/42P01|PGRST205/.test(err?.code||'')||/schema cache|does not exist/i.test(err?.message||''))return 'A área de Dormentes de Madeira aguarda a configuração do banco de dados.';
    return err?.message||'Não foi possível carregar as inspeções de madeira.';
  }
  return {listar,detalhe,erro};
})();
if(typeof window!=='undefined')window.StoreMadeira=StoreMadeira;
