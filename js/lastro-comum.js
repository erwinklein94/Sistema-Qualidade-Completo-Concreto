'use strict';
const Lastro = (() => {
  const CRITERIOS = Object.freeze([
    ['c01', 'Condição do pulmão', 'Lastro está segregado de outras pedras'],
    ['c02', 'Condição do pulmão', 'Pulmão está sinalizado evidenciando ser da Rumo'],
    ['c03', 'Condição do pulmão', 'Estado do piso onde a brita está armazenada é adequado'],
    ['c04', 'Condição do pulmão', 'Aspecto visual de lamelaridade está adequado'],
    ['c05', 'Ensaios e gestão de qualidade', 'O fornecedor dispõe de equipamentos para a análise granulométrica'],
    ['c06', 'Ensaios e gestão de qualidade', 'O último ensaio feito pela Rumo foi aprovado'],
    ['c07', 'Ensaios e gestão de qualidade', 'A pedreira realizou ensaios internos de qualidade semanalmente'],
    ['c08', 'Ensaios e gestão de qualidade', 'A pedreira compartilhou ensaios internos com a Rumo'],
    ['c09', 'Equipamentos e calibração', 'A peneira possui boas condições para ser realizado o ensaio'],
    ['c10', 'Equipamentos e calibração', 'A balança possui certificado de calibração dentro do prazo de vencimento'],
    ['c11', 'Equipamentos e calibração', 'A peneira possui certificado de calibração dentro do prazo de vencimento'],
    ['c12', 'Documentação', 'Pedreira mantém ensaios de qualidade arquivados e em dia em seu banco de dados'],
    ['c13', 'Documentação', 'Peneira apresenta plano de manutenção e calibração dos equipamentos de fabricação de brita em dia'],
  ]);
  const nome = valor => String(valor || '').trim();
  const chave = valor => nome(valor).toLocaleLowerCase('pt-BR');
  function resumo(lista) {
    const r = { sim: 0, nao: 0, nd: 0, vazios: 0, comNegativas: 0, concluidas: 0 };
    for (const i of lista) {
      let negativo = false;
      for (const [id] of CRITERIOS) {
        const resposta = i.respostas?.[id]?.resposta;
        if (resposta === 'Sim') r.sim++;
        else if (resposta === 'Não') { r.nao++; negativo = true; }
        else if (resposta === 'N/D') r.nd++;
        else r.vazios++;
      }
      if (negativo) r.comNegativas++;
      if (i.status === 'concluida') r.concluidas++;
    }
    r.taxa = r.sim + r.nao ? 100 * r.sim / (r.sim + r.nao) : null;
    return r;
  }
  function filtrar(lista, f) {
    return lista.filter(i => (!f.fornecedor || chave(i.fornecedor) === f.fornecedor)
      && (!f.responsavel || chave(i.responsavel) === f.responsavel)
      && (!f.origem || i.origem_dados === f.origem)
      && (!f.status || i.status === f.status)
      && (!f.ini || (i.data_inspecao && i.data_inspecao >= f.ini))
      && (!f.fim || (i.data_inspecao && i.data_inspecao <= f.fim))
      && (!f.negativas || resumo([i]).nao > 0)
      && (!f.busca || chave([i.fornecedor,i.responsavel,i.localizacao,i.audit_nome,i.audit_id].join(' ')).includes(chave(f.busca))));
  }
  function validar(r) {
    if (!r.data_inspecao || !/^\d{4}-\d{2}-\d{2}$/.test(r.data_inspecao)) throw new Error('Informe a data da inspeção.');
    if (!nome(r.fornecedor)) throw new Error('Informe a pedreira / fornecedor.');
    if (!nome(r.responsavel)) throw new Error('Informe o responsável pela inspeção.');
    if (!['rascunho', 'concluida'].includes(r.status)) throw new Error('Situação inválida.');
    for (const [id] of CRITERIOS) {
      const v = r.respostas?.[id]?.resposta;
      if (![null, 'Sim', 'Não', 'N/D'].includes(v)) throw new Error('Resposta inválida no checklist.');
      if (r.status === 'concluida' && v === null) throw new Error('Responda aos 13 critérios para concluir ou salve como rascunho.');
    }
    return r;
  }
  return { CRITERIOS, nome, chave, resumo, filtrar, validar };
})();
if (typeof window !== 'undefined') window.Lastro = Lastro;
if (typeof module !== 'undefined') module.exports = Lastro;
