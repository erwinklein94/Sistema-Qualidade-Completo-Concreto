'use strict';
const StoreLastro = (() => {
  const tabela = 'lastro_inspecoes';
  const colunas = 'id,audit_id,audit_nome,origem_dados,fornecedor,data_inspecao,responsavel,localizacao,respostas,notas_gerais,observacoes,status,criado_em,atualizado_em';
  function db() {
    const cliente = window.Auth?.cliente?.();
    if (!cliente) throw new Error('Não foi possível conectar ao banco de dados.');
    return cliente;
  }
  async function listar() {
    const registros = [];
    const tamanho = 500;
    for (let inicio = 0; ; inicio += tamanho) {
      const { data, error } = await db().from(tabela).select(colunas)
        .order('data_inspecao', { ascending: false, nullsFirst: false })
        .order('id').range(inicio, inicio + tamanho - 1);
      if (error) throw error;
      registros.push(...data);
      if (data.length < tamanho) return registros;
    }
  }
  async function detalhe(id) {
    const { data, error } = await db().from(tabela).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }
  async function salvar(registro) {
    if (!window.Auth?.pode?.(registro.id ? 'editar' : 'criar')) throw new Error('Seu perfil não permite salvar inspeções.');
    Lastro.validar(registro);
    const payload = Object.fromEntries(['fornecedor','data_inspecao','responsavel','localizacao','respostas','notas_gerais','observacoes','status'].map(k => [k,registro[k]]));
    const query = registro.id
      ? db().from(tabela).update(payload).eq('id',registro.id).eq('origem_dados','manual').eq('atualizado_em',registro.atualizado_em)
      : db().from(tabela).insert({ ...payload, origem_dados:'manual' });
    const { data, error } = await query.select(colunas).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('A inspeção foi alterada por outra pessoa ou não pode ser editada. Atualize e abra novamente.');
    return data;
  }
  function erro(err) {
    if (/42P01|PGRST205/.test(err?.code || '') || /schema cache|does not exist/i.test(err?.message || '')) return 'A área de Lastro aguarda a configuração do banco de dados. Contate o administrador.';
    if (/row-level security/i.test(err?.message || '')) return 'Seu perfil não permite esta operação.';
    return err?.message || 'Não foi possível carregar a área de Lastro. Tente novamente.';
  }
  return { listar, detalhe, salvar, erro };
})();
if (typeof window !== 'undefined') window.StoreLastro = StoreLastro;
