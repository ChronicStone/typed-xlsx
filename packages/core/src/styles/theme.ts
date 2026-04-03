import { deepMerge } from "./merge";
import type { BorderStyle, CellStyle } from "./types";

export type SpreadsheetThemeSlotName =
  | "title"
  | "groupHeader"
  | "groupHeaderFiller"
  | "header"
  | "summary"
  | "cellBase"
  | "cellUnlocked"
  | "cellLocked"
  | "cellHidden"
  | "hyperlink";

export interface SpreadsheetThemeTokens {
  colors: {
    titleFill: string;
    titleText: string;
    groupHeaderFill: string;
    groupHeaderFillerFill: string;
    groupHeaderText: string;
    headerFill: string;
    headerText: string;
    summaryFill: string;
    summaryText: string;
    inputFill: string;
    inputText: string;
    lockedFill: string;
    lockedText: string;
    hiddenFill: string;
    hiddenText: string;
    hyperlink: string;
    border: string;
  };
  borders: {
    thin: BorderStyle;
    thick: BorderStyle;
  };
}

type ThemePrimitive = bigint | boolean | null | number | string | symbol | undefined;

type ThemeOverride<T> = T extends ThemePrimitive
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: ThemeOverride<T[K]> }
      : T;

type SpreadsheetThemeSlotResolver<TTokens extends object> = (context: {
  tokens: TTokens;
  slots: Record<SpreadsheetThemeSlotName, CellStyle>;
}) => CellStyle;

export type SpreadsheetThemeSlotInput<TTokens extends object> =
  | CellStyle
  | SpreadsheetThemeSlotResolver<TTokens>;

export interface SpreadsheetThemeInput<TTokens extends object = SpreadsheetThemeTokens> {
  tokens?: ThemeOverride<TTokens>;
  slots?: Partial<Record<SpreadsheetThemeSlotName, SpreadsheetThemeSlotInput<TTokens>>>;
}

export interface SpreadsheetTheme<TTokens extends object = SpreadsheetThemeTokens> {
  readonly tokens: TTokens;
  readonly slots: Record<SpreadsheetThemeSlotName, CellStyle>;
  extend(input?: SpreadsheetThemeInput<TTokens>): SpreadsheetTheme<TTokens>;
  slot(name: SpreadsheetThemeSlotName, overrides?: CellStyle): CellStyle;
}

const DEFAULT_THIN_BORDER_STYLE: BorderStyle = {
  top: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
};

const DEFAULT_THICK_BORDER_STYLE: BorderStyle = {
  top: { style: "medium", color: { rgb: "000000" } },
  right: { style: "medium", color: { rgb: "000000" } },
  bottom: { style: "medium", color: { rgb: "000000" } },
  left: { style: "medium", color: { rgb: "000000" } },
};

const DEFAULT_THEME_TOKENS: SpreadsheetThemeTokens = {
  colors: {
    titleFill: "0F172A",
    titleText: "F8FAFC",
    groupHeaderFill: "C7D2FE",
    groupHeaderFillerFill: "D0D9FE",
    groupHeaderText: "1E3A8A",
    headerFill: "DBEAFE",
    headerText: "1E3A8A",
    summaryFill: "E2E8F0",
    summaryText: "334155",
    inputFill: "FEF3C7",
    inputText: "854D0E",
    lockedFill: "F8FAFC",
    lockedText: "64748B",
    hiddenFill: "F1F5F9",
    hiddenText: "475569",
    hyperlink: "0563C1",
    border: "000000",
  },
  borders: {
    thin: DEFAULT_THIN_BORDER_STYLE,
    thick: DEFAULT_THICK_BORDER_STYLE,
  },
};

function createDefaultSlots(
  tokens: SpreadsheetThemeTokens,
): Record<SpreadsheetThemeSlotName, CellStyle> {
  return {
    title: {
      fill: { color: { rgb: tokens.colors.titleFill } },
      font: { bold: true, color: { rgb: tokens.colors.titleText } },
      border: tokens.borders.thick,
      alignment: { horizontal: "center", vertical: "center" },
    },
    groupHeader: {
      fill: { color: { rgb: tokens.colors.groupHeaderFill } },
      font: { bold: true, color: { rgb: tokens.colors.groupHeaderText } },
      border: tokens.borders.thick,
      alignment: { horizontal: "center", vertical: "center" },
    },
    groupHeaderFiller: {
      fill: { color: { rgb: tokens.colors.groupHeaderFillerFill } },
      font: { bold: true, color: { rgb: tokens.colors.groupHeaderText } },
      border: tokens.borders.thick,
      alignment: { horizontal: "center", vertical: "center" },
    },
    header: {
      fill: { color: { rgb: tokens.colors.headerFill } },
      font: { bold: true, color: { rgb: tokens.colors.headerText } },
      border: tokens.borders.thick,
      alignment: { horizontal: "center", vertical: "center" },
    },
    summary: {
      fill: { color: { rgb: tokens.colors.summaryFill } },
      font: { bold: true, color: { rgb: tokens.colors.summaryText } },
      border: tokens.borders.thin,
      alignment: { vertical: "center" },
    },
    cellBase: {
      border: tokens.borders.thin,
      alignment: { vertical: "center" },
    },
    cellUnlocked: {
      fill: { color: { rgb: tokens.colors.inputFill } },
      font: { bold: true, color: { rgb: tokens.colors.inputText } },
    },
    cellLocked: {
      fill: { color: { rgb: tokens.colors.lockedFill } },
      font: { color: { rgb: tokens.colors.lockedText } },
    },
    cellHidden: {
      fill: { color: { rgb: tokens.colors.hiddenFill } },
      font: { italic: true, color: { rgb: tokens.colors.hiddenText } },
    },
    hyperlink: {
      font: { color: { rgb: tokens.colors.hyperlink }, underline: true },
    },
  };
}

