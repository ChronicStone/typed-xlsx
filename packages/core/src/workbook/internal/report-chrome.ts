import { xmlEscape } from "../../ooxml/xml";
import type { CellStyle } from "../../styles/types";
import type { BufferedTablePlan, ReportTableRenderOptions, TableStyleDefaults } from "../types";

export interface ReportChromeColumnLike {
  groupPath: Array<{ id: string; headerLabel: string }>;
}

export interface ReportHeaderCell {
  rowOffset: number;
  columnOffset: number;
  value: string;
  colSpan: number;
}

export interface ReportHeaderPlaceholderCell {
  rowOffset: number;
  columnOffset: number;
}

export interface ReportChrome {
  titleRowCount: number;
  groupHeaderDepth: number;
  leafHeaderRowOffset: number;
  headerHeight: number;
  bodyRowOffset: number;
  autoFilterRowOffset: number;
  titleMerge?: { startRow: number; endRow: number; startCol: number; endCol: number };
  groupHeaderMerges: Array<{ startRow: number; endRow: number; startCol: number; endCol: number }>;
  groupHeaderCells: ReportHeaderCell[];
  groupHeaderPlaceholders: ReportHeaderPlaceholderCell[];
}

interface GroupNode {
  id: string;
  headerLabel: string;
  depth: number;
  startCol: number;
  endCol: number;
}

export function shouldRenderGroupedHeaders(render?: ReportTableRenderOptions) {
  return render?.groupHeaders !== false;
}

export function buildReportChrome(params: {
  columns: Array<ReportChromeColumnLike>;
  title?: string;
  render?: ReportTableRenderOptions;
}): ReportChrome {
  const titleRowCount = params.title ? 1 : 0;
  if (!shouldRenderGroupedHeaders(params.render)) {
    return {
      titleRowCount,
      groupHeaderDepth: 0,
      leafHeaderRowOffset: titleRowCount,
      headerHeight: titleRowCount + 1,
      bodyRowOffset: titleRowCount + 1,
      autoFilterRowOffset: titleRowCount,
      titleMerge:
        params.title && params.columns.length > 0
          ? { startRow: 0, endRow: 0, startCol: 0, endCol: params.columns.length - 1 }
          : undefined,
      groupHeaderMerges: [],
      groupHeaderCells: [],
      groupHeaderPlaceholders: [],
    };
  }

  const groupNodes = new Map<string, GroupNode>();

  params.columns.forEach((column, columnIndex) => {
    column.groupPath.forEach((group, depth) => {
      const key = `${depth}:${group.id}`;
      const existing = groupNodes.get(key);
      if (existing) {
        existing.startCol = Math.min(existing.startCol, columnIndex);
        existing.endCol = Math.max(existing.endCol, columnIndex);
        return;
      }

      groupNodes.set(key, {
        id: group.id,
        headerLabel: group.headerLabel,
        depth,
        startCol: columnIndex,
        endCol: columnIndex,
      });
    });
  });

  const groupHeaderDepth = [...groupNodes.values()].reduce(
    (max, group) => Math.max(max, group.depth + 1),
    0,
  );
  const leafHeaderRowOffset = titleRowCount + groupHeaderDepth;
  const groupHeaderPlaceholders: ReportHeaderPlaceholderCell[] = [];

  for (let depth = 0; depth < groupHeaderDepth; depth += 1) {
    params.columns.forEach((_column, columnIndex) => {
      groupHeaderPlaceholders.push({
        rowOffset: titleRowCount + depth,
        columnOffset: columnIndex,
      });
    });
  }

  return {
    titleRowCount,
    groupHeaderDepth,
    leafHeaderRowOffset,
    headerHeight: titleRowCount + groupHeaderDepth + 1,
    bodyRowOffset: titleRowCount + groupHeaderDepth + 1,
    autoFilterRowOffset: leafHeaderRowOffset,
    titleMerge:
      params.title && params.columns.length > 0
        ? { startRow: 0, endRow: 0, startCol: 0, endCol: params.columns.length - 1 }
        : undefined,
    groupHeaderMerges: [...groupNodes.values()]
      .filter((group) => group.endCol > group.startCol)
      .map((group) => ({
        startRow: titleRowCount + group.depth,
        endRow: titleRowCount + group.depth,
        startCol: group.startCol,
        endCol: group.endCol,
      })),
    groupHeaderCells: [...groupNodes.values()].map((group) => ({
      rowOffset: titleRowCount + group.depth,
      columnOffset: group.startCol,
      value: group.headerLabel,
      colSpan: group.endCol - group.startCol + 1,
    })),
    groupHeaderPlaceholders,
  };
}

