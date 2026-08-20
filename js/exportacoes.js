/* =====================================================================
   EXPORTACOES.JS — Relatórios Excel/PDF somente de saída
   ===================================================================== */
const Exportacoes = (() => {
  let relatorioAtual = null;
  const libs = {};

  function botoes() {
    return `<div class="exportacoes-grupo" title="Exporta apenas os dados já filtrados na tela atual">
      <button class="btn btn-secundario btn-sm" type="button" onclick="Exportacoes.exportarAtual('xlsx')">Excel</button>
      <button class="btn btn-secundario btn-sm" type="button" onclick="Exportacoes.exportarAtual('pdf')">PDF</button>
    </div>`;
  }

  function registrar(relatorio) {
    relatorioAtual = normalizarRelatorio(relatorio);
  }

  async function exportarAtual(tipo) {
    try {
      const rel = normalizarRelatorio(relatorioAtual || relatorioPorTabelaVisivel());
      if (!rel || !rel.secoes || !rel.secoes.length) {
        App?.toast?.('Não há dados tabulares filtrados para exportar nesta aba.', 'aviso');
        return;
      }
      if (tipo === 'xlsx') await exportarXLSX(rel);
      else await exportarPDF(rel);
    } catch (err) {
      console.error('Erro na exportação', err);
      App?.toast?.(err?.message || 'Não foi possível gerar a exportação.', 'erro');
    }
  }

  async function exportarRelatorioPDF(relatorio) {
    const rel = normalizarRelatorio(relatorio);
    if (!rel?.secoes?.length) throw new Error('Não há dados para gerar o PDF.');
    await exportarPDF(rel);
  }

  function normalizarRelatorio(rel) {
    if (!rel) return null;
    const titulo = rel.titulo || tituloPagina();
    const filtros = Array.isArray(rel.filtros) ? rel.filtros : filtrosDaTela();
    const secoes = (rel.secoes || []).map((sec, idx) => {
      const columns = (sec.columns || []).map(c => typeof c === 'string' ? { key: c, label: c } : c);
      const xlsxColumns = (sec.xlsxColumns || columns).map(c => typeof c === 'string' ? { key: c, label: c } : c);
      const normalizarLinhas = (linhas, colunas) => (linhas || []).map(row => Array.isArray(row)
        ? row
        : colunas.map(c => valorCelula(row?.[c.key])));
      const rows = normalizarLinhas(sec.rows, columns);
      const xlsxRows = normalizarLinhas(sec.xlsxRows || sec.rows, xlsxColumns);
      return {
        titulo: sec.titulo || `Dados ${idx + 1}`,
        columns,
        headers: columns.map(c => c.label !== undefined ? c.label : c.key),
        rows,
        xlsxColumns,
        xlsxHeaders: xlsxColumns.map(c => c.label !== undefined ? c.label : c.key),
        xlsxRows,
      };
    }).filter(sec => sec.headers.length && sec.rows.length);

    return {
      titulo,
      nomeArquivo: limparNomeArquivo(rel.nomeArquivo || titulo),
      filtros,
      secoes,
      graficos: normalizarGraficos(rel.graficos),
      tituloGraficos: rel.tituloGraficos || 'Gráficos do relatório',
      layoutGraficosPDF: rel.layoutGraficosPDF || 'apos-tabelas',
      observacao: rel.observacao || 'Fonte: Supabase. Exportação gerada somente a partir dos filtros aplicados na tela.',
      xlsxSomenteDados: !!rel.xlsxSomenteDados,
      xlsxEstatisticas: rel.xlsxEstatisticas || null,
      toastXlsx: rel.toastXlsx || ''
    };
  }

  function normalizarGraficos(graficos) {
    if (!Array.isArray(graficos)) return [];
    return graficos.map((g, idx) => {
      if (!g) return null;
      if (typeof g === 'string') return { titulo: `Gráfico ${idx + 1}`, canvasId: g };
      const canvasId = g.canvasId || g.id || '';
      const seletor = g.seletor || g.selector || '';
      return {
        titulo: g.titulo || g.title || `Gráfico ${idx + 1}`,
        canvasId,
        seletor,
        imagem: g.imagem || g.image || '',
        largura: Number(g.largura || g.width || 0),
        altura: Number(g.altura || g.height || 0),
      };
    }).filter(g => g && (g.imagem || g.canvasId || g.seletor));
  }

  function tituloPagina() {
    return document.querySelector('h1')?.textContent?.trim() || document.title || 'Relatório';
  }

  function limparNomeArquivo(nome) {
    const agora = new Date();
    const stamp = `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}${String(agora.getDate()).padStart(2, '0')}-${String(agora.getHours()).padStart(2, '0')}${String(agora.getMinutes()).padStart(2, '0')}`;
    return `${String(nome || 'relatorio').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()}-${stamp}`;
  }

  function valorCelula(v) {
    if (v == null) return '';
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
    return String(v).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  function filtrosDaTela() {
    const itens = [];
    document.querySelectorAll('.barra-filtros .campo').forEach(campo => {
      const label = campo.querySelector('label')?.textContent?.replace(/\s+/g, ' ')?.trim();
      const input = campo.querySelector('input, select, textarea');
      if (!label || !input) return;
      let valor = '';
      if (input.tagName === 'SELECT') valor = input.selectedOptions?.[0]?.textContent?.trim() || input.value || '';
      else valor = input.value || '';
      if (!valor) valor = 'Todos';
      itens.push({ campo: label, valor });
    });
    return itens;
  }

  function relatorioPorTabelaVisivel() {
    const table = document.querySelector('#lista table.tabela, #tabelaSeries table.tabela, table.tabela');
    if (!table) return null;
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
      Array.from(tr.children).slice(0, headers.length).map(td => td.textContent.replace(/\s+/g, ' ').trim())
    ).filter(r => r.some(Boolean));
    return {
      titulo: tituloPagina(),
      filtros: filtrosDaTela(),
      secoes: [{ titulo: 'Dados filtrados', columns: headers.map((h, i) => ({ key: String(i), label: h })), rows }],
    };
  }

  async function carregarScript(src, globalName, key) {
    if (globalName && window[globalName]) return window[globalName];
    if (libs[key]) return libs[key];
    libs[key] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(globalName ? window[globalName] : true);
      s.onerror = () => reject(new Error(`Falha ao carregar biblioteca de exportação: ${src}`));
      document.head.appendChild(s);
    });
    return libs[key];
  }

  async function garantirXLSX() {
    await carregarScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'XLSX', 'xlsx');
    if (!window.XLSX) throw new Error('Biblioteca Excel não carregou. Verifique a conexão com a internet.');
    return window.XLSX;
  }

  async function garantirPDF() {
    await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf', 'jspdf');
    await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', null, 'autotable');
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) throw new Error('Biblioteca PDF não carregou. Verifique a conexão com a internet.');
    return jsPDF;
  }

  async function exportarXLSX(rel) {
    const XLSX = await garantirXLSX();
    const wb = XLSX.utils.book_new();

    if (rel.xlsxSomenteDados) {
      const sec = secaoXLSX(rel.secoes[0]);
      if (!sec || !sec.rows.length) throw new Error('Não há dados filtrados para exportar.');
      const aoa = [sec.headers, ...sec.rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = sec.headers.map((h, idx) => ({
        wch: Math.min(55, Math.max(12, String(h).length + 3, ...sec.rows.slice(0, 200).map(r => String(r[idx] ?? '').length + 2)))
      }));
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      XLSX.utils.book_append_sheet(wb, ws, nomeAba(sec.titulo || 'Dados filtrados', 0));
      XLSX.writeFile(wb, `${rel.nomeArquivo}.xlsx`);
      App?.toast?.(rel.toastXlsx || 'Excel gerado com os dados filtrados.', 'sucesso');
      return;
    }

    const resumo = [
      ['Relatório', rel.titulo],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
      ['Observação', rel.observacao],
      [],
      ['Filtros aplicados', 'Valor'],
      ...rel.filtros.map(f => [f.campo, f.valor]),
      [],
      ['Seção', 'Linhas'],
      ...rel.secoes.map(s => [s.titulo, s.rows.length])
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
    wsResumo['!cols'] = [{ wch: 28 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

    rel.secoes.forEach((sec, i) => {
      sec = secaoXLSX(sec);
      const aoa = [sec.headers, ...sec.rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = sec.headers.map((h, idx) => ({ wch: Math.min(42, Math.max(12, String(h).length + 4, ...sec.rows.slice(0, 200).map(r => String(r[idx] ?? '').length + 2))) }));
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      aplicarFormatosColunasXLSX(XLSX, ws, sec);
      XLSX.utils.book_append_sheet(wb, ws, nomeAba(sec.titulo, i));
    });

    adicionarEstatisticasXLSX(XLSX, wb, rel);

    wb.Workbook = wb.Workbook || {};
    wb.Workbook.CalcPr = {
      ...(wb.Workbook.CalcPr || {}),
      calcMode: 'auto',
      fullCalcOnLoad: '1',
      forceFullCalc: '1',
    };

    XLSX.writeFile(wb, `${rel.nomeArquivo}.xlsx`);
    App?.toast?.('Excel gerado com os dados filtrados.', 'sucesso');
  }

  function secaoXLSX(sec) {
    if (!sec) return sec;
    return {
      ...sec,
      columns: sec.xlsxColumns || sec.columns,
      headers: sec.xlsxHeaders || sec.headers,
      rows: sec.xlsxRows || sec.rows,
    };
  }

  function aplicarFormatosColunasXLSX(XLSX, ws, sec) {
    (sec.columns || []).forEach((coluna, indice) => {
      if (!coluna?.format) return;
      for (let linha = 1; linha <= sec.rows.length; linha += 1) {
        const endereco = XLSX.utils.encode_cell({ r: linha, c: indice });
        if (ws[endereco] && typeof ws[endereco].v === 'number') ws[endereco].z = coluna.format;
      }
    });
  }

  function nomeAbaNaFormula(nome) {
    return `'${String(nome || '').replace(/'/g, "''")}'`;
  }

  function adicionarEstatisticasXLSX(XLSX, wb, rel) {
    const config = rel.xlsxEstatisticas;
    if (!config || !Array.isArray(config.colunas) || !config.colunas.length) return;

    const indiceSecao = Number.isInteger(config.secao) ? config.secao : 0;
    const sec = secaoXLSX(rel.secoes[indiceSecao]);
    if (!sec?.rows?.length) return;

    const nomeDados = nomeAba(sec.titulo, indiceSecao);
    const cabecalhos = ['Ensaio', 'Idade', 'Corpo de prova', 'Unidade', 'n', 'Média', 'Desvio padrão amostral', 'Coeficiente de variação', 'Mínimo', 'Máximo'];
    const aoa = [
      [config.titulo || 'Estatísticas dos corpos de prova'],
      ['Cálculos feitos exclusivamente com os valores numéricos dos lotes filtrados. O coeficiente de variação é o desvio padrão amostral dividido pela média.'],
      [],
      cabecalhos,
      ...config.colunas.map(item => [item.ensaio, item.idade, item.cp, item.unidade || 'MPa', '', '', '', '', '', '']),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const primeiraLinhaDados = 2;
    const ultimaLinhaDados = sec.rows.length + 1;

    config.colunas.forEach((item, indice) => {
      const indiceColuna = sec.columns.findIndex(coluna => coluna.key === item.key);
      if (indiceColuna < 0) return;

      const letraColuna = XLSX.utils.encode_col(indiceColuna);
      const intervalo = `${nomeAbaNaFormula(nomeDados)}!${letraColuna}${primeiraLinhaDados}:${letraColuna}${ultimaLinhaDados}`;
      const linha = 4 + indice;
      const celulaN = XLSX.utils.encode_cell({ r: linha, c: 4 });
      const celulaMedia = XLSX.utils.encode_cell({ r: linha, c: 5 });
      const celulaDesvio = XLSX.utils.encode_cell({ r: linha, c: 6 });
      const celulaCv = XLSX.utils.encode_cell({ r: linha, c: 7 });
      const celulaMin = XLSX.utils.encode_cell({ r: linha, c: 8 });
      const celulaMax = XLSX.utils.encode_cell({ r: linha, c: 9 });

      ws[celulaN] = { t: 'n', f: `COUNT(${intervalo})`, z: '0' };
      ws[celulaMedia] = { t: 'n', f: `IF(COUNT(${intervalo})>0,AVERAGE(${intervalo}),"")`, z: '0.00' };
      ws[celulaDesvio] = { t: 'n', f: `IF(COUNT(${intervalo})>1,STDEV.S(${intervalo}),"")`, z: '0.00' };
      ws[celulaCv] = { t: 'n', f: `IFERROR(STDEV.S(${intervalo})/AVERAGE(${intervalo}),"")`, z: '0.0%' };
      ws[celulaMin] = { t: 'n', f: `IF(COUNT(${intervalo})>0,MIN(${intervalo}),"")`, z: '0.00' };
      ws[celulaMax] = { t: 'n', f: `IF(COUNT(${intervalo})>0,MAX(${intervalo}),"")`, z: '0.00' };
    });

    ws['!cols'] = [
      { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 8 },
      { wch: 13 }, { wch: 24 }, { wch: 26 }, { wch: 13 }, { wch: 13 },
    ];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
    ];
    ws['!freeze'] = { xSplit: 0, ySplit: 4 };
    ws['!autofilter'] = { ref: `A4:J${4 + config.colunas.length}` };
    XLSX.utils.book_append_sheet(wb, ws, nomeAba(config.nomeAba || 'Estatísticas CP', rel.secoes.length));
  }

  async function exportarPDF(rel) {
    const jsPDF = await garantirPDF();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const largura = doc.internal.pageSize.getWidth();
    const margem = 10;
    let y = 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(rel.titulo, margem, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, margem, y);
    y += 5;

    const filtrosTxt = rel.filtros.length
      ? rel.filtros.map(f => `${f.campo}: ${f.valor}`).join(' | ')
      : 'Sem filtros informados';
    const linhasFiltro = doc.splitTextToSize(`Filtros: ${filtrosTxt}`, largura - (margem * 2));
    doc.text(linhasFiltro, margem, y);
    y += Math.min(18, linhasFiltro.length * 4) + 2;

    let graficosIncluidos = 0;
    if (rel.layoutGraficosPDF === 'grade-antes-tabela') {
      const resultadoGraficos = await adicionarGraficosGradePDF(doc, rel, margem, y);
      graficosIncluidos = resultadoGraficos.quantidade;
      y = resultadoGraficos.y;
    }

    rel.secoes.forEach(sec => {
      if (y > 170) { doc.addPage(); y = 12; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${sec.titulo} (${sec.rows.length} linha${sec.rows.length === 1 ? '' : 's'})`, margem, y);
      y += 3;
      doc.autoTable({
        startY: y,
        head: [sec.headers],
        body: sec.rows,
        margin: { left: margem, right: margem },
        styles: { fontSize: sec.headers.length > 10 ? 6.5 : 7.5, cellPadding: 1.5, overflow: 'linebreak' },
        headStyles: { fillColor: [0, 53, 103], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 248, 251] },
        didDrawPage: () => desenharRodapePDF(doc, margem)
      });
      y = doc.lastAutoTable.finalY + 8;
    });

    if (rel.layoutGraficosPDF !== 'grade-antes-tabela') {
      graficosIncluidos = await adicionarGraficosPDF(doc, rel, margem);
    }

    doc.save(`${rel.nomeArquivo}.pdf`);
    App?.toast?.(graficosIncluidos ? 'PDF gerado com os dados e gráficos filtrados.' : 'PDF gerado com os dados filtrados.', 'sucesso');
  }

  // Ficha individual (ex.: um lote de produção) em PDF retrato,
  // com seções de pares rótulo/valor — 2 pares por linha.
  async function exportarFichaPDF(ficha) {
    try {
      const jsPDF = await garantirPDF();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const margem = 12;
      let y = 14;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(String(ficha.titulo || 'Ficha'), margem, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, margem, y);
      y += 6;

      (ficha.secoes || []).forEach(sec => {
        const itens = (sec.itens || []).filter(Boolean);
        if (!itens.length) return;
        const body = [];
        for (let i = 0; i < itens.length; i += 2) {
          const a = itens[i];
          const b = itens[i + 1];
          body.push([
            String(a.rot || ''), valorCelula(a.val) === '' ? '—' : valorCelula(a.val),
            b ? String(b.rot || '') : '', b ? (valorCelula(b.val) === '' ? '—' : valorCelula(b.val)) : '',
          ]);
        }
        if (y > 262) { doc.addPage(); y = 14; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(0, 53, 103);
        doc.text(String(sec.titulo || ''), margem, y);
        doc.setTextColor(0, 0, 0);
        y += 2.5;
        doc.autoTable({
          startY: y,
          body,
          margin: { left: margem, right: margem },
          styles: { fontSize: 8.5, cellPadding: 1.8, overflow: 'linebreak' },
          columnStyles: {
            0: { fontStyle: 'bold', textColor: [0, 53, 103], cellWidth: 40 },
            2: { fontStyle: 'bold', textColor: [0, 53, 103], cellWidth: 40 },
          },
          alternateRowStyles: { fillColor: [245, 248, 251] },
          didDrawPage: () => desenharRodapePDF(doc, margem),
        });
        y = doc.lastAutoTable.finalY + 7;
      });

      doc.save(`${limparNomeArquivo(ficha.nomeArquivo || ficha.titulo)}.pdf`);
      App?.toast?.('PDF da ficha gerado.', 'sucesso');
    } catch (err) {
      console.error('Erro ao gerar PDF da ficha', err);
      App?.toast?.(err?.message || 'Não foi possível gerar o PDF da ficha.', 'erro');
    }
  }

  function desenharRodapePDF(doc, margem) {
    const largura = doc.internal.pageSize.getWidth();
    const altura = doc.internal.pageSize.getHeight();
    const page = doc.internal.getNumberOfPages();
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 107, 123);
    doc.text(`Fonte: Supabase · Página ${page}`, largura - margem, altura - 6, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  async function adicionarGraficosGradePDF(doc, rel, margem, inicioY) {
    const graficos = await coletarImagensGraficos(rel.graficos || []);
    if (!graficos.length) return { quantidade: 0, y: inicioY };

    const larguraPagina = doc.internal.pageSize.getWidth();
    const alturaPagina = doc.internal.pageSize.getHeight();
    const larguraUtil = larguraPagina - (margem * 2);
    const gap = 5;
    const larguraColuna = (larguraUtil - gap) / 2;
    let y = inicioY;

    const desenharTituloSecao = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(rel.tituloGraficos || 'Gráficos do relatório', margem, y);
      y += 6;
    };

    desenharTituloSecao();
    for (let indice = 0; indice < graficos.length; indice += 2) {
      const linha = graficos.slice(indice, indice + 2).map(grafico => {
        const titulo = doc.splitTextToSize(grafico.titulo || 'Gráfico', larguraColuna - 6);
        const alturaTitulo = Math.max(5, titulo.length * 4);
        const dims = dimensionarImagem(grafico.largura, grafico.altura, larguraColuna - 6, 54);
        return { grafico, titulo, alturaTitulo, dims, altura: alturaTitulo + dims.altura + 8 };
      });
      const alturaLinha = Math.max(...linha.map(item => item.altura));

      if (y + alturaLinha > alturaPagina - 12) {
        doc.addPage();
        y = 12;
        desenharTituloSecao();
      }

      linha.forEach((item, coluna) => {
        const x = margem + (coluna * (larguraColuna + gap));
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, larguraColuna, alturaLinha, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(item.titulo, x + 3, y + 4.5);
        const imagemX = x + ((larguraColuna - item.dims.largura) / 2);
        const imagemY = y + item.alturaTitulo + 2;
        doc.addImage(item.grafico.imagem, 'PNG', imagemX, imagemY, item.dims.largura, item.dims.altura, undefined, 'FAST');
      });

      y += alturaLinha + 4;
      desenharRodapePDF(doc, margem);
    }

    return { quantidade: graficos.length, y: y + 1 };
  }

  async function adicionarGraficosPDF(doc, rel, margem) {
    const graficos = await coletarImagensGraficos(rel.graficos || []);
    if (!graficos.length) return 0;

    const larguraPagina = doc.internal.pageSize.getWidth();
    const alturaPagina = doc.internal.pageSize.getHeight();
    const larguraUtil = larguraPagina - (margem * 2);
    let y = alturaPagina;

    graficos.forEach((grafico, idx) => {
      const maxAlturaImagem = 146;
      const dims = dimensionarImagem(grafico.largura, grafico.altura, larguraUtil, maxAlturaImagem);
      const linhasTitulo = doc.splitTextToSize(grafico.titulo || `Gráfico ${idx + 1}`, larguraUtil);
      const alturaTitulo = Math.max(5, linhasTitulo.length * 5);
      const alturaBloco = alturaTitulo + dims.altura + 13;

      if (idx === 0 || y + alturaBloco > alturaPagina - margem) {
        doc.addPage();
        y = 12;
        if (idx === 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.text(rel.tituloGraficos || 'Gráficos do relatório', margem, y);
          y += 8;
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(linhasTitulo, margem, y);
      y += alturaTitulo;

      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(255, 255, 255);
      doc.rect(margem, y - 2, larguraUtil, dims.altura + 6, 'FD');

      const x = margem + ((larguraUtil - dims.largura) / 2);
      doc.addImage(grafico.imagem, 'PNG', x, y + 1, dims.largura, dims.altura, undefined, 'FAST');
      y += dims.altura + 11;
      desenharRodapePDF(doc, margem);
    });

    return graficos.length;
  }

  async function coletarImagensGraficos(graficos) {
    if (!graficos.length) return [];
    await aguardarRenderizacaoGraficos();

    return graficos.map(grafico => {
      const canvas = obterCanvasGrafico(grafico);
      const instanciaChart = canvas && window.Chart?.getChart?.(canvas);
      instanciaChart?.stop?.();
      instanciaChart?.update?.('none');
      const imagem = grafico.imagem || canvas?.toDataURL?.('image/png');
      if (!imagem) return null;
      return {
        titulo: grafico.titulo,
        imagem,
        largura: grafico.largura || canvas?.width || 1200,
        altura: grafico.altura || canvas?.height || 650,
      };
    }).filter(Boolean);
  }

  function obterCanvasGrafico(grafico) {
    if (grafico.canvasId) {
      const porId = document.getElementById(grafico.canvasId);
      if (porId?.tagName === 'CANVAS') return porId;
    }
    if (grafico.seletor) {
      const porSeletor = document.querySelector(grafico.seletor);
      if (porSeletor?.tagName === 'CANVAS') return porSeletor;
    }
    return null;
  }

  function dimensionarImagem(larguraOriginal, alturaOriginal, maxLargura, maxAltura) {
    const larguraBase = Math.max(1, Number(larguraOriginal) || 1200);
    const alturaBase = Math.max(1, Number(alturaOriginal) || 650);
    const escala = Math.min(maxLargura / larguraBase, maxAltura / alturaBase, 1);
    return {
      largura: larguraBase * escala,
      altura: alturaBase * escala,
    };
  }

  function aguardarRenderizacaoGraficos() {
    return new Promise(resolve => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  function nomeAba(nome, idx) {
    const limpo = String(nome || `Dados ${idx + 1}`).replace(/[\\/?*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28);
    return limpo || `Dados ${idx + 1}`;
  }

  return { botoes, registrar, exportarAtual, exportarRelatorioPDF, exportarFichaPDF, filtrosDaTela, garantirXLSX };
})();

window.Exportacoes = Exportacoes;
