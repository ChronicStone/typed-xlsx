import type { BorderStyle, CellStyle } from "./types";
import { mergeCellStyles } from "./merge";

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
  },
  fill: {
    color: { rgb: "E9E9E9" },
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

export function withDefaultBodyStyle(style?: CellStyle) {
  return mergeCellStyles(DEFAULT_BODY_STYLE, style);
}

export function withDefaultHyperlinkBodyStyle(style?: CellStyle, hyperlinkStyle?: CellStyle) {
  return mergeCellStyles(DEFAULT_BODY_STYLE, DEFAULT_HYPERLINK_STYLE, style, hyperlinkStyle);
}

export function withDefaultHeaderStyle(style?: CellStyle) {
  return mergeCellStyles(DEFAULT_HEADER_STYLE, style);
}

export function withDefaultSummaryStyle(style?: CellStyle) {
  return mergeCellStyles(DEFAULT_SUMMARY_STYLE, style);
}
