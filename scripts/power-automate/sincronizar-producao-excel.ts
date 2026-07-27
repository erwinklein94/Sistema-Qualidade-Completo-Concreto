type CellValue = string | number | boolean;

interface ProductionPayload {
  generatedAt: string;
  source: string;
  tableName: string;
  columns: string[];
  total: number;
  rows: CellValue[][];
}

/**
 * Office Script executado pelo Power Automate.
 *
 * Crie este script no Excel Online e passe o corpo da ação HTTP no parâmetro
 * payloadJson usando a expressão:
 * string(body('Buscar_producao_no_Supabase'))
 */
function main(
  workbook: ExcelScript.Workbook,
  payloadJson: string,
): { total: number; updatedAt: string; tableName: string } {
  const payload = JSON.parse(payloadJson) as ProductionPayload;
  validatePayload(payload);

  const sheetName = "Base_Producao_Site";
  let sheet = workbook.getWorksheet(sheetName);
  if (!sheet) sheet = workbook.addWorksheet(sheetName);

  let table = workbook.getTable(payload.tableName);
  if (!table) {
    const headerRange = sheet.getRangeByIndexes(0, 0, 1, payload.columns.length);
    headerRange.setValues([payload.columns]);
    table = sheet.addTable(headerRange, true);
    table.setName(payload.tableName);
    table.setPredefinedTableStyle("TableStyleMedium2");
  }

  if (table.getWorksheet().getName() !== sheetName) {
    throw new Error(
      `A tabela ${payload.tableName} já existe em outra aba. ` +
      `Mova ou renomeie-a antes de executar a sincronização.`,
    );
  }

  const currentHeaders = table.getHeaderRowRange().getTexts()[0];
  if (
    currentHeaders.length !== payload.columns.length ||
    currentHeaders.some((header, index) => header !== payload.columns[index])
  ) {
    throw new Error(
      `Os cabeçalhos da tabela ${payload.tableName} não correspondem ao layout da Produção do site.`,
    );
  }

  const currentCount = table.getRowCount();
  const targetCount = payload.rows.length;

  if (targetCount > currentCount) {
    table.addRows(-1, payload.rows.slice(currentCount));
  } else if (targetCount < currentCount) {
    table.deleteRowsAt(targetCount, currentCount - targetCount);
  }

  if (targetCount > 0) {
    table.getRangeBetweenHeaderAndTotal().setValues(payload.rows);
  }

  table.getHeaderRowRange().getFormat().autofitColumns();
  sheet.getFreezePanes().freezeRows(1);

  const metadataCell = sheet.getRange("A1").getOffsetRange(0, payload.columns.length + 1);
  metadataCell.setValue(`Atualizado em ${payload.generatedAt}`);

  return {
    total: targetCount,
    updatedAt: payload.generatedAt,
    tableName: payload.tableName,
  };
}

function validatePayload(payload: ProductionPayload) {
  if (!payload || !Array.isArray(payload.columns) || !Array.isArray(payload.rows)) {
    throw new Error("O corpo recebido não contém columns e rows válidos.");
  }
  if (!payload.tableName || !payload.columns.length) {
    throw new Error("O nome da tabela ou as colunas não foram informados.");
  }
  const invalidRow = payload.rows.findIndex(
    (row) => !Array.isArray(row) || row.length !== payload.columns.length,
  );
  if (invalidRow >= 0) {
    throw new Error(`A linha ${invalidRow + 1} possui quantidade incorreta de colunas.`);
  }
}
