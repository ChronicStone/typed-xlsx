import type { CellStyle } from "./types";

export function mergeCellStyles(...styles: Array<CellStyle | undefined>): CellStyle {
  const result: CellStyle = {};

  for (const style of styles) {
    if (!style) continue;

    if (style.font) {
      result.font = { ...(result.font ?? {}), ...style.font };
    }

    if (style.fill) {
      result.fill = { ...(result.fill ?? {}), ...style.fill };
    }

    if (style.border) {
      result.border = {
        ...(result.border ?? {}),
        ...(style.border.top
          ? { top: { ...(result.border?.top ?? {}), ...style.border.top } }
          : {}),
        ...(style.border.right
          ? { right: { ...(result.border?.right ?? {}), ...style.border.right } }
          : {}),
        ...(style.border.bottom
          ? { bottom: { ...(result.border?.bottom ?? {}), ...style.border.bottom } }
          : {}),
        ...(style.border.left
          ? { left: { ...(result.border?.left ?? {}), ...style.border.left } }
          : {}),
      };
    }

    if (style.alignment) {
      result.alignment = { ...(result.alignment ?? {}), ...style.alignment };
    }

    if (style.protection) {
      result.protection = { ...(result.protection ?? {}), ...style.protection };
    }

    if (style.numFmt !== undefined) {
      result.numFmt = style.numFmt;
    }
  }

  return result;
}
