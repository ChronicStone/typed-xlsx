import type {
  ChartCategoryColumn,
  ChartDataLabels,
  ChartDateColumn,
  ChartMark,
} from "../chart/types";

// ── Options ──────────────────────────────────────────────────────────────────

export type PivotAggregate = "sum" | "count" | "average" | "min" | "max";

/** Item order of row and column fields. `"source"` keeps the order rows first appear in. */
export type PivotSort = "ascending" | "descending" | "source";

/** Built-in Excel pivot table style, such as `"PivotStyleMedium9"`. */
export type PivotTableStyle = `PivotStyle${"Light" | "Medium" | "Dark"}${number}`;

/**
 * Shows a value as a share instead of the amount:
 * - `"percentOfTotal"`: of the grand total, so the whole pivot adds up to 100%.
 * - `"percentOfRow"`: of its row's total, so each row adds up to 100% across the columns.
 * - `"percentOfColumn"`: of its column's total, so each column adds up to 100%.
 */
export type PivotShowAs = "percentOfTotal" | "percentOfRow" | "percentOfColumn";

export interface PivotValueOptions<TAggregate extends PivotAggregate = PivotAggregate> {
  aggregate: TAggregate;
  /** Show the value as a percentage of a total. */
  show?: PivotShowAs;
  /** Header of the value. Defaults to "Sum of Revenue", "Count of Orders", … */
  name?: string;
  /**
   * Excel number format such as `"#,##0"`. Defaults to the source column's format, except for
   * counts, and to `"0.0%"` for values shown as a percentage.
   */
  format?: string;
}

type Present<T> = Exclude<T, null | undefined>;

type IsNumeric<TValue> = unknown extends TValue
  ? true
  : [Present<TValue>] extends [never]
    ? false
    : [Present<TValue>] extends [number]
      ? true
      : false;

type PivotValueEntry<TAggregate extends PivotAggregate> =
  | TAggregate
  | PivotValueOptions<TAggregate>;

/** Aggregations allowed on a column: all of them on numbers, `count` on anything else. */
export type PivotValueInput<TValue> =
  IsNumeric<TValue> extends true
    ? PivotValueEntry<PivotAggregate> | readonly PivotValueEntry<PivotAggregate>[]
    : PivotValueEntry<"count"> | readonly PivotValueEntry<"count">[];

/** Columns that can be a row, a column or a filter of a pivot. */
export type PivotField<TColumns> = ChartCategoryColumn<TColumns>;

/** Calendar unit a date field is grouped by. */
export type PivotDateUnit = "year" | "quarter" | "month";

/** Date levels of a row field, outermost first. `"month"` alone merges the same month of different years. */
export type PivotDateLevels =
  | PivotDateUnit
  | readonly ["year", "quarter"]
  | readonly ["year", "month"]
  | readonly ["quarter", "month"]
  | readonly ["year", "quarter", "month"];

/** A date column grouped by calendar units, such as `{ field: "orderedAt", by: ["year", "month"] }`. */
export interface PivotDateField<TColumns, TBy = PivotDateLevels> {
  readonly field: ChartDateColumn<TColumns>;
  readonly by: TBy;
}

/** A row field: a column, or a date column grouped by one or several calendar units. */
export type PivotRowField<TColumns> = PivotField<TColumns> | PivotDateField<TColumns>;

/** A column or filter field: a column, or a date column grouped by one calendar unit. */
export type PivotAxisField<TColumns> =
  | PivotField<TColumns>
  | PivotDateField<TColumns, PivotDateUnit>;

export interface PivotOptions<TColumns> {
  /** Fields listed down the left, outermost first. */
  rows: readonly [PivotRowField<TColumns>, ...PivotRowField<TColumns>[]];
  /** Field spread across the top, one column per item. A pivot takes at most one. */
  columns?: readonly PivotAxisField<TColumns>[];
  /** Values to aggregate, keyed by column: `{ revenue: "sum", orders: "count" }`. */
  values: { readonly [K in keyof TColumns & string]?: PivotValueInput<TColumns[K]> };
  /** Fields readers can filter the whole pivot by, shown above it. */
  filters?: readonly PivotAxisField<TColumns>[];
  /** Order of row and column items. Defaults to `"ascending"`. */
  sort?: PivotSort;
  /** Grand totals. Defaults to `true` for both. `{ row: false }` hides the bottom row, `{ column: false }` the right column. */
  totals?: boolean | { row?: boolean; column?: boolean };
  /** Pivot table style. Defaults to `"PivotStyleLight16"`, Excel's default. */
  style?: PivotTableStyle;
  /** Label of the grand totals. Defaults to `"Grand Total"`. */
  grandTotalLabel?: string;
  /** Top-left cell, such as `"A3"`. Defaults to below the sheet's tables. */
  at?: string;
}

type Duplicates<TFields extends readonly unknown[], TSeen = never> = TFields extends readonly [
  infer THead,
  ...infer TRest,
]
  ? (THead extends TSeen ? THead : never) | Duplicates<TRest, TSeen | THead>
  : never;

