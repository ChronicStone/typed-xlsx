import type { BorderStyle, CellStyle } from "./types";
import { deepMerge } from "./merge";
import type { TableStyleDefault, TableStyleDefaults, TableStylePreset } from "../workbook/types";

export const THIN_BORDER_STYLE: BorderStyle = {
  top: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
};

export const THICK_BORDER_STYLE: BorderStyle = {
  top: { style: "medium", color: { rgb: "000000" } },
  right: { style: "medium", color: { rgb: "000000" } },
  bottom: { style: "medium", color: { rgb: "000000" } },
  left: { style: "medium", color: { rgb: "000000" } },
};

const DEFAULT_BODY_STYLE: CellStyle = {
  border: THIN_BORDER_STYLE,
  alignment: {
    vertical: "center",
  },
};

const DEFAULT_HEADER_STYLE: CellStyle = {
  font: {
    bold: true,
    color: { rgb: "1E3A8A" },
  },
  fill: {
    color: { rgb: "DBEAFE" },
  },
  border: THICK_BORDER_STYLE,
  alignment: {
    horizontal: "center",
    vertical: "center",
  },
};

const DEFAULT_SUMMARY_STYLE: CellStyle = {
  border: THIN_BORDER_STYLE,
  fill: {
    color: { rgb: "E9E9E9" },
  },
  font: {
    bold: true,
  },
  alignment: {
    vertical: "center",
  },
};

const DEFAULT_HYPERLINK_STYLE: CellStyle = {
  font: {
    color: { rgb: "0563C1" },
    underline: true,
  },
};

const PRESET_STYLES: Record<TableStylePreset, CellStyle> = {
  "header.accent": {
    fill: { color: { rgb: "DBEAFE" } },
    font: { bold: true, color: { rgb: "1E3A8A" } },
  },
  "header.inverse": {
    fill: { color: { rgb: "0F172A" } },
    font: { bold: true, color: { rgb: "F8FAFC" } },
  },
  "summary.subtle": {
    fill: { color: { rgb: "E2E8F0" } },
    font: { bold: true, color: { rgb: "334155" } },
  },
  "cell.input": {
    fill: { color: { rgb: "FEF3C7" } },
    font: { color: { rgb: "854D0E" }, bold: true },
  },
  "cell.locked": {
    fill: { color: { rgb: "F8FAFC" } },
    font: { color: { rgb: "64748B" } },
  },
  "cell.hidden": {
    fill: { color: { rgb: "F1F5F9" } },
    font: { color: { rgb: "475569" }, italic: true },
  },
};

function resolveTableStyleDefault(value?: CellStyle | TableStyleDefault) {
  if (!value) return undefined;
  if (!("preset" in value) && !("style" in value)) {
    return value as CellStyle;
  }

  return deepMerge<CellStyle>(value.preset ? PRESET_STYLES[value.preset] : undefined, value.style);
}

function isUnlocked(style?: CellStyle) {
  return style?.protection?.locked === false;
}

function isHidden(style?: CellStyle) {
  return style?.protection?.hidden === true;
}

function resolveCellStateDefaults(defaults: TableStyleDefaults | undefined, style?: CellStyle) {
  if (!defaults?.cells) return undefined;

  const stateStyle = isHidden(style)
    ? defaults.cells.hidden
    : isUnlocked(style)
      ? defaults.cells.unlocked
      : defaults.cells.locked;

  return deepMerge<CellStyle>(
    resolveTableStyleDefault(defaults.cells.base),
    resolveTableStyleDefault(stateStyle),
  );
}

export function withDefaultBodyStyle(style?: CellStyle) {
  return deepMerge<CellStyle>(DEFAULT_BODY_STYLE, style);
}

export function withTableDefaultBodyStyle(defaults?: TableStyleDefaults, style?: CellStyle) {
  return deepMerge<CellStyle>(DEFAULT_BODY_STYLE, resolveCellStateDefaults(defaults, style), style);
}

export function withDefaultHyperlinkBodyStyle(style?: CellStyle, hyperlinkStyle?: CellStyle) {
  return deepMerge<CellStyle>(DEFAULT_BODY_STYLE, DEFAULT_HYPERLINK_STYLE, style, hyperlinkStyle);
}

export function withDefaultHeaderStyle(style?: CellStyle) {
  return deepMerge<CellStyle>(DEFAULT_HEADER_STYLE, style);
}

export function withTableDefaultHeaderStyle(defaults?: TableStyleDefaults, style?: CellStyle) {
  return deepMerge<CellStyle>(
    DEFAULT_HEADER_STYLE,
    resolveTableStyleDefault(defaults?.header),
    style,
  );
}

export function withDefaultSummaryStyle(style?: CellStyle) {
  return deepMerge<CellStyle>(DEFAULT_SUMMARY_STYLE, style);
}

export function withTableDefaultSummaryStyle(defaults?: TableStyleDefaults, style?: CellStyle) {
  return deepMerge<CellStyle>(
    DEFAULT_SUMMARY_STYLE,
    resolveTableStyleDefault(defaults?.summary),
    style,
  );
}
