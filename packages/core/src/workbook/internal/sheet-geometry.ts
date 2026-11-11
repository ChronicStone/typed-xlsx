// Cell reference and cell ordering helpers shared by the buffered and the stream worksheet writers.

export function fromWorksheetCol(column: string) {
  let value = 0;

  for (const char of column) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }

  return value - 1;
}

export function toWorksheetCol(column: number) {
  if (column <= 0) return "A";
  let result = "";
  let current = column;

  do {
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return result;
}

export function shiftWorksheetRef(ref: string, rowOffset: number, columnOffset: number) {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    return ref;
  }

  const [, col, row] = match;
  if (!col || !row) {
    return ref;
  }

  return `${toWorksheetCol(fromWorksheetCol(col) + columnOffset)}${Number(row) + rowOffset}`;
}

export function shiftWorksheetRange(ref: string, rowOffset: number, columnOffset: number) {
  const [start, end] = ref.split(":");
  if (!start || !end) {
    return ref;
  }

  return `${shiftWorksheetRef(start, rowOffset, columnOffset)}:${shiftWorksheetRef(end, rowOffset, columnOffset)}`;
}

function getWorksheetCellRef(cellXml: string) {
  const refMatch = cellXml.match(/\br="([A-Z]+)(\d+)"/);
  if (!refMatch) {
    return undefined;
  }

  return `${refMatch[1] ?? ""}${refMatch[2] ?? ""}` || undefined;
}

function getWorksheetCellSortKey(cellXml: string) {
  const ref = getWorksheetCellRef(cellXml);
  if (!ref) {
    return Number.MAX_SAFE_INTEGER;
  }

  const refMatch = ref.match(/^([A-Z]+)(\d+)$/);
  if (!refMatch) {
    return Number.MAX_SAFE_INTEGER;
  }

  const [, col, row] = refMatch;
  if (!col || !row) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(row) * 10_000 + fromWorksheetCol(col);
}

export function upsertWorksheetCells(target: string[], incoming: string[]) {
  const existingByRef = new Map(
    target.map((cell, index) => [getWorksheetCellRef(cell), index] as const),
  );

  incoming.forEach((cell) => {
    const ref = getWorksheetCellRef(cell);
    const existingIndex = ref ? existingByRef.get(ref) : undefined;
    if (existingIndex !== undefined) {
      target[existingIndex] = cell;
      return;
    }

    target.push(cell);
    if (ref) {
      existingByRef.set(ref, target.length - 1);
    }
  });
}

export function sortWorksheetCells(cells: string[]) {
  return [...cells].sort(
    (left, right) => getWorksheetCellSortKey(left) - getWorksheetCellSortKey(right),
  );
}