export function getReportTableHeight(table: {
  title?: string;
  render?: ReportTableRenderOptions;
  planner: { columns: Array<ReportChromeColumnLike>; rows: Array<unknown> };
  summaries: Array<unknown>;
}) {
  const chrome = buildReportChrome({
    columns: table.planner.columns,
    title: table.title,
    render: table.render,
  });

  return chrome.headerHeight + table.planner.rows.length + table.summaries.length;
}

const A1_REFERENCE = /^(\$?)([A-Z]{1,3})(\$?)(\d+)$/;

function isReferenceWordChar(char: string) {
  return /[A-Za-z0-9_.$]/.test(char);
}

function skipQuoted(formula: string, start: number, quote: string) {
  // A doubled quote inside the literal is an escaped quote, not the end.
  let index = start + 1;
  while (index < formula.length) {
    if (formula[index] === quote) {
      if (formula[index + 1] === quote) {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index += 1;
  }
  return formula.length;
}

export function shiftFormulaA1Refs(formula: string, rowOffset: number, columnOffset: number) {
  if (rowOffset === 0 && columnOffset === 0) {
    return formula;
  }

  let result = "";
  let index = 0;

  while (index < formula.length) {
    const char = formula[index] as string;

    if (char === '"' || char === "'") {
      const end = skipQuoted(formula, index, char);
      result += formula.slice(index, end);
      index = end;
      continue;
    }

    if (char === "[") {
      // Structured references nest, e.g. Table[[#This Row],[Header]]. Copy them untouched.
      let depth = 0;
      let end = index;
      while (end < formula.length) {
        const current = formula[end];
        if (current === "[") {
          depth += 1;
        } else if (current === "]") {
          depth -= 1;
          if (depth <= 0) {
            end += 1;
            break;
          }
        }
        end += 1;
      }
      result += formula.slice(index, end);
      index = end;
      continue;
    }

    if (isReferenceWordChar(char)) {
      let end = index + 1;
      while (end < formula.length && isReferenceWordChar(formula[end] as string)) {
        end += 1;
      }

      const word = formula.slice(index, end);
      const next = formula[end];
      const match = next === "(" || next === "[" ? null : A1_REFERENCE.exec(word);

      if (match) {
        const [, colAnchor = "", col = "", rowAnchor = "", row = ""] = match;
        const shiftedCol = colAnchor ? col : toWorksheetCol(fromWorksheetCol(col) + columnOffset);
        const shiftedRow = rowAnchor ? row : String(Number(row) + rowOffset);
        result += `${colAnchor}${shiftedCol}${rowAnchor}${shiftedRow}`;
      } else {
        result += word;
      }
      index = end;
      continue;
    }

    result += char;
    index += 1;
  }

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

function fromWorksheetCol(column: string) {
  let value = 0;

  for (const char of column) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }

  return value - 1;
}

function toWorksheetCol(column: number) {
  let result = "";
  let current = column;

  do {
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return result;
}

function unescapeXmlText(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

export function shiftFormulaCellsInWorksheetXml(
  xml: string,
  rowOffset: number,
  columnOffset: number,
) {
  if (rowOffset === 0 && columnOffset === 0) {
    return xml;
  }

  return xml.replace(/<f>([\s\S]*?)<\/f>/g, (_match, formula: string) => {
    const shifted = shiftFormulaA1Refs(unescapeXmlText(formula), rowOffset, columnOffset);
    return `<f>${xmlEscape(shifted)}</f>`;
  });
}

export function resolveReportTitleStyle(defaults?: TableStyleDefaults): CellStyle | undefined {
  return defaults?.title && !("preset" in defaults.title) && !("style" in defaults.title)
    ? (defaults.title as CellStyle)
    : undefined;
}

export function resolveReportGroupHeaderStyle(
  defaults?: TableStyleDefaults,
): CellStyle | undefined {
  return defaults?.groupHeader &&
    !("preset" in defaults.groupHeader) &&
    !("style" in defaults.groupHeader)
    ? (defaults.groupHeader as CellStyle)
    : undefined;
}

export function getBufferedReportChrome<T extends object>(table: BufferedTablePlan<T>) {
  return buildReportChrome({
    columns: table.planner.columns,
    title: table.title,
    render: table.render,
  });
}
