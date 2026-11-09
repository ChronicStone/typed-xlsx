import { deepMerge } from "./merge";
import type { BorderStyle, CellStyle, FillStyle, FontStyle } from "./types";

/** Slots that style table cells. */
export type SpreadsheetTableSlotName =
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

/**
 * Slots that style pivot tables. Each one is bound to a table slot by default, so a pivot
 * matches the tables of its theme:
 * - `pivotBody`: every cell of the pivot, from `cellBase`. Its border is drawn around each cell.
 * - `pivotFrame`: the border around the whole pivot. Empty by default: the body's border.
 * - `pivotHeader`: header rows and filter labels, from `header`. Colours and fonts only: Excel draws
 *   a header border on the first header row alone, so lines come from `pivotBody` and `pivotFrame`.
 * - `pivotSubheading`: rows that hold a subtotal, such as a year above its months. Bold by default.
 * - `pivotTotal`: grand total row and column, from `summary`.
 * - `pivotStripe`: banded rows or columns, when the pivot asks for `banded`. From `stripeFill`.
 */
export type SpreadsheetPivotSlotName =
  | "pivotBody"
  | "pivotFrame"
  | "pivotHeader"
  | "pivotSubheading"
  | "pivotTotal"
  | "pivotStripe";

export type SpreadsheetThemeSlotName = SpreadsheetTableSlotName | SpreadsheetPivotSlotName;

/** What a pivot style can change. Excel ignores font names and sizes, number formats and alignment there. */
export interface PivotAreaStyle {
  font?: Pick<FontStyle, "bold" | "italic" | "underline" | "strike" | "color">;
  fill?: FillStyle;
  border?: BorderStyle;
}

/** Pivot header style: colours and fonts, since Excel draws its border on the first header row only. */
export type PivotHeaderStyle = Omit<PivotAreaStyle, "border">;

/** Style a slot takes: pivot slots only take what a pivot style can change. */
export type SpreadsheetThemeSlotStyle<TName extends SpreadsheetThemeSlotName> =
  TName extends "pivotHeader"
    ? PivotHeaderStyle
    : TName extends SpreadsheetPivotSlotName
      ? PivotAreaStyle
      : CellStyle;

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
    sparklineSeries: string;
    sparklineMarkers: string;
    sparklineFirst: string;
    sparklineLast: string;
    sparklineHigh: string;
    sparklineLow: string;
    sparklineNegative: string;
    sparklineAxis: string;
    border: string;
    /** Fill of banded pivot rows and columns. */
    stripeFill: string;
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

type SpreadsheetThemeSlotResolver<TTokens extends object, TStyle> = (context: {
  tokens: TTokens;
  slots: Record<SpreadsheetThemeSlotName, CellStyle>;
}) => TStyle;

export type SpreadsheetThemeSlotInput<TTokens extends object, TStyle = CellStyle> =
  | TStyle
  | SpreadsheetThemeSlotResolver<TTokens, TStyle>;

export interface SpreadsheetThemeInput<TTokens extends object = SpreadsheetThemeTokens> {
  tokens?: ThemeOverride<TTokens>;
  slots?: {
    [K in SpreadsheetThemeSlotName]?: SpreadsheetThemeSlotInput<
      TTokens,
      SpreadsheetThemeSlotStyle<K>
    >;
  };
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
    sparklineSeries: "2563EB",
    sparklineMarkers: "2563EB",
    sparklineFirst: "16A34A",
    sparklineLast: "16A34A",
    sparklineHigh: "16A34A",
    sparklineLow: "DC2626",
    sparklineNegative: "DC2626",
    sparklineAxis: "64748B",
    border: "000000",
    stripeFill: "F1F5F9",
  },
  borders: {
    thin: DEFAULT_THIN_BORDER_STYLE,
    thick: DEFAULT_THICK_BORDER_STYLE,
  },
};

const TABLE_SLOT_NAMES: readonly SpreadsheetTableSlotName[] = [
  "title",
  "groupHeader",
  "groupHeaderFiller",
  "header",
  "summary",
  "cellBase",
  "cellUnlocked",
  "cellLocked",
  "cellHidden",
  "hyperlink",
];

const PIVOT_SLOT_NAMES: readonly SpreadsheetPivotSlotName[] = [
  "pivotBody",
  "pivotFrame",
  "pivotHeader",
  "pivotSubheading",
  "pivotTotal",
  "pivotStripe",
];

type TableSlots = Record<SpreadsheetTableSlotName, CellStyle>;
type PivotSlots = Record<SpreadsheetPivotSlotName, PivotAreaStyle>;