export function defineSpreadsheetTheme<TTokens extends object = SpreadsheetThemeTokens>(
  input?: SpreadsheetThemeInput<TTokens>,
): SpreadsheetTheme<SpreadsheetThemeTokens & TTokens> {
  const tokens = deepMerge<SpreadsheetThemeTokens & TTokens>(
    DEFAULT_THEME_TOKENS as any,
    input?.tokens as any,
  );
  const baseSlots = createDefaultSlots(tokens);
  const resolvedSlots = resolveSlots(tokens, baseSlots, input?.slots);

  return createSpreadsheetTheme(tokens, resolvedSlots);
}

export const spreadsheetThemes = {
  classic: defineSpreadsheetTheme(),
  slate: defineSpreadsheetTheme({
    tokens: {
      colors: {
        titleFill: "020617",
        groupHeaderFill: "CBD5F5",
        groupHeaderFillerFill: "D9E1FB",
        headerFill: "0B1220",
        headerText: "F8FAFC",
        summaryFill: "E0E7FF",
        summaryText: "334155",
      },
    },
  }),
  forest: defineSpreadsheetTheme({
    tokens: {
      colors: {
        titleFill: "052E16",
        groupHeaderFill: "BBF7D0",
        groupHeaderFillerFill: "D6FAE0",
        groupHeaderText: "166534",
        headerFill: "DCFCE7",
        headerText: "166534",
        summaryFill: "DCFCE7",
        summaryText: "166534",
      },
    },
  }),
  rose: defineSpreadsheetTheme({
    tokens: {
      colors: {
        titleFill: "450A0A",
        groupHeaderFill: "FECACA",
        groupHeaderFillerFill: "FEDADA",
        groupHeaderText: "9F1239",
        headerFill: "7F1D1D",
        headerText: "FFF7ED",
        summaryFill: "FEE2E2",
        summaryText: "7F1D1D",
      },
    },
  }),
  ocean: defineSpreadsheetTheme({
    tokens: {
      colors: {
        titleFill: "082F49",
        groupHeaderFill: "BAE6FD",
        groupHeaderFillerFill: "D6F1FD",
        groupHeaderText: "0C4A6E",
        headerFill: "E0F2FE",
        headerText: "0C4A6E",
        summaryFill: "DCEFFE",
        summaryText: "0F3A59",
      },
    },
  }),
} as const;

function createSpreadsheetTheme<TTokens extends object>(
  tokens: TTokens,
  resolvedSlots: Record<SpreadsheetThemeSlotName, CellStyle>,
): SpreadsheetTheme<TTokens> {
  return {
    tokens,
    slots: resolvedSlots,
    extend(input) {
      if (!input) {
        return createSpreadsheetTheme(tokens, resolvedSlots);
      }

      const nextTokens = deepMerge<TTokens>(tokens as any, input.tokens as any);
      const nextSlots = resolveSlots(nextTokens, resolvedSlots, input.slots);
      return createSpreadsheetTheme(nextTokens, nextSlots);
    },
    slot(name, overrides) {
      return deepMerge<CellStyle>(resolvedSlots[name], overrides);
    },
  };
}

function resolveSlots<TTokens extends object>(
  tokens: TTokens,
  baseSlots: Record<SpreadsheetThemeSlotName, CellStyle>,
  slotInputs?: Partial<Record<SpreadsheetThemeSlotName, SpreadsheetThemeSlotInput<TTokens>>>,
) {
  const resolved = { ...baseSlots };

  (Object.keys(baseSlots) as SpreadsheetThemeSlotName[]).forEach((slotName) => {
    const input = slotInputs?.[slotName];
    if (!input) {
      return;
    }

    const style = typeof input === "function" ? input({ tokens, slots: resolved }) : input;
    resolved[slotName] = deepMerge<CellStyle>(baseSlots[slotName], style);
  });

  return resolved;
}
