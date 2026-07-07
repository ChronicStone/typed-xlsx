import type { CellStyle } from "./types";

export const CELL_CONTROL_STYLE_KEY = "__typedXlsxCellControl" as const;

export type CellControlKind = "checkbox";

export type InternalCellStyle = CellStyle & {
  [CELL_CONTROL_STYLE_KEY]?: CellControlKind;
};

export function withCellControl(
  style: CellStyle | undefined,
  cellControl: CellControlKind,
): InternalCellStyle {
  return {
    ...(style ?? {}),
    [CELL_CONTROL_STYLE_KEY]: cellControl,
  };
}

export function getCellControl(style?: CellStyle) {
  return (style as InternalCellStyle | undefined)?.[CELL_CONTROL_STYLE_KEY];
}