/** Keeps the parts of a cell style that a pivot style can use. */
export function toPivotAreaStyle(style?: CellStyle): PivotAreaStyle {
  if (!style) return {};
  const font = style.font
    ? Object.fromEntries(
        (["bold", "italic", "underline", "strike", "color"] as const)
          .filter((key) => style.font![key] !== undefined)
          .map((key) => [key, style.font![key]]),
      )
    : {};
  return {
    ...(Object.keys(font).length > 0 ? { font } : {}),
    ...(style.fill ? { fill: style.fill } : {}),
    ...(style.border ? { border: style.border } : {}),
  };
}

function withoutBorder({ border: _border, ...style }: PivotAreaStyle): PivotHeaderStyle {
  return style;
}

/** Pivot slots bound to the table slots, before a theme's own pivot overrides. */
function bindPivotSlots(tokens: SpreadsheetThemeTokens, slots: TableSlots): PivotSlots {
  return {
    pivotBody: toPivotAreaStyle(slots.cellBase),
    pivotFrame: {},
    pivotHeader: withoutBorder(toPivotAreaStyle(slots.header)),
    pivotSubheading: { font: { bold: true } },
    pivotTotal: toPivotAreaStyle(slots.summary),
    pivotStripe: { fill: { color: { rgb: tokens.colors.stripeFill } } },
  };
}

function createDefaultSlots(tokens: SpreadsheetThemeTokens): TableSlots {
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
  const resolved = resolveSlots(tokens, createDefaultSlots(tokens), {}, input?.slots as any);

  return createSpreadsheetTheme(tokens, resolved.tableSlots, resolved.pivotOverrides);
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

/** Pivot slots follow the table slots they are bound to, under the theme's own pivot overrides. */
function resolvePivotSlots(tokens: object, tableSlots: TableSlots, overrides: Partial<PivotSlots>) {
  const bound = bindPivotSlots(tokens as SpreadsheetThemeTokens, tableSlots);
  return Object.fromEntries(
    PIVOT_SLOT_NAMES.map((name) => [name, deepMerge<PivotAreaStyle>(bound[name], overrides[name])]),
  ) as PivotSlots;
}

function createSpreadsheetTheme<TTokens extends object>(
  tokens: TTokens,
  tableSlots: TableSlots,
  pivotOverrides: Partial<PivotSlots>,
): SpreadsheetTheme<TTokens> {
  const slots: Record<SpreadsheetThemeSlotName, CellStyle> = {
    ...tableSlots,
    ...resolvePivotSlots(tokens, tableSlots, pivotOverrides),
  };

  return {
    tokens,
    slots,
    extend(input) {
      if (!input) {
        return createSpreadsheetTheme(tokens, tableSlots, pivotOverrides);
      }

      const nextTokens = deepMerge<TTokens>(tokens as any, input.tokens as any);
      const next = resolveSlots(nextTokens, tableSlots, pivotOverrides, input.slots as any);
      return createSpreadsheetTheme(nextTokens, next.tableSlots, next.pivotOverrides);
    },
    slot(name, overrides) {
      return deepMerge<CellStyle>(slots[name], overrides);
    },
  };
}

function resolveSlots<TTokens extends object>(
  tokens: TTokens,
  baseSlots: TableSlots,
  basePivotOverrides: Partial<PivotSlots>,
  slotInputs?: Partial<Record<SpreadsheetThemeSlotName, SpreadsheetThemeSlotInput<TTokens, any>>>,
) {
  const tableSlots = { ...baseSlots };
  const pivotOverrides = { ...basePivotOverrides };
  const currentSlots = () =>
    ({
      ...tableSlots,
      ...resolvePivotSlots(tokens, tableSlots, pivotOverrides),
    }) as Record<SpreadsheetThemeSlotName, CellStyle>;

  TABLE_SLOT_NAMES.forEach((slotName) => {
    const input = slotInputs?.[slotName];
    if (!input) {
      return;
    }

    const style = typeof input === "function" ? input({ tokens, slots: currentSlots() }) : input;
    tableSlots[slotName] = deepMerge<CellStyle>(baseSlots[slotName], style);
  });

  PIVOT_SLOT_NAMES.forEach((slotName) => {
    const input = slotInputs?.[slotName];
    if (!input) {
      return;
    }

    const style = typeof input === "function" ? input({ tokens, slots: currentSlots() }) : input;
    const area = toPivotAreaStyle(style);
    pivotOverrides[slotName] = deepMerge<PivotAreaStyle>(
      pivotOverrides[slotName],
      slotName === "pivotHeader" ? withoutBorder(area) : area,
    );
  });

  return { tableSlots, pivotOverrides };
}