/** Field names of a list of fields, reading `field` from grouped dates. */
type FieldList<TValue> = TValue extends readonly unknown[]
  ? { [K in keyof TValue]: TValue[K] extends { readonly field: infer TField } ? TField : TValue[K] }
  : readonly [];

type PivotOptionProblems<TOptions> =
  | (Duplicates<
      [
        ...FieldList<TOptions extends { rows: infer R } ? R : []>,
        ...FieldList<TOptions extends { columns: infer C } ? C : []>,
        ...FieldList<TOptions extends { filters: infer F } ? F : []>,
      ]
    > extends infer TDuplicate
      ? TDuplicate extends string
        ? `field "${TDuplicate}" is used twice: a field is a row, a column or a filter, once`
        : never
      : never)
  | (TOptions extends { values: infer TValues }
      ? [keyof TValues] extends [never]
        ? "a pivot needs at least one value"
        : never
      : never)
  | (TOptions extends { columns: readonly [unknown, unknown, ...unknown[]] }
      ? "a pivot takes at most one column field"
      : never)
  | (TOptions extends { values: infer TValues }
      ? "percentOfRow" extends ShownAs<TValues>
        ? TOptions extends { columns: readonly [unknown, ...unknown[]] }
          ? never
          : '"percentOfRow" needs a column field: without one, every row is 100%'
        : never
      : never);

type ValueEntries<TValues> = {
  [K in keyof TValues]: TValues[K] extends readonly (infer TEntry)[] ? TEntry : TValues[K];
}[keyof TValues];

/** `show` options used by a pivot's values. */
type ShownAs<TValues> =
  ValueEntries<TValues> extends infer TEntry
    ? TEntry extends { show: infer TShow }
      ? TShow
      : never
    : never;

/** Adds readable `✗ …` requirements to pivot options. */
export type PivotOptionsGuard<TOptions> = [PivotOptionProblems<TOptions>] extends [never]
  ? unknown
  : { [TProblem in PivotOptionProblems<TOptions> as `✗ ${TProblem}`]: true };

// ── Shapes and specs ─────────────────────────────────────────────────────────

/** What the chain remembers about a pivot: whether it can be drawn as a pie. */
export interface PivotShape<TPie extends boolean = boolean> {
  readonly kind: "pivot";
  readonly pie: TPie;
}

type IsUnion<T, TAll = T> = T extends unknown ? ([TAll] extends [T] ? false : true) : never;

type IsSingleValue<TValues> = [keyof TValues] extends [never]
  ? false
  : true extends IsUnion<keyof TValues>
    ? false
    : TValues[keyof TValues] extends readonly unknown[]
      ? TValues[keyof TValues]["length"] extends 1
        ? true
        : false
      : true;

export type PivotShapeOf<TOptions> = PivotShape<
  TOptions extends { columns: readonly [unknown, ...unknown[]] }
    ? false
    : TOptions extends { values: infer TValues }
      ? IsSingleValue<TValues>
      : false
>;

/** A pivot built from a table with `refs.table(id).pivot(...)`, before it is placed on a sheet. */
export interface PivotSpec<TShape extends PivotShape = PivotShape> {
  readonly kind: "pivot-spec";
  readonly source: { readonly sheet: string; readonly table: string };
  readonly options: Readonly<Record<string, unknown>>;
  readonly __shape?: TShape;
}

// ── Pivot charts ─────────────────────────────────────────────────────────────

export interface PivotBarOptions {
  stack?: boolean | "percent";
  horizontal?: boolean;
  gap?: number;
  labels?: boolean | ChartDataLabels;
}

export interface PivotLineOptions {
  stack?: boolean | "percent";
  smooth?: boolean;
  markers?: boolean;
  labels?: boolean | ChartDataLabels;
}

export interface PivotAreaOptions {
  stack?: boolean | "percent";
  labels?: boolean | ChartDataLabels;
}

export interface PivotPieOptions {
  labels?: boolean | ChartDataLabels;
}

export interface PivotDoughnutOptions extends PivotPieOptions {
  hole?: number;
}

type PivotPieVariant<TPie extends boolean> = TPie extends true ? "pivot" : "pivot-invalid-pie";

/**
 * A pivot declared earlier in the chain. Its marks plot the whole pivot: row items on the
 * x axis, one series per column item and value. Excel keeps the chart in sync with the pivot.
 */
export interface PivotChartSource<TPie extends boolean = boolean> {
  bar(options?: PivotBarOptions): ChartMark<"pivot">;
  line(options?: PivotLineOptions): ChartMark<"pivot">;
  area(options?: PivotAreaOptions): ChartMark<"pivot">;
  /** Needs a pivot without columns and with a single value. */
  pie(options?: PivotPieOptions): ChartMark<PivotPieVariant<TPie>>;
  /** Needs a pivot without columns and with a single value. */
  doughnut(options?: PivotDoughnutOptions): ChartMark<PivotPieVariant<TPie>>;
}

/** Pivot declared on a sheet, before it is resolved against its source table. */
export interface PivotPlan {
  id: string;
  spec: PivotSpec;
}
