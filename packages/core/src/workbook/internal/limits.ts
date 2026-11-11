/** Excel's hard limits, and the checks that turn a would-be corrupt file into a clear error. */
export const EXCEL_MAX_ROWS = 1_048_576;
export const EXCEL_MAX_COLUMNS = 16_384;
export const EXCEL_MAX_CELL_TEXT = 32_767;
export const EXCEL_MAX_COLUMN_WIDTH = 255;
export const EXCEL_MAX_LIST_FORMULA = 255;
export const EXCEL_MAX_VALIDATION_TITLE = 32;
export const EXCEL_MAX_VALIDATION_MESSAGE = 255;
export const EXCEL_MAX_TABLE_NAME = 255;

const formatCount = (value: number) => value.toLocaleString("en-US");

export function assertRowCount(sheetName: string, rows: number) {
  if (rows > EXCEL_MAX_ROWS) {
    throw new Error(
      `Sheet '${sheetName}' would need ${formatCount(rows)} rows; Excel allows ${formatCount(EXCEL_MAX_ROWS)} per sheet. Split the rows across several sheets (see the streaming guide).`,
    );
  }
}

export function assertColumnCount(sheetName: string, columns: number) {
  if (columns > EXCEL_MAX_COLUMNS) {
    throw new Error(
      `Sheet '${sheetName}' would need ${formatCount(columns)} columns; Excel allows ${formatCount(EXCEL_MAX_COLUMNS)} per sheet. Select fewer columns or split them across several sheets.`,
    );
  }
}

/** Checks a laid-out sheet: the last physical row and column of every table, with its offsets. */
export function assertSheetFitsExcel(
  sheetName: string,
  positioned: ReadonlyArray<{
    rowOffset: number;
    columnOffset: number;
    width: number;
    height: number;
  }>,
) {
  let rows = 0;
  let columns = 0;
  for (const table of positioned) {
    rows = Math.max(rows, table.rowOffset + table.height);
    columns = Math.max(columns, table.columnOffset + table.width);
  }
  assertRowCount(sheetName, rows);
  assertColumnCount(sheetName, columns);
}

export function assertCellTextLength(ref: string, text: string) {
  if (text.length > EXCEL_MAX_CELL_TEXT) {
    throw new Error(
      `Cell ${ref} has ${formatCount(text.length)} characters; Excel allows ${formatCount(EXCEL_MAX_CELL_TEXT)} per cell. Shorten the text or split it across cells.`,
    );
  }
}

export function assertInlineListFits(columnId: string, values: ReadonlyArray<string | number>) {
  const items = values.map(String);
  const commaItem = items.find((item) => item.includes(","));
  if (commaItem !== undefined) {
    throw new Error(
      `Dropdown list on column '${columnId}' has the item '${commaItem}', which contains a comma. Excel splits an inline list at commas: remove the comma from the item.`,
    );
  }

  const length = items.join(",").length;
  if (length > EXCEL_MAX_LIST_FORMULA) {
    throw new Error(
      `Dropdown list on column '${columnId}' is ${length} characters long; Excel allows ${EXCEL_MAX_LIST_FORMULA} for an inline list. Shorten the list.`,
    );
  }
}

export function assertValidationMessageFits(
  columnId: string,
  kind: "Prompt" | "Error",
  message: { title?: string; message?: string } | undefined,
) {
  if (message?.title !== undefined && message.title.length > EXCEL_MAX_VALIDATION_TITLE) {
    throw new Error(
      `${kind} title on column '${columnId}' is ${message.title.length} characters long; Excel allows ${EXCEL_MAX_VALIDATION_TITLE}. Shorten the title.`,
    );
  }
  if (message?.message !== undefined && message.message.length > EXCEL_MAX_VALIDATION_MESSAGE) {
    throw new Error(
      `${kind} message on column '${columnId}' is ${message.message.length} characters long; Excel allows ${EXCEL_MAX_VALIDATION_MESSAGE}. Shorten the message.`,
    );
  }
}

export function assertUniqueColumnIds(
  tableId: string,
  columns: ReadonlyArray<{ id: string; dynamicPath?: string[] }>,
) {
  const seen = new Map<string, { dynamicPath?: string[] }>();
  for (const column of columns) {
    const first = seen.get(column.id);
    if (!first) {
      seen.set(column.id, column);
      continue;
    }

    const block = [column, first]
      .map((candidate) => candidate.dynamicPath?.[candidate.dynamicPath.length - 1])
      .find((candidate) => candidate !== undefined);
    throw new Error(
      `Column id '${column.id}' is used twice in table '${tableId}'${
        block !== undefined ? ` (one comes from dynamic block '${block}')` : ""
      }. Give one of them a different id.`,
    );
  }
}

export function createExcelTableNameRegistry() {
  const sheetsByName = new Map<string, { name: string; sheetName: string }>();

  return {
    claim(name: string, sheetName: string) {
      const key = name.toLowerCase();
      const existing = sheetsByName.get(key);
      if (existing) {
        throw new Error(
          `Two Excel tables are named '${existing.name}' and '${name}' (sheets '${existing.sheetName}' and '${sheetName}'), and Excel table names must be unique ignoring case. Give one of them a different name or id.`,
        );
      }
      sheetsByName.set(key, { name, sheetName });
    },
  };
}
