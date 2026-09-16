'use strict';
const StoreControleDataBooks = (() => {
  const tabela = 'controle_data_books';
  const colunas = 'id,area,ano,mes,fornecedor,inspecionado_por,numero_pedido,lote,subcomponente,data_referencia,nota_fiscal,certificado,quantidade,data_book,link,fonte_arquivo,fonte_aba,fonte_linha,importado_em';
  function db() {
    const cliente = window.Auth?.cliente?.();
    if (!cliente) throw new Error('Não foi possível conectar ao banco de dados.');
    return cliente;
  }
  // Busca em páginas até esgotar, sem depender do limite padrão de linhas do Supabase.
  async function listar() {
    const registros = [];
    const tamanho = 1000;
    for (let inicio = 0; ; inicio += tamanho) {
      const { data, error } = await db().from(tabela).select(colunas)
        .order('area').order('fonte_linha').order('id')
        .range(inicio, inicio + tamanho - 1);
      if (error) throw error;
      registros.push(...data);
      if (data.length < tamanho) return registros;
    }
  }
  function erro(err) {
    if (/42P01|PGRST205/.test(err?.code || '') || /schema cache|does not exist/i.test(err?.message || '')) return 'A página Data books aguarda a configuração do banco de dados. Contate o administrador.';
    if (/row-level security|permission denied/i.test(err?.message || '')) return 'Seu usuário não tem acesso aos data books.';
    return err?.message || 'Não foi possível carregar os data books. Tente novamente.';
  }
  return { listar, erro };
})();
if (typeof window !== 'undefined') window.StoreControleDataBooks = StoreControleDataBooks;
