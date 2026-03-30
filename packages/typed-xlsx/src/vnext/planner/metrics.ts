import type { PrimitiveCellValue } from "../schema/builder";
import type { CellStyle } from "../styles/types";
import type { ResolvedColumn } from "./rows";

const DEFAULT_ROW_HEIGHT = 30;
const DEFAULT_FONT_SIZE = 11;
const ROW_HEIGHT_PADDING = 2;

export function measurePrimitiveValue(value: PrimitiveCellValue) {
  if (value == null) return 0;
  if (typeof value === "string")
    return Math.max(...value.split("\n").map((part) => part.length), 0);
  if (typeof value === "number") return String(value).length;
  if (typeof value === "boolean") return value ? 4 : 5;
  if (value instanceof Date) return value.toISOString().length;
  return 0;
}

export function resolveColumnWidth<T extends object>(params: {
  column: ResolvedColumn<T>;
  currentWidth: number;
  measuredWidth: number;
}) {
  if (typeof params.column.width === "number") {
    return params.column.width;
  }

  const shouldAutoSize = params.column.autoWidth ?? true;
  const nextWidth = shouldAutoSize
    ? Math.max(params.currentWidth, params.measuredWidth)
    : params.currentWidth;
  const maxBoundWidth =
    typeof params.column.maxWidth === "number"
      ? Math.min(nextWidth, params.column.maxWidth)
      : nextWidth;

  return typeof params.column.minWidth === "number"
    ? Math.max(maxBoundWidth, params.column.minWidth)
    : maxBoundWidth;
}

export function estimateRowHeight(
  values: PrimitiveCellValue[],
  styles: Array<CellStyle | undefined>,
) {
  let height = DEFAULT_ROW_HEIGHT;

  values.forEach((value, index) => {
    const style = styles[index];
    const fontSize = style?.font?.size ?? DEFAULT_FONT_SIZE;
    const lineCount = typeof value === "string" && value.length > 0 ? value.split("\n").length : 1;
    const lineHeight = Math.max(
      DEFAULT_ROW_HEIGHT,
      Math.ceil(fontSize * 1.33) + ROW_HEIGHT_PADDING,
    );
    height = Math.max(height, lineCount * lineHeight);
  });

  return height;
}

export function getDefaultRowHeight() {
  return DEFAULT_ROW_HEIGHT;
}
