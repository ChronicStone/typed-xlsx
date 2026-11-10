import {
  resolveAccessor,
  type Accessor,
  type AccessorContext,
  type AccessorValue,
} from "../core/accessor";
import type { Path } from "../core/path";
import type {
  AllowedKeys,
  ErrorMessage,
  JoinUnion,
  OptionKeys,
  ValidateAccessor,
} from "../core/type-errors";
import {
  normalizeConditionalStyleInput,
  type ConditionalStyleInput,
  type ConditionalStyleRule,
} from "../styles/conditional-types";
import type { SpreadsheetTheme } from "../styles/theme";
import type { CellStyle } from "../styles/types";
import { withCellControl } from "../styles/internal";
import { deepMerge } from "../styles/merge";
import type { LazyText } from "../text";
import type { ValidationInput } from "../validation/types";
import {
  normalizeSparklineInput,
  type ResolvedSparklineDefinition,
  type SparklineDefinition,
  type SparklineInput,
  type SparklineType,
} from "../sparkline/types";
import type {
  ImageColumnSource,
  ImageFit,
  ImageMediaType,
  ImagePadding,
  ImageSize,
  ImageSourceValue,
  ImageUrlSourceValue,
} from "../image/types";
import { normalizeSummaryInput } from "../summary/builder";
import type { SummaryInput } from "../summary/builder";
import type {
  FormulaCondition,
  FormulaOperand,
  FormulaColumnRefs,
  FormulaFunctions,
  FormulaRefs,
  FormulaRowContext,
  FormulaValue,
} from "../formula/expr";

export type PrimitiveCellValue = string | number | boolean | Date | null | undefined;
export type CellValue = PrimitiveCellValue | PrimitiveCellValue[];
export type SchemaContext = unknown;
export type SchemaKind = "report" | "excel-table";
export type ColumnExpansion = "auto" | "single" | "expand";
export type SchemaTextContext<TContext extends SchemaContext = SchemaContext> = {
  ctx: TContext;
};

type RowBoundContext<T extends object, TExtra extends object> = T & TExtra;

export interface StructureConditionDefinition<TContext extends SchemaContext = SchemaContext> {
  ({ ctx }: { ctx: TContext }): boolean;
}

export type RowAccessorContext<
  T extends object,
  TContext extends SchemaContext = SchemaContext,
> = RowBoundContext<T, AccessorContext<T, TContext>>;

export interface RowTransformContext<
  T extends object,
  TValue = unknown,
  TContext extends SchemaContext = SchemaContext,
> {
  value: TValue;
  row: T;
  rowIndex: number;
  ctx: TContext;
}

export interface RowStyleContext<T extends object, TContext extends SchemaContext = SchemaContext> {
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx: TContext;
}

export interface RowFormatContext<
  T extends object,
  TContext extends SchemaContext = SchemaContext,
> {
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx: TContext;
}

export interface RowHyperlinkContext<
  T extends object,
  TContext extends SchemaContext = SchemaContext,
> {
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx: TContext;
}

export interface RowImageContext<T extends object, TContext extends SchemaContext = SchemaContext> {
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx: TContext;
}

export type BoundRowTransformContext<
  T extends object,
  TValue = unknown,
  TContext extends SchemaContext = SchemaContext,
> = RowBoundContext<T, RowTransformContext<T, TValue, TContext>>;

export type BoundRowStyleContext<
  T extends object,
  TContext extends SchemaContext = SchemaContext,
> = RowBoundContext<T, RowStyleContext<T, TContext>>;

export type BoundRowFormatContext<
  T extends object,
  TContext extends SchemaContext = SchemaContext,
> = RowBoundContext<T, RowFormatContext<T, TContext>>;

export type BoundRowHyperlinkContext<
  T extends object,
  TContext extends SchemaContext = SchemaContext,
> = RowBoundContext<T, RowHyperlinkContext<T, TContext>>;

export type BoundRowImageContext<
  T extends object,
  TContext extends SchemaContext = SchemaContext,
> = RowBoundContext<T, RowImageContext<T, TContext>>;

export type FormulaFn<
  TPrevColumnId extends string,
  TGroupId extends string = never,
  TDynamicId extends string = never,
  TContext extends SchemaContext = SchemaContext,
  TBooleanColumnId extends TPrevColumnId = never,
> = (context: {
  row: FormulaRowContext<TPrevColumnId, TGroupId | TDynamicId>;
  refs: FormulaColumnRefs<TPrevColumnId, TGroupId | TDynamicId, TBooleanColumnId> &
    FormulaRefs<TPrevColumnId, TGroupId, TDynamicId, TBooleanColumnId>;
  fx: FormulaFunctions<TPrevColumnId, TGroupId | TDynamicId>;
  ctx: TContext;
}) => FormulaValue<TPrevColumnId, TGroupId | TDynamicId>;

export type TransformFn<
  T extends object,
  TValue = unknown,
  TContext extends SchemaContext = SchemaContext,
> = (context: BoundRowTransformContext<T, TValue, TContext>) => CellValue;

export type FormatFn<T extends object, TContext extends SchemaContext = SchemaContext> = (
  context: BoundRowFormatContext<T, TContext>,
) => string | undefined;

export type StyleFn<T extends object, TContext extends SchemaContext = SchemaContext> = (
  context: BoundRowStyleContext<T, TContext>,
) => CellStyle | undefined;

type FormulaLikeReference<TCurrentColumnId extends string, TColumnId extends string> =
  | TColumnId
  | TCurrentColumnId;

export interface HyperlinkDefinition<TContext = void> {
  target: string;
  tooltip?: LazyText<TContext>;
  style?: CellStyle;
}

export type HyperlinkInput<T extends object, TContext extends SchemaContext = SchemaContext> =
  | string
  | HyperlinkDefinition<BoundRowHyperlinkContext<T, TContext>>
  | null
  | ((
      context: BoundRowHyperlinkContext<T, TContext>,
    ) => string | HyperlinkDefinition<BoundRowHyperlinkContext<T, TContext>> | null | undefined);

export type BadgeSourceValue = PrimitiveCellValue | PrimitiveCellValue[];
export type CheckboxValue = boolean | null | undefined;
export type CheckboxSourceValue = CheckboxValue | CheckboxValue[];

export type BadgeVariantLabelContext<
  T extends object,
  TValue = unknown,
  TContext extends SchemaContext = SchemaContext,
> = BoundRowTransformContext<T, TValue, TContext>;

export type BadgeVariantLabel<
  T extends object,
  TValue = unknown,
  TContext extends SchemaContext = SchemaContext,
> = string | ((context: BadgeVariantLabelContext<T, TValue, TContext>) => string | undefined);

export type ImageMediaTypeInput<T extends object, TContext extends SchemaContext = SchemaContext> =
  | ImageMediaType
  | ((context: BoundRowImageContext<T, TContext>) => ImageMediaType | undefined);

export type ImageAltInput<T extends object, TContext extends SchemaContext = SchemaContext> =
  | LazyText
  | Path<T>
  | ((context: BoundRowImageContext<T, TContext>) => string | undefined);

export interface ImageColumnDefinition<
  T extends object,
  TContext extends SchemaContext = SchemaContext,
> {
  source?: ImageColumnSource;
  mediaType?: ImageMediaTypeInput<T, TContext>;
  alt?: ImageAltInput<T, TContext>;
  size?: ImageSize;
  fit?: ImageFit;
  padding?: number | ImagePadding;
}

export interface BadgeVariantOptions<
  T extends object = any,
  TValue = unknown,
  TContext extends SchemaContext = SchemaContext,
> {
  label?: BadgeVariantLabel<T, TValue, TContext>;
  style?: CellStyle;
}

type BadgeVariantStyleDefinition = CellStyle & {
  label?: never;
  style?: never;
};

export type BadgeVariantDefinition<
  T extends object = any,
  TValue = unknown,
  TContext extends SchemaContext = SchemaContext,
> = BadgeVariantOptions<T, TValue, TContext> | BadgeVariantStyleDefinition;
type BadgeVariantItemValue<TValue> = TValue extends readonly (infer TItem)[]
  ? TItem
  : TValue extends (infer TItem)[]
    ? TItem
    : TValue;
type BadgeVariantKey<TValue> = TValue extends Date
  ? string
  : TValue extends string
    ? string extends TValue
      ? string
      : TValue
    : TValue extends number
      ? number extends TValue
        ? string
        : `${TValue}`
      : TValue extends boolean
        ? boolean extends TValue
          ? "false" | "true"
          : `${TValue}`
        : TValue extends null
          ? "null"
          : TValue extends undefined
            ? "undefined"
            : never;
type BadgeVariantKeys<TValue> = [BadgeVariantKey<BadgeVariantItemValue<TValue>>] extends [never]
  ? string
  : BadgeVariantKey<BadgeVariantItemValue<TValue>>;
export type BadgeVariants<
  TValue = BadgeSourceValue,
  T extends object = any,
  TContext extends SchemaContext = SchemaContext,
> = Record<
  BadgeVariantKeys<TValue>,
  BadgeVariantDefinition<T, BadgeVariantItemValue<TValue>, TContext>
>;

export type BadgeColumnDefinition<
  TValue = BadgeSourceValue,
  T extends object = any,
  TContext extends SchemaContext = SchemaContext,
> =
  | {
      variants: BadgeVariants<TValue, T, TContext>;
      defaultVariant?: never;
    }
  | {
      variants?: Partial<BadgeVariants<TValue, T, TContext>>;
      defaultVariant: BadgeVariantDefinition<T, BadgeVariantItemValue<TValue>, TContext>;
    };

export interface CheckboxColumnDefinition {}

export type ColumnRendererType = "badge" | "checkbox" | "hyperlink" | "image" | "sparkline";

export type ExcelTableTotalsRowFunction =
  | "sum"
  | "average"
  | "count"
  | "countNums"
  | "min"
  | "max"
  | "stdDev"
  | "var";

export type ExcelTableTotalsRowDefinition<TContext extends SchemaContext = SchemaContext> =
  | { label: LazyText<SchemaTextContext<TContext>>; function?: never }
  | { function: ExcelTableTotalsRowFunction; label?: never };

export type ResolvedExcelTableTotalsRowDefinition =
  | { label: string; function?: never }
  | { function: ExcelTableTotalsRowFunction; label?: never };

export interface BaseSchemaNodeDefinition<
  _T extends object,
  TContext extends SchemaContext = SchemaContext,
> {
  id: string;
  header?: LazyText<SchemaTextContext<TContext>>;
  condition?: StructureConditionDefinition<TContext>;
}

type ColumnCellValue<TValue> = TValue extends readonly (infer TItem)[] ? TItem : TValue;

type AccessorCellValue<TAccessorValue, TTransformed> = [TTransformed] extends [never]
  ? ColumnCellValue<TAccessorValue>
  : ColumnCellValue<TTransformed>;

/**
 * Value a column writes into its cells, after `transform` and `defaultValue`. A default replaces
 * missing values, so a column with one is never blank: it can then be grouped by date in a pivot.
 */
export type AccessorColumnValue<TAccessorValue, TTransformed, TDefault> =
  | ([TDefault] extends [never]
      ? AccessorCellValue<TAccessorValue, TTransformed>
      : Exclude<AccessorCellValue<TAccessorValue, TTransformed>, null | undefined>)
  | TDefault;

/**
 * Value a formula column evaluates to. Arithmetic results and aggregates are numbers,
 * conditions are booleans, and literal results keep their own type.
 */
export type FormulaColumnValue<TResult> =
  TResult extends FormulaCondition<any, any>
    ? boolean
    : TResult extends string
      ? string
      : TResult extends boolean
        ? boolean
        : TResult extends number
          ? number
          : TResult extends FormulaOperand<any, any, infer TValue>
            ? unknown extends TValue
              ? number
              : TValue
            : number;

type WithColumnValue<TColumnValues, TId extends string, TValue> = TColumnValues & {
  [K in TId]: TValue;
};

type EmptyColumnValues = Record<never, never>;

export interface ColumnDefinition<
  T extends object,
  TContext extends SchemaContext = SchemaContext,
  TAccessor extends Accessor<T, unknown, TContext> | Path<T> =
    | Accessor<T, unknown, TContext>
    | Path<T>,
  TPrevColumnId extends string = never,
  TGroupId extends string = never,
  TDynamicId extends string = never,
  TReference extends string = TPrevColumnId,
> extends BaseSchemaNodeDefinition<T, TContext> {
  kind?: "column";
  type?: ColumnRendererType;
  accessor?: TAccessor;
  defaultValue?: CellValue;
  transform?: TransformFn<T, AccessorValue<T, TAccessor>, TContext>;
  format?: string | FormatFn<T, TContext>;
  style?: CellStyle | StyleFn<T, TContext>;
  hyperlink?: HyperlinkInput<T, TContext>;
  image?: ImageColumnDefinition<T, TContext>;
  conditionalStyle?: ConditionalStyleInput<TReference, TGroupId | TDynamicId>;
  validation?: ValidationInput<TReference, TGroupId | TDynamicId, SchemaTextContext<TContext>>;
  sparkline?: SparklineInput<TPrevColumnId, TGroupId, TDynamicId>;
  headerStyle?: CellStyle;
  width?: number;
  autoWidth?: boolean;
  minWidth?: number;
  maxWidth?: number;
  summary?: SummaryInput<T, TContext>;
  formula?: FormulaFn<TPrevColumnId, TGroupId, TDynamicId, TContext>;
  expansion?: ColumnExpansion;
  totalsRow?: ExcelTableTotalsRowDefinition<TContext>;
}

type AccessorColumnInput<
  T extends object,
  TAccessor extends Accessor<T, unknown, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
  TTransformed = CellValue,
  TDefault = CellValue,
  TAccessorInput = TAccessor,
> = Omit<
  ColumnDefinition<T, TContext, TAccessor, TPrevColumnId, TGroupId, TDynamicId, TReference>,
  "id" | "accessor" | "image" | "sparkline" | "type" | "transform" | "defaultValue"
> & {
  accessor: TAccessorInput;
  formula?: never;
  transform?: (
    context: BoundRowTransformContext<T, AccessorValue<T, TAccessor>, TContext>,
  ) => TTransformed;
  defaultValue?: TDefault;
};

type FormulaFnArgs<
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
  TBooleanColumnId extends TPrevColumnId,
> = Parameters<FormulaFn<TPrevColumnId, TGroupId, TDynamicId, TContext, TBooleanColumnId>>[0];

type SparklineRendererColumnInput<
  T extends object,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
> = Omit<
  ColumnDefinition<T, TContext, never, TPrevColumnId, TGroupId, TDynamicId, TPrevColumnId>,
  "id" | "accessor" | "image" | "sparkline" | "transform" | "formula" | "type"
> &
  Omit<SparklineDefinition<TPrevColumnId, TGroupId, TDynamicId>, "type"> & {
    accessor?: never;
    transform?: never;
    formula?: never;
    type: "sparkline";
    sparklineType?: SparklineType;
  };

type CheckboxRendererColumnInput<
  T extends object,
  TAccessor extends Accessor<T, CheckboxSourceValue, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
  TAccessorInput = TAccessor,
> = Omit<
  AccessorColumnInput<
    T,
    TAccessor,
    TReference,
    TPrevColumnId,
    TGroupId,
    TDynamicId,
    TContext,
    CellValue,
    CellValue,
    TAccessorInput
  >,
  "format" | "summary" | "transform" | "type"
> &
  CheckboxColumnDefinition & {
    type: "checkbox";
    format?: never;
    summary?: never;
    transform?: never;
  };

type BaseImageColumnInput<
  T extends object,
  TAccessor extends Accessor<T, unknown, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
  TAccessorInput = TAccessor,
> = Omit<
  ColumnDefinition<T, TContext, TAccessor, TPrevColumnId, TGroupId, TDynamicId, TReference>,
  | "accessor"
  | "conditionalStyle"
  | "defaultValue"
  | "expansion"
  | "formula"
  | "format"
  | "hyperlink"
  | "id"
  | "image"
  | "sparkline"
  | "summary"
  | "totalsRow"
  | "transform"
  | "type"
  | "validation"
> & {
  type: "image";
  accessor: TAccessorInput;
  alt?: ImageAltInput<T, TContext>;
  size?: ImageSize;
  fit?: ImageFit;
  conditionalStyle?: never;
  defaultValue?: never;
  expansion?: never;
  formula?: never;
  format?: never;
  hyperlink?: never;
  sparkline?: never;
  summary?: never;
  totalsRow?: never;
  transform?: never;
  validation?: never;
};

type EmbeddedImageColumnInput<
  T extends object,
  TAccessor extends Accessor<T, ImageSourceValue, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
  TAccessorInput = TAccessor,
> = BaseImageColumnInput<
  T,
  TAccessor,
  TReference,
  TPrevColumnId,
  TGroupId,
  TDynamicId,
  TContext,
  TAccessorInput
> & {
  source?: "embed";
  mediaType?: ImageMediaTypeInput<T, TContext>;
  padding?: number | ImagePadding;
};

type UrlImageColumnInput<
  T extends object,
  TAccessor extends Accessor<T, ImageUrlSourceValue, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
  TAccessorInput = TAccessor,
> = BaseImageColumnInput<
  T,
  TAccessor,
  TReference,
  TPrevColumnId,
  TGroupId,
  TDynamicId,
  TContext,
  TAccessorInput
> & {
  source: "url";
  mediaType?: never;
  padding?: never;
};

type ImageColumnInput<
  T extends object,
  _TAccessor extends Accessor<T, ImageSourceValue | ImageUrlSourceValue, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
  TEmbeddedAccessorInput = any,
  TUrlAccessorInput = any,
> =
  | EmbeddedImageColumnInput<
      T,
      any,
      TReference,
      TPrevColumnId,
      TGroupId,
      TDynamicId,
      TContext,
      TEmbeddedAccessorInput
    >
  | UrlImageColumnInput<
      T,
      any,
      TReference,
      TPrevColumnId,
      TGroupId,
      TDynamicId,
      TContext,
      TUrlAccessorInput
    >;

type HyperlinkRendererColumnInput<
  T extends object,
  TAccessor extends Accessor<T, unknown, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
  TAccessorInput = TAccessor,
> = Omit<
  AccessorColumnInput<
    T,
    TAccessor,
    TReference,
    TPrevColumnId,
    TGroupId,
    TDynamicId,
    TContext,
    CellValue,
    CellValue,
    TAccessorInput
  >,
  "hyperlink" | "type"
> & {
  type: "hyperlink";
  target: HyperlinkInput<T, TContext>;
  tooltip?: LazyText<BoundRowHyperlinkContext<T, TContext>>;
  linkStyle?: CellStyle;
  hyperlink?: never;
};

type ExcelTableAccessorColumnInput<
  T extends object,
  TAccessor extends Accessor<T, unknown, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
  TTransformed = PrimitiveCellValue,
  TDefault = PrimitiveCellValue,
  TAccessorInput = TAccessor,
> = Omit<
  ColumnDefinition<T, TContext, TAccessor, TPrevColumnId, TGroupId, TDynamicId, TReference>,
  "id" | "accessor" | "image" | "summary" | "defaultValue" | "sparkline" | "type" | "transform"
> & {
  accessor: TAccessorInput;
  defaultValue?: TDefault;
  summary?: never;
  transform?: (
    context: RowTransformContext<T, AccessorValue<T, TAccessor>, TContext>,
  ) => TTransformed;
  formula?: never;
};

type ExcelTableSparklineRendererColumnInput<
  T extends object,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
> = Omit<
  ColumnDefinition<T, TContext, never, TPrevColumnId, TGroupId, TDynamicId, TPrevColumnId>,
  | "accessor"
  | "defaultValue"
  | "formula"
  | "id"
  | "image"
  | "sparkline"
  | "summary"
  | "transform"
  | "type"
> &
  Omit<SparklineDefinition<TPrevColumnId, TGroupId, TDynamicId>, "type"> & {
    accessor?: never;
    defaultValue?: never;
    formula?: never;
    summary?: never;
    transform?: never;
    type: "sparkline";
    sparklineType?: SparklineType;
  };

type ExcelTableCheckboxRendererColumnInput<
  T extends object,
  TAccessor extends Accessor<T, CheckboxSourceValue, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
  TAccessorInput = TAccessor,
> = Omit<
  ExcelTableAccessorColumnInput<
    T,
    TAccessor,
    TReference,
    TPrevColumnId,
    TGroupId,
    TDynamicId,
    TContext,
    PrimitiveCellValue,
    PrimitiveCellValue,
    TAccessorInput
  >,
  "format" | "summary" | "transform" | "type"
> &
  CheckboxColumnDefinition & {
    type: "checkbox";
    format?: never;
    summary?: never;
    transform?: never;
  };

type ExcelTableImageColumnInput<
  T extends object,
  TAccessor extends Accessor<T, ImageSourceValue | ImageUrlSourceValue, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
  TEmbeddedAccessorInput = any,
  TUrlAccessorInput = any,
> = OmitEach<
  ImageColumnInput<
    T,
    TAccessor,
    TReference,
    TPrevColumnId,
    TGroupId,
    TDynamicId,
    TContext,
    TEmbeddedAccessorInput,
    TUrlAccessorInput
  >,
  "defaultValue" | "summary" | "totalsRow"
> & {
  defaultValue?: never;
  summary?: never;
  totalsRow?: never;
};

type ExcelTableHyperlinkRendererColumnInput<
  T extends object,
  TAccessor extends Accessor<T, PrimitiveCellValue, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
  TAccessorInput = TAccessor,
> = Omit<
  ExcelTableAccessorColumnInput<
    T,
    TAccessor,
    TReference,
    TPrevColumnId,
    TGroupId,
    TDynamicId,
    TContext,
    PrimitiveCellValue,
    PrimitiveCellValue,
    TAccessorInput
  >,
  "hyperlink" | "type"
> & {
  type: "hyperlink";
  target: HyperlinkInput<T, TContext>;
  tooltip?: LazyText<BoundRowHyperlinkContext<T, TContext>>;
  linkStyle?: CellStyle;
  hyperlink?: never;
};

/**
 * Column kind a definition asks for: its `type`, else a value column when it has an accessor, else
 * a formula column when it has a formula. A definition with both is a value column, so the
 * misplaced `formula` is the key reported.
 */
type ColumnKindOf<TDef> = TDef extends { readonly type: "image"; readonly source: "url" }
  ? "image-url"
  : TDef extends { readonly type: infer TKind extends string }
    ? TKind
    : "accessor" extends keyof TDef
      ? "value"
      : "formula" extends keyof TDef
        ? "formula"
        : "value";

type CellValueLabel = "a cell value (string, number, boolean, Date, null or undefined)";

type CheckedAccessor<
  T extends object,
  TAccessor,
  TContext,
  TValue,
  TLabel extends string,
> = ValidateAccessor<T, TAccessor, TContext, TValue, TLabel>;

/** What a plain column's accessor must return: anything when a transform converts it. */
type ValueAccessorValue<TDef, TCell> = "transform" extends keyof TDef ? unknown : TCell;

type ColumnKindLabel<TKind> = TKind extends "value"
  ? ""
  : TKind extends "image-url"
    ? "URL image "
    : TKind extends "image"
      ? "embedded image "
      : `${TKind & string} `;

/** Column kinds a `type` can name. `image-url` is `type: "image"` with `source: "url"`. */
type TypedColumnKind<TInputs> = Exclude<keyof TInputs, "value" | "formula" | "image-url">;

/**
 * Key-level check of a column definition, in the style of arktype: every key must be an option of
 * the column kind, and an unknown one is reported on that key with the options that exist.
 * Values are typed by the input union the definition is also checked against.
 */
type ValidateColumnKeys<TDef, TKeys, TOptions, TAccessorChecks> = {
  [K in keyof TDef]: K extends "type"
    ? // `undefined`: TypeScript adds `type?: undefined` to the untyped members of a union of
      // definitions, such as `flag ? { type: "checkbox", … } : { accessor: … }`.
      TDef[K] extends TypedColumnKind<TKeys> | undefined
      ? TDef[K]
      : TypedColumnKind<TKeys>
    : ColumnKindOf<TDef> extends keyof TKeys
      ? K extends TKeys[ColumnKindOf<TDef>]
        ? K extends "accessor"
          ? // The kind's accessor check, here rather than in the input shapes: it runs once,
            // and the error lands on `accessor` even when TypeScript can't tell which shape
            // to explain it with (a definition without `type`).
            TAccessorChecks[ColumnKindOf<TDef> & keyof TAccessorChecks]
          : unknown
        : ErrorMessage<`'${K & string}' is not an option of ${ColumnKindLabel<ColumnKindOf<TDef>>}columns. Options: ${JoinUnion<TOptions[ColumnKindOf<TDef> & keyof TOptions]>}`>
      : unknown;
};

/**
 * Input shape of each column kind. The accessor type parameter of the shapes is `any`: they take
 * `accessor` from `AccessorInputOf` and type `transform` from `TAccessor` themselves, and checking
 * a function accessor against `Accessor<T, …>` here compared its parameter with the whole row
 * type, once per kind and per column, which made type checking grow faster than the schema. The value and formula shapes leave out the keys they don't take
 * instead of typing them `never`: they are always in the union, and a `never` would replace the key
 * check's message with "not assignable to never". The formula shape keeps `accessor?: never`:
 * TypeScript relies on it to explain a value column's error against the value shape. A definition
 * with both is a value column (see `ColumnKindOf`), so its `formula` key gets the message.
 */
type ReportColumnInputs<
  T extends object,
  TId extends string,
  TColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TBooleanColumnId extends TColumnId,
  TContext extends SchemaContext,
  _TDef,
  TAccessor,
  TTransformed,
  TDefault,
  TResult,
> = {
  // Value and formula shapes are built from `ColumnDefinition` in one `Omit`: every column builds
  // them, and an `Omit` of an `Omit` doubled the mapped types created per column.
  value: Omit<
    ColumnDefinition<
      T,
      TContext,
      any,
      TColumnId,
      TGroupId,
      TDynamicId,
      FormulaLikeReference<TId, TColumnId>
    >,
    ValueColumnOmittedKeys
  > & {
    type?: never;
    accessor: AccessorInputOf<T, TAccessor, TContext>;
    transform?: (
      context: BoundRowTransformContext<T, AccessorValue<T, TAccessor>, TContext>,
    ) => TTransformed;
    defaultValue?: TDefault;
  };
  formula: Omit<
    ColumnDefinition<
      T,
      TContext,
      never,
      TColumnId,
      TGroupId,
      TDynamicId,
      FormulaLikeReference<TId, TColumnId>
    >,
    FormulaColumnOmittedKeys
  > & {
    type?: never;
    accessor?: never;
    formula: (
      context: FormulaFnArgs<TColumnId, TGroupId, TDynamicId, TContext, TBooleanColumnId>,
    ) => TResult;
  };
  sparkline: Omit<
    SparklineRendererColumnInput<T, TColumnId, TGroupId, TDynamicId, TContext>,
    "accessor" | "transform" | "formula"
  >;
  badge: Omit<
    AccessorColumnInput<
      T,
      any,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TContext,
      CellValue,
      CellValue,
      AccessorInputOf<T, TAccessor, TContext>
    >,
    "formula" | "transform"
  > &
    BadgeColumnDefinition<AccessorValue<T, TAccessor>, T, TContext> & { type: "badge" };
  checkbox: Omit<
    CheckboxRendererColumnInput<
      T,
      any,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TContext,
      AccessorInputOf<T, TAccessor, TContext>
    >,
    "formula" | "format" | "summary" | "transform"
  >;
  // Embedded and URL images are two kinds, so the key check knows a URL image takes no
  // \`padding\` or \`mediaType\`.
  image: Exclude<
    OmitEach<
      ImageColumnInput<
        T,
        any,
        FormulaLikeReference<TId, TColumnId>,
        TColumnId,
        TGroupId,
        TDynamicId,
        TContext,
        AccessorInputOf<T, TAccessor, TContext>,
        AccessorInputOf<T, TAccessor, TContext>
      >,
      ImageColumnRejectedKeys
    >,
    { source: "url" }
  >;
  "image-url": Extract<
    OmitEach<
      ImageColumnInput<
        T,
        any,
        FormulaLikeReference<TId, TColumnId>,
        TColumnId,
        TGroupId,
        TDynamicId,
        TContext,
        AccessorInputOf<T, TAccessor, TContext>,
        AccessorInputOf<T, TAccessor, TContext>
      >,
      ImageColumnRejectedKeys | "mediaType" | "padding"
    >,
    { source: "url" }
  >;
  hyperlink: Omit<
    HyperlinkRendererColumnInput<
      T,
      any,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TContext,
      AccessorInputOf<T, TAccessor, TContext>
    >,
    "transform" | "formula" | "hyperlink"
  > & {
    // Typed from `TAccessor` itself, like the value shape's `transform`.
    transform?: (
      context: BoundRowTransformContext<T, AccessorValue<T, TAccessor>, TContext>,
    ) => TTransformed;
  };
};

/**
 * The input shapes a definition is checked against: every column kind, as a plain union. No shape
 * is picked by a condition on the definition: callbacks are typed before the definition is known,
 * and a condition would freeze their parameters (`value: never`). The `type` key tells the shapes
 * apart.
 */
type ColumnInputFor<TDef, TInputs> =
  | TInputs[("value" | "formula" | "hyperlink") & keyof TInputs]
  | (TDef extends { readonly type: unknown }
      ? ColumnKindOf<TDef> extends "hyperlink"
        ? never
        : ColumnKindOf<TDef> extends keyof TInputs
          ? TInputs[ColumnKindOf<TDef>]
          : TInputs[keyof TInputs]
      : never);

/** Omit for each member of a union (plain `Omit` merges the members). */
type OmitEach<TInput, TKeys extends PropertyKey> = TInput extends unknown
  ? Omit<TInput, TKeys>
  : never;

type ValueColumnOmittedKeys =
  | "id"
  | "accessor"
  | "image"
  | "sparkline"
  | "type"
  | "transform"
  | "defaultValue"
  | "formula";
type FormulaColumnOmittedKeys =
  | "id"
  | "accessor"
  | "image"
  | "sparkline"
  | "transform"
  | "type"
  | "formula";

/**
 * Keys an image column doesn't take. URL images also leave out `mediaType` and `padding`; the key
 * check reports them, as it treats embedded and URL images as two kinds.
 */
type ImageColumnRejectedKeys =
  | "conditionalStyle"
  | "defaultValue"
  | "expansion"
  | "formula"
  | "format"
  | "hyperlink"
  | "sparkline"
  | "summary"
  | "totalsRow"
  | "transform"
  | "validation";

type PrimitiveCellValueLabel =
  "a single cell value (string, number, boolean, Date, null or undefined)";

/** Input shape of each Excel table column kind. See `ReportColumnInputs`. */
type ExcelTableColumnInputs<
  T extends object,
  TId extends string,
  TColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TBooleanColumnId extends TColumnId,
  TContext extends SchemaContext,
  _TDef,
  TAccessor,
  TTransformed,
  TDefault,
  TResult,
> = {
  value: Omit<
    ColumnDefinition<
      T,
      TContext,
      any,
      TColumnId,
      TGroupId,
      TDynamicId,
      FormulaLikeReference<TId, TColumnId>
    >,
    ValueColumnOmittedKeys | "summary"
  > & {
    type?: never;
    accessor: AccessorInputOf<T, TAccessor, TContext>;
    transform?: (
      context: RowTransformContext<T, AccessorValue<T, TAccessor>, TContext>,
    ) => TTransformed;
    defaultValue?: TDefault;
  };
  formula: Omit<
    ColumnDefinition<
      T,
      TContext,
      never,
      TColumnId,
      TGroupId,
      TDynamicId,
      FormulaLikeReference<TId, TColumnId>
    >,
    FormulaColumnOmittedKeys | "defaultValue" | "summary"
  > & {
    type?: never;
    accessor?: never;
    formula: (
      context: FormulaFnArgs<TColumnId, TGroupId, TDynamicId, TContext, TBooleanColumnId>,
    ) => TResult;
  };
  sparkline: Omit<
    ExcelTableSparklineRendererColumnInput<T, TColumnId, TGroupId, TDynamicId, TContext>,
    "accessor" | "defaultValue" | "formula" | "summary" | "transform"
  >;
  badge: Omit<
    ExcelTableAccessorColumnInput<
      T,
      any,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TContext,
      PrimitiveCellValue,
      PrimitiveCellValue,
      AccessorInputOf<T, TAccessor, TContext>
    >,
    "formula" | "summary" | "transform"
  > &
    BadgeColumnDefinition<AccessorValue<T, TAccessor>, T, TContext> & { type: "badge" };
  checkbox: Omit<
    ExcelTableCheckboxRendererColumnInput<
      T,
      any,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TContext,
      AccessorInputOf<T, TAccessor, TContext>
    >,
    "formula" | "format" | "summary" | "transform"
  >;
  // Embedded and URL images are two kinds, so the key check knows a URL image takes no
  // \`padding\` or \`mediaType\`.
  image: Exclude<
    OmitEach<
      ExcelTableImageColumnInput<
        T,
        any,
        FormulaLikeReference<TId, TColumnId>,
        TColumnId,
        TGroupId,
        TDynamicId,
        TContext,
        AccessorInputOf<T, TAccessor, TContext>,
        AccessorInputOf<T, TAccessor, TContext>
      >,
      ImageColumnRejectedKeys
    >,
    { source: "url" }
  >;
  "image-url": Extract<
    OmitEach<
      ExcelTableImageColumnInput<
        T,
        any,
        FormulaLikeReference<TId, TColumnId>,
        TColumnId,
        TGroupId,
        TDynamicId,
        TContext,
        AccessorInputOf<T, TAccessor, TContext>,
        AccessorInputOf<T, TAccessor, TContext>
      >,
      ImageColumnRejectedKeys | "mediaType" | "padding"
    >,
    { source: "url" }
  >;
  hyperlink: Omit<
    ExcelTableHyperlinkRendererColumnInput<
      T,
      any,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TContext,
      AccessorInputOf<T, TAccessor, TContext>
    >,
    "transform" | "formula" | "hyperlink" | "summary"
  > & {
    transform?: (
      context: RowTransformContext<T, AccessorValue<T, TAccessor>, TContext>,
    ) => TTransformed;
  };
};

/**
 * The accessor as the input shapes take it; the key check validates it. While it is still being
 * inferred it is `never` (its default), and the shape offers any field or row function instead,
 * so an arrow function gets its `row` type. That branch doesn't depend on the accessor, so it is
 * computed once per row type.
 */
type AccessorInputOf<T extends object, TAccessor, TContext> = [TAccessor] extends [never]
  ? // Any string rather than every field: the key check validates the field and offers the
    // names, and a union of every field here cost a pass over the row type per column.
    (string & {}) | ((context: T & AccessorContext<T, TContext>) => unknown)
  : // Any string too: the key check reports a wrong field, and a literal here would combine with
    // its message into `never`, which collapses the whole definition.
    TAccessor | (string & {});

/**
 * The accessor check of each column kind. It runs once per column, in the key check: run inside
 * every input shape, it ran once per kind, each time over every field of the row.
 */
type ReportAccessorChecks<T extends object, TAccessor, TContext, TDef> = {
  value: CheckedAccessor<
    T,
    TAccessor,
    TContext,
    ValueAccessorValue<TDef, CellValue>,
    CellValueLabel
  >;
  badge: CheckedAccessor<
    T,
    TAccessor,
    TContext,
    BadgeSourceValue,
    "a cell value or a list of them"
  >;
  checkbox: CheckedAccessor<T, TAccessor, TContext, CheckboxSourceValue, "a boolean">;
  image: CheckedAccessor<T, TAccessor, TContext, ImageSourceValue, "image bytes">;
  "image-url": CheckedAccessor<T, TAccessor, TContext, ImageUrlSourceValue, "an image URL">;
  hyperlink: CheckedAccessor<
    T,
    TAccessor,
    TContext,
    ValueAccessorValue<TDef, CellValue>,
    CellValueLabel
  >;
};

type ExcelTableAccessorChecks<T extends object, TAccessor, TContext, TDef> = {
  value: CheckedAccessor<
    T,
    TAccessor,
    TContext,
    ValueAccessorValue<TDef, PrimitiveCellValue>,
    PrimitiveCellValueLabel
  >;
  badge: CheckedAccessor<T, TAccessor, TContext, PrimitiveCellValue, PrimitiveCellValueLabel>;
  checkbox: CheckedAccessor<T, TAccessor, TContext, CheckboxSourceValue, "a boolean">;
  image: CheckedAccessor<T, TAccessor, TContext, ImageSourceValue, "image bytes">;
  "image-url": CheckedAccessor<T, TAccessor, TContext, ImageUrlSourceValue, "an image URL">;
  hyperlink: CheckedAccessor<
    T,
    TAccessor,
    TContext,
    ValueAccessorValue<TDef, PrimitiveCellValue>,
    PrimitiveCellValueLabel
  >;
};

/** Keys each column kind takes. */
type ColumnKeysOf<TInputs> = { [K in keyof TInputs]: AllowedKeys<TInputs[K]> };

/** Keys each column kind lists as options in messages. */
type ColumnOptionsOf<TInputs> = {
  [K in keyof TInputs]: Exclude<OptionKeys<TInputs[K]>, "kind" | "type">;
};

/**
 * Keys of each kind, from the input shapes with generic ids. They don't depend on the columns
 * declared so far, so TypeScript computes them once per row type instead of once per column.
 */
type ReportColumnKeys<T extends object, TContext extends SchemaContext> = ColumnKeysOf<
  ReportColumnInputs<
    T,
    string,
    string,
    string,
    string,
    never,
    TContext,
    {},
    unknown,
    unknown,
    unknown,
    unknown
  >
>;
type ReportColumnOptions<T extends object, TContext extends SchemaContext> = ColumnOptionsOf<
  ReportColumnInputs<
    T,
    string,
    string,
    string,
    string,
    never,
    TContext,
    {},
    unknown,
    unknown,
    unknown,
    unknown
  >
>;
type ExcelTableColumnKeys<T extends object, TContext extends SchemaContext> = ColumnKeysOf<
  ExcelTableColumnInputs<
    T,
    string,
    string,
    string,
    string,
    never,
    TContext,
    {},
    unknown,
    unknown,
    unknown,
    unknown
  >
>;
type ExcelTableColumnOptions<T extends object, TContext extends SchemaContext> = ColumnOptionsOf<
  ExcelTableColumnInputs<
    T,
    string,
    string,
    string,
    string,
    never,
    TContext,
    {},
    unknown,
    unknown,
    unknown,
    unknown
  >
>;

/** Value a column writes into its cells, by column kind. */
type ColumnValueOf<
  T extends object,
  TDef,
  TAccessor,
  TTransformed,
  TDefault,
  TResult,
> = ColumnValueOfKind<T, ColumnKindOf<TDef>, TAccessor, TTransformed, TDefault, TResult>;

/** The kind is computed once by `ColumnValueOf`, not once per branch. */
type ColumnValueOfKind<
  T extends object,
  TKind,
  TAccessor,
  TTransformed,
  TDefault,
  TResult,
> = TKind extends "formula"
  ? FormulaColumnValue<TResult>
  : TKind extends "checkbox"
    ? boolean
    : TKind extends "image" | "image-url" | "sparkline"
      ? never
      : TKind extends "badge"
        ? ColumnCellValue<AccessorValue<T, TAccessor>>
        : AccessorColumnValue<AccessorValue<T, TAccessor>, TTransformed, TDefault>;

type BooleanColumnIdOf<TDef, TId extends string> =
  ColumnKindOf<TDef> extends "checkbox" ? TId : never;

export interface GroupDefinition<
  T extends object,
  TId extends string = string,
  TContext extends SchemaContext = SchemaContext,
> extends BaseSchemaNodeDefinition<T, TContext> {
  id: TId;
  kind: "group";
  children: SchemaNode<T, TContext>[];
}

export interface DynamicDefinition<
  T extends object,
  TId extends string = string,
  TContext extends SchemaContext = SchemaContext,
> extends BaseSchemaNodeDefinition<T, TContext> {
  id: TId;
  kind: "dynamic";
  build: (builder: unknown, args: { ctx: TContext }) => void;
}

export type SchemaNode<T extends object, TContext extends SchemaContext = SchemaContext> =
  | ColumnDefinition<T, TContext, any, any, any, any, any>
  | GroupDefinition<T, string, TContext>
  | DynamicDefinition<T, string, TContext>;

export interface SchemaDefinition<
  T extends object,
  TColumnId extends string = string,
  TGroupId extends string = never,
  TDynamicId extends string = never,
  TSchemaContext extends SchemaContext = SchemaContext,
  TKind extends SchemaKind = "report",
  TColumnValues = { [K in TColumnId]: unknown },
> {
  kind: TKind;
  columns: SchemaNode<T, TSchemaContext>[];
  theme?: SpreadsheetTheme;
  readonly __columnIds?: TColumnId | undefined;
  readonly __columnValues?: TColumnValues | undefined;
  readonly __groupIds?: TGroupId | undefined;
  readonly __dynamicIds?: TDynamicId | undefined;
  readonly __context?: TSchemaContext | undefined;
  readonly __kind?: TKind | undefined;
}

export type ReportSchemaDefinition<
  T extends object,
  TColumnId extends string = string,
  TGroupId extends string = never,
  TDynamicId extends string = never,
  TSchemaContext extends SchemaContext = SchemaContext,
  TColumnValues = { [K in TColumnId]: unknown },
> = SchemaDefinition<T, TColumnId, TGroupId, TDynamicId, TSchemaContext, "report", TColumnValues>;

export type ExcelTableSchemaDefinition<
  T extends object,
  TColumnId extends string = string,
  TGroupId extends string = never,
  TDynamicId extends string = never,
  TSchemaContext extends SchemaContext = SchemaContext,
  TColumnValues = { [K in TColumnId]: unknown },
> = SchemaDefinition<
  T,
  TColumnId,
  TGroupId,
  TDynamicId,
  TSchemaContext,
  "excel-table",
  TColumnValues
>;

export type SchemaColumnId<TSchema> =
  TSchema extends SchemaDefinition<any, infer TColumnId, any, any, any, any> ? TColumnId : never;
export type SchemaGroupId<TSchema> =
  TSchema extends SchemaDefinition<any, any, infer TGroupId, any, any, any> ? TGroupId : never;
export type SchemaDynamicId<TSchema> =
  TSchema extends SchemaDefinition<any, any, any, infer TDynamicId, any, any> ? TDynamicId : never;
export type SchemaContextOf<TSchema> =
  TSchema extends SchemaDefinition<any, any, any, any, infer TSchemaContext, any>
    ? TSchemaContext
    : never;
export type SchemaGroupContext<TSchema> = SchemaContextOf<TSchema>;
/** Value type of each column, as written into its cells. */
export type SchemaColumnValues<TSchema> =
  TSchema extends SchemaDefinition<any, any, any, any, any, any, infer TColumnValues>
    ? { [K in keyof TColumnValues]: TColumnValues[K] }
    : never;
export type SchemaKindOf<TSchema> =
  TSchema extends SchemaDefinition<any, any, any, any, any, infer TKind> ? TKind : never;

interface GroupOptions<TContext extends SchemaContext> {
  header?: LazyText<SchemaTextContext<TContext>>;
  condition?: StructureConditionDefinition<TContext>;
}

interface DynamicOptions<TContext extends SchemaContext> {
  condition?: StructureConditionDefinition<TContext>;
}

interface BuiltSchemaNodeOwner<T extends object, TContext extends SchemaContext> {
  build(): { columns: SchemaNode<T, TContext>[] };
}

const DEFAULT_BADGE_STYLE: CellStyle = {
  fill: { color: { rgb: "E2E8F0" } },
  font: { bold: true, color: { rgb: "334155" } },
  alignment: { horizontal: "center", vertical: "center" },
};

const DEFAULT_CHECKBOX_STYLE: CellStyle = {
  alignment: { horizontal: "center", vertical: "center" },
  font: { bold: true, color: { rgb: "0F172A" } },
};

function normalizeColumnDefinition<T extends object, TContext extends SchemaContext>(
  id: string,
  definition: ColumnDefinition<T, TContext, any, any, any, any, any>,
) {
  const normalizedDefinition = normalizeRendererColumnDefinition(definition) as ColumnDefinition<
    T,
    TContext,
    any,
    any,
    any,
    any,
    any
  >;
  const { sparkline, ...definitionWithoutSparkline } = normalizedDefinition;

  return {
    kind: "column" as const,
    ...definitionWithoutSparkline,
    id,
    ...(normalizedDefinition.summary
      ? { summary: normalizeSummaryInput<T, TContext>(normalizedDefinition.summary) }
      : {}),
    ...(normalizedDefinition.conditionalStyle
      ? {
          conditionalStyle: normalizeConditionalStyleInput(
            normalizedDefinition.conditionalStyle,
          ) as ConditionalStyleRule<string, string>[],
        }
      : {}),
    ...(normalizedDefinition.type === "sparkline" && sparkline ? { sparkline } : {}),
  } as ColumnDefinition<T, TContext, any, any, any, any, any>;
}

function normalizeRendererColumnDefinition<T extends object, TContext extends SchemaContext>(
  definition: ColumnDefinition<T, TContext, any, any, any, any, any>,
) {
  if (definition.type === "sparkline") {
    const {
      emptyCells,
      sparklineType,
      source,
      type,
      show,
      colors,
      style,
      lineWeight,
      minAxisType,
      maxAxisType,
      manualMin,
      manualMax,
      rightToLeft,
      ...rest
    } = definition as ColumnDefinition<T, TContext, any, any, any, any, any> &
      Omit<SparklineDefinition<string, string, string>, "type"> & {
        sparklineType?: SparklineType;
      };

    return {
      ...rest,
      type,
      sparkline: normalizeSparklineInput({
        source,
        type: sparklineType,
        emptyCells,
        show,
        colors,
        style,
        lineWeight,
        minAxisType,
        maxAxisType,
        manualMin,
        manualMax,
        rightToLeft,
      } as SparklineInput<string, string, string>) as ResolvedSparklineDefinition,
    };
  }

  if (definition.type === "badge") {
    const { defaultVariant, style, variants, ...rest } = definition as ColumnDefinition<
      T,
      TContext,
      any,
      any,
      any,
      any,
      any
    > &
      BadgeColumnDefinition<BadgeSourceValue, T, TContext>;

    return {
      ...rest,
      style: normalizeBadgeStyle(rest.accessor, style, variants, defaultVariant),
      transform: normalizeBadgeTransform(variants, defaultVariant),
    };
  }

  if (definition.type === "checkbox") {
    const { style, ...rest } = definition as ColumnDefinition<
      T,
      TContext,
      any,
      any,
      any,
      any,
      any
    > &
      CheckboxColumnDefinition;

    return {
      ...rest,
      width: rest.width ?? 8,
      style: normalizeCheckboxStyle(style),
      transform: normalizeCheckboxTransform(),
    };
  }

  if (definition.type === "image") {
    const { alt, fit, mediaType, padding, size, source, ...rest } = definition as ColumnDefinition<
      T,
      TContext,
      any,
      any,
      any,
      any,
      any
    > & {
      alt?: ImageAltInput<T, TContext>;
      fit?: ImageFit;
      mediaType?: ImageMediaTypeInput<T, TContext>;
      padding?: number | ImagePadding;
      size?: ImageSize;
      source?: ImageColumnSource;
    };

    return {
      ...rest,
      image: {
        alt,
        fit,
        mediaType,
        padding,
        size,
        source,
      },
    };
  }

  if (definition.type === "hyperlink") {
    const { linkStyle, target, tooltip, ...rest } = definition as ColumnDefinition<
      T,
      TContext,
      any,
      any,
      any,
      any,
      any
    > & {
      linkStyle?: CellStyle;
      target: HyperlinkInput<T, TContext>;
      tooltip?: LazyText<BoundRowHyperlinkContext<T, TContext>>;
    };

    return {
      ...rest,
      hyperlink: normalizeHyperlinkRendererTarget(target, tooltip, linkStyle),
    };
  }

  return definition;
}

function normalizeBadgeTransform<T extends object, TContext extends SchemaContext>(
  variants?: Partial<Record<string, BadgeVariantDefinition<T, any, TContext>>>,
  defaultVariant?: BadgeVariantDefinition<T, any, TContext>,
): TransformFn<T, unknown, TContext> {
  return (context) => {
    return mapRendererValue(context.value, (value) => {
      const variant = resolveBadgeVariant(value, variants, defaultVariant);
      const label = resolveBadgeVariantLabel(variant, context, value);

      return label ?? toBadgeCellValue(value);
    });
  };
}

function normalizeBadgeStyle<T extends object, TContext extends SchemaContext>(
  accessor: Accessor<T, unknown, TContext> | Path<T> | undefined,
  style: CellStyle | StyleFn<T, TContext> | undefined,
  variants?: Partial<Record<string, BadgeVariantDefinition<T, any, TContext>>>,
  defaultVariant?: BadgeVariantDefinition<T, any, TContext>,
): CellStyle | StyleFn<T, TContext> {
  return (context) => {
    const value = accessor
      ? resolveAccessor(context.row, accessor as Accessor<T, unknown, TContext>, context.ctx)
      : undefined;
    const variant = resolveBadgeVariant(value, variants, defaultVariant);

    return deepMerge<CellStyle>(
      DEFAULT_BADGE_STYLE,
      resolveRendererStyle(style, context),
      resolveBadgeVariantStyle(variant),
    );
  };
}

function normalizeCheckboxTransform<
  T extends object,
  TContext extends SchemaContext,
>(): TransformFn<T, CheckboxSourceValue, TContext> {
  return ({ value }) => {
    return mapRendererValue(value, (item) => {
      if (item === null || item === undefined) {
        return null;
      }

      return item === true;
    });
  };
}

function normalizeCheckboxStyle<T extends object, TContext extends SchemaContext>(
  style: CellStyle | StyleFn<T, TContext> | undefined,
): CellStyle | StyleFn<T, TContext> {
  return (context) =>
    withCellControl(
      deepMerge<CellStyle>(DEFAULT_CHECKBOX_STYLE, resolveRendererStyle(style, context)),
      "checkbox",
    );
}

function resolveRendererStyle<T extends object, TContext extends SchemaContext>(
  style: CellStyle | StyleFn<T, TContext> | undefined,
  context: BoundRowStyleContext<T, TContext>,
): CellStyle | undefined {
  if (typeof style !== "function") {
    return style;
  }

  if (style.length >= 3) {
    return (style as (row: T, rowIndex: number, subRowIndex: number) => CellStyle | undefined)(
      context.row,
      context.rowIndex,
      context.subRowIndex,
    );
  }

  return style(context);
}

function resolveBadgeVariant(
  value: unknown,
  variants?: Partial<Record<string, BadgeVariantDefinition<any, any, any>>>,
  defaultVariant?: BadgeVariantDefinition<any, any, any>,
) {
  const variant = variants?.[toBadgeKey(value)];
  return variant ?? defaultVariant;
}

function resolveBadgeVariantLabel<T extends object, TContext extends SchemaContext>(
  variant: BadgeVariantDefinition<T, any, TContext> | undefined,
  context: BoundRowTransformContext<T, unknown, TContext>,
  value: unknown,
) {
  if (!variant || !isBadgeVariantOptions(variant)) {
    return undefined;
  }

  const label = variant.label;
  if (typeof label !== "function") {
    return label;
  }

  return label({
    ...context,
    value,
  });
}

function resolveBadgeVariantStyle(variant?: BadgeVariantDefinition<any, any, any>) {
  if (!variant) {
    return undefined;
  }

  return isBadgeVariantOptions(variant) ? variant.style : variant;
}

function isBadgeVariantOptions(
  variant: BadgeVariantDefinition<any, any, any>,
): variant is BadgeVariantOptions<any, any, any> {
  return "label" in variant || "style" in variant;
}

function toBadgeCellValue(value: unknown): PrimitiveCellValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }

  return String(value);
}

function mapRendererValue(
  value: unknown,
  mapValue: (value: unknown) => PrimitiveCellValue,
): CellValue {
  return Array.isArray(value) ? value.map(mapValue) : mapValue(value);
}

function toBadgeKey(value: unknown) {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  return String(value);
}

function normalizeHyperlinkRendererTarget<T extends object, TContext extends SchemaContext>(
  target: HyperlinkInput<T, TContext>,
  tooltip?: LazyText<BoundRowHyperlinkContext<T, TContext>>,
  linkStyle?: CellStyle,
): HyperlinkInput<T, TContext> {
  if (!tooltip && !linkStyle) {
    return target;
  }

  return (context) => {
    const resolved = typeof target === "function" ? target(context) : target;
    if (!resolved) {
      return resolved;
    }

    if (typeof resolved === "string") {
      return {
        target: resolved,
        tooltip,
        style: linkStyle,
      };
    }

    return {
      ...resolved,
      tooltip: resolved.tooltip ?? tooltip,
      style: resolved.style ?? linkStyle,
    };
  };
}

function normalizeGroupNode<T extends object, TContext extends SchemaContext>(
  id: string,
  options: GroupOptions<TContext> | undefined,
  childBuilder: BuiltSchemaNodeOwner<T, TContext>,
): GroupDefinition<T, string, TContext> {
  return {
    id,
    kind: "group",
    ...(options?.header ? { header: options.header } : {}),
    ...(options?.condition ? { condition: options.condition } : {}),
    children: [...childBuilder.build().columns] as SchemaNode<T, TContext>[],
  };
}

function normalizeDynamicNode<T extends object, TContext extends SchemaContext>(
  id: string,
  build: (builder: unknown, args: { ctx: TContext }) => void,
  options?: DynamicOptions<TContext>,
): DynamicDefinition<T, string, TContext> {
  return {
    id,
    kind: "dynamic",
    build,
    ...(options?.condition ? { condition: options.condition } : {}),
  };
}

abstract class BaseSchemaBuilder<
  T extends object,
  TColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TSchemaContext extends SchemaContext,
  TBooleanColumnId extends TColumnId = never,
  TColumnValues = EmptyColumnValues,
> {
  /**
   * Type-only. Without a member that uses it, `infer` in `ChildBooleanColumnIds` falls back to
   * the constraint, and every column built inside a group was typed as a boolean in formulas.
   */
  declare readonly __booleanColumnIds?: TBooleanColumnId;
  protected readonly columns: SchemaNode<T, TSchemaContext>[] = [];
  protected readonly ids = new Set<string>();
  protected currentTheme?: SpreadsheetTheme;

  protected abstract createChildBuilder(): this;
  protected abstract buildSchema(
    kind: SchemaKind,
  ): SchemaDefinition<T, TColumnId, TGroupId, TDynamicId, TSchemaContext, any, TColumnValues>;
  protected abstract readonly schemaKind: SchemaKind;

  protected ensureIdAvailable(id: string) {
    if (this.ids.has(id)) {
      throw new Error(`Column with id '${id}' already exists.`);
    }

    this.ids.add(id);
  }

  protected addColumnNode(node: SchemaNode<T, TSchemaContext>) {
    this.columns.push(node);
  }

  protected groupImpl<const TId extends string>(
    id: TId,
    optionsOrBuild: GroupOptions<TSchemaContext> | ((builder: this) => unknown),
    maybeBuild?: (builder: this) => unknown,
  ) {
    this.ensureIdAvailable(id);
    const build = typeof optionsOrBuild === "function" ? optionsOrBuild : maybeBuild;
    const options = typeof optionsOrBuild === "function" ? undefined : optionsOrBuild;
    if (!build) {
      throw new Error(`Group '${id}' requires a build callback.`);
    }

    const childBuilder = this.createChildBuilder();
    build(childBuilder);
    this.addColumnNode(normalizeGroupNode<T, TSchemaContext>(id, options, childBuilder));
  }

  protected dynamicImpl<const TId extends string>(
    id: TId,
    optionsOrBuild:
      | DynamicOptions<TSchemaContext>
      | ((builder: this, args: { ctx: TSchemaContext }) => void),
    maybeBuild?: (builder: this, args: { ctx: TSchemaContext }) => void,
  ) {
    this.ensureIdAvailable(id);
    const build = typeof optionsOrBuild === "function" ? optionsOrBuild : maybeBuild;
    const options = typeof optionsOrBuild === "function" ? undefined : optionsOrBuild;
    if (!build) {
      throw new Error(`Dynamic '${id}' requires a build callback.`);
    }

    this.addColumnNode(normalizeDynamicNode<T, TSchemaContext>(id, build as never, options));
  }

  theme(theme: SpreadsheetTheme) {
    this.currentTheme = theme;
    return this;
  }

  group<const TId extends string, TResult>(
    id: TId,
    build: (builder: this) => TResult,
  ): BaseSchemaBuilder<
    T,
    TColumnId | Exclude<ChildColumnIds<TResult>, TColumnId>,
    TGroupId | TId | Exclude<ChildGroupIds<TResult>, TGroupId>,
    TDynamicId | Exclude<ChildDynamicIds<TResult>, TDynamicId>,
    TSchemaContext,
    TBooleanColumnId | Exclude<ChildBooleanColumnIds<TResult>, TBooleanColumnId>,
    TColumnValues & ChildColumnValues<TResult>
  >;
  group<const TId extends string>(
    id: TId,
    build: (builder: this) => void,
  ): BaseSchemaBuilder<
    T,
    TColumnId,
    TGroupId | TId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  >;
  group<const TId extends string, TResult>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => TResult,
  ): BaseSchemaBuilder<
    T,
    TColumnId | Exclude<ChildColumnIds<TResult>, TColumnId>,
    TGroupId | TId | Exclude<ChildGroupIds<TResult>, TGroupId>,
    TDynamicId | Exclude<ChildDynamicIds<TResult>, TDynamicId>,
    TSchemaContext,
    TBooleanColumnId | Exclude<ChildBooleanColumnIds<TResult>, TBooleanColumnId>,
    TColumnValues & ChildColumnValues<TResult>
  >;
  group<const TId extends string>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => void,
  ): BaseSchemaBuilder<
    T,
    TColumnId,
    TGroupId | TId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  >;
  group<const TId extends string>(
    id: TId,
    optionsOrBuild: GroupOptions<TSchemaContext> | ((builder: this) => unknown),
    maybeBuild?: (builder: this) => unknown,
  ): BaseSchemaBuilder<
    T,
    TColumnId,
    TGroupId | TId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  > {
    this.groupImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as BaseSchemaBuilder<
      T,
      TColumnId,
      TGroupId | TId,
      TDynamicId,
      TSchemaContext,
      TBooleanColumnId,
      TColumnValues
    >;
  }

  dynamic<const TId extends string>(
    id: TId,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): BaseSchemaBuilder<
    T,
    TColumnId,
    TGroupId,
    TDynamicId | TId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  >;
  dynamic<const TId extends string>(
    id: TId,
    options: DynamicOptions<TSchemaContext>,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): BaseSchemaBuilder<
    T,
    TColumnId,
    TGroupId,
    TDynamicId | TId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  >;
  dynamic<const TId extends string>(
    id: TId,
    optionsOrBuild:
      | DynamicOptions<TSchemaContext>
      | ((builder: this, args: { ctx: TSchemaContext }) => void),
    maybeBuild?: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): BaseSchemaBuilder<
    T,
    TColumnId,
    TGroupId,
    TDynamicId | TId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  > {
    this.dynamicImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as BaseSchemaBuilder<
      T,
      TColumnId,
      TGroupId,
      TDynamicId | TId,
      TSchemaContext,
      TBooleanColumnId,
      TColumnValues
    >;
  }

  build() {
    return this.buildSchema(this.schemaKind);
  }
}

export class SchemaBuilder<
  T extends object,
  TColumnId extends string = never,
  TGroupId extends string = never,
  TDynamicId extends string = never,
  TSchemaContext extends SchemaContext = unknown,
  TBooleanColumnId extends TColumnId = never,
  TColumnValues = EmptyColumnValues,
> extends BaseSchemaBuilder<
  T,
  TColumnId,
  TGroupId,
  TDynamicId,
  TSchemaContext,
  TBooleanColumnId,
  TColumnValues
> {
  protected readonly schemaKind = "report" as const;

  static create<T extends object, TContext extends SchemaContext = unknown>() {
    return new SchemaBuilder<T, never, never, never, TContext>();
  }

  protected createChildBuilder(): this {
    return new SchemaBuilder<
      T,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext,
      TBooleanColumnId,
      TColumnValues
    >() as this;
  }

  protected buildSchema() {
    return {
      kind: "report" as const,
      columns: [...this.columns],
      theme: this.currentTheme,
    } satisfies ReportSchemaDefinition<
      T,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext,
      TColumnValues
    >;
  }

  /**
   * Typed with its kind, so `.table()` offers report options. The base `build()` typed the kind as
   * `any`, which made every schema take Excel table options such as `totalsRow`.
   */
  override build(): ReportSchemaDefinition<
    T,
    TColumnId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TColumnValues
  > {
    return this.buildSchema();
  }

  column<
    const TId extends string,
    const TDef,
    TAccessor extends Path<T> | (string & {}) | ((context: any) => unknown) = never,
    TTransformed extends CellValue = never,
    TDefault extends CellValue = never,
    TResult extends FormulaValue<TColumnId, TGroupId | TDynamicId> = never,
  >(
    id: TId,
    definition: ValidateColumnKeys<
      TDef,
      ReportColumnKeys<T, TSchemaContext>,
      ReportColumnOptions<T, TSchemaContext>,
      ReportAccessorChecks<T, TAccessor, TSchemaContext, TDef>
    > &
      ColumnInputFor<
        TDef,
        ReportColumnInputs<
          T,
          TId,
          TColumnId,
          TGroupId,
          TDynamicId,
          TBooleanColumnId,
          TSchemaContext,
          TDef,
          TAccessor,
          TTransformed,
          TDefault,
          TResult
        >
      >,
  ): SchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId | BooleanColumnIdOf<TDef, TId>,
    WithColumnValue<
      TColumnValues,
      TId,
      ColumnValueOf<T, TDef, TAccessor, TTransformed, TDefault, TResult>
    >
  >;
  column(id: string, definition: object): unknown {
    this.ensureIdAvailable(id);
    this.addColumnNode(normalizeColumnDefinition(id, definition as any));
    return this;
  }

  override group<const TId extends string, TResult>(
    id: TId,
    build: (builder: this) => TResult,
  ): SchemaBuilder<
    T,
    TColumnId | Exclude<ChildColumnIds<TResult>, TColumnId>,
    TGroupId | TId | Exclude<ChildGroupIds<TResult>, TGroupId>,
    TDynamicId | Exclude<ChildDynamicIds<TResult>, TDynamicId>,
    TSchemaContext,
    TBooleanColumnId | Exclude<ChildBooleanColumnIds<TResult>, TBooleanColumnId>,
    TColumnValues & ChildColumnValues<TResult>
  >;
  override group<const TId extends string>(
    id: TId,
    build: (builder: this) => void,
  ): SchemaBuilder<
    T,
    TColumnId,
    TGroupId | TId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  >;
  override group<const TId extends string, TResult>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => TResult,
  ): SchemaBuilder<
    T,
    TColumnId | Exclude<ChildColumnIds<TResult>, TColumnId>,
    TGroupId | TId | Exclude<ChildGroupIds<TResult>, TGroupId>,
    TDynamicId | Exclude<ChildDynamicIds<TResult>, TDynamicId>,
    TSchemaContext,
    TBooleanColumnId | Exclude<ChildBooleanColumnIds<TResult>, TBooleanColumnId>,
    TColumnValues & ChildColumnValues<TResult>
  >;
  override group<const TId extends string>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => void,
  ): SchemaBuilder<
    T,
    TColumnId,
    TGroupId | TId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  >;
  override group<const TId extends string>(
    id: TId,
    optionsOrBuild: GroupOptions<TSchemaContext> | ((builder: this) => unknown),
    maybeBuild?: (builder: this) => unknown,
  ): any {
    this.groupImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as SchemaBuilder<
      T,
      TColumnId,
      TGroupId | TId,
      TDynamicId,
      TSchemaContext,
      TBooleanColumnId,
      TColumnValues
    >;
  }

  override dynamic<const TId extends string>(
    id: TId,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): SchemaBuilder<
    T,
    TColumnId,
    TGroupId,
    TDynamicId | TId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  >;
  override dynamic<const TId extends string>(
    id: TId,
    options: DynamicOptions<TSchemaContext>,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): SchemaBuilder<
    T,
    TColumnId,
    TGroupId,
    TDynamicId | TId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  >;
  override dynamic<const TId extends string>(
    id: TId,
    optionsOrBuild:
      | DynamicOptions<TSchemaContext>
      | ((builder: this, args: { ctx: TSchemaContext }) => void),
    maybeBuild?: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): SchemaBuilder<
    T,
    TColumnId,
    TGroupId,
    TDynamicId | TId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  > {
    this.dynamicImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as SchemaBuilder<
      T,
      TColumnId,
      TGroupId,
      TDynamicId | TId,
      TSchemaContext,
      TBooleanColumnId,
      TColumnValues
    >;
  }
}

export class ExcelTableSchemaBuilder<
  T extends object,
  TColumnId extends string = never,
  TGroupId extends string = never,
  TDynamicId extends string = never,
  TSchemaContext extends SchemaContext = unknown,
  TBooleanColumnId extends TColumnId = never,
  TColumnValues = EmptyColumnValues,
> extends BaseSchemaBuilder<
  T,
  TColumnId,
  TGroupId,
  TDynamicId,
  TSchemaContext,
  TBooleanColumnId,
  TColumnValues
> {
  protected readonly schemaKind = "excel-table" as const;

  static create<T extends object, TContext extends SchemaContext = unknown>() {
    return new ExcelTableSchemaBuilder<T, never, never, never, TContext>();
  }

  protected createChildBuilder(): this {
    return new ExcelTableSchemaBuilder<
      T,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext,
      TBooleanColumnId,
      TColumnValues
    >() as this;
  }

  protected buildSchema() {
    return {
      kind: "excel-table" as const,
      columns: [...this.columns],
      theme: this.currentTheme,
    } satisfies ExcelTableSchemaDefinition<
      T,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext,
      TColumnValues
    >;
  }

  /** Typed with its kind, so `.table()` offers Excel table options. */
  override build(): ExcelTableSchemaDefinition<
    T,
    TColumnId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TColumnValues
  > {
    return this.buildSchema();
  }

  column<
    const TId extends string,
    const TDef,
    TAccessor extends Path<T> | (string & {}) | ((context: any) => unknown) = never,
    TTransformed extends PrimitiveCellValue = never,
    TDefault extends PrimitiveCellValue = never,
    TResult extends FormulaValue<TColumnId, TGroupId | TDynamicId> = never,
  >(
    id: TId,
    definition: ValidateColumnKeys<
      TDef,
      ExcelTableColumnKeys<T, TSchemaContext>,
      ExcelTableColumnOptions<T, TSchemaContext>,
      ExcelTableAccessorChecks<T, TAccessor, TSchemaContext, TDef>
    > &
      ColumnInputFor<
        TDef,
        ExcelTableColumnInputs<
          T,
          TId,
          TColumnId,
          TGroupId,
          TDynamicId,
          TBooleanColumnId,
          TSchemaContext,
          TDef,
          TAccessor,
          TTransformed,
          TDefault,
          TResult
        >
      >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId | BooleanColumnIdOf<TDef, TId>,
    WithColumnValue<
      TColumnValues,
      TId,
      ColumnValueOf<T, TDef, TAccessor, TTransformed, TDefault, TResult>
    >
  >;
  column(id: string, definition: object): unknown {
    this.ensureIdAvailable(id);
    this.addColumnNode(normalizeColumnDefinition(id, definition as any));
    return this;
  }

  override group<const TId extends string, TResult>(
    id: TId,
    build: (builder: this) => TResult,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | Exclude<ChildColumnIds<TResult>, TColumnId>,
    TGroupId | TId | Exclude<ChildGroupIds<TResult>, TGroupId>,
    TDynamicId | Exclude<ChildDynamicIds<TResult>, TDynamicId>,
    TSchemaContext,
    TBooleanColumnId | Exclude<ChildBooleanColumnIds<TResult>, TBooleanColumnId>,
    TColumnValues & ChildColumnValues<TResult>
  >;
  override group<const TId extends string>(
    id: TId,
    build: (builder: this) => void,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId,
    TGroupId | TId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  >;
  override group<const TId extends string, TResult>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => TResult,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | Exclude<ChildColumnIds<TResult>, TColumnId>,
    TGroupId | TId | Exclude<ChildGroupIds<TResult>, TGroupId>,
    TDynamicId | Exclude<ChildDynamicIds<TResult>, TDynamicId>,
    TSchemaContext,
    TBooleanColumnId | Exclude<ChildBooleanColumnIds<TResult>, TBooleanColumnId>,
    TColumnValues & ChildColumnValues<TResult>
  >;
  override group<const TId extends string>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => void,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId,
    TGroupId | TId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  >;
  override group<const TId extends string>(
    id: TId,
    optionsOrBuild: GroupOptions<TSchemaContext> | ((builder: this) => unknown),
    maybeBuild?: (builder: this) => unknown,
  ): any {
    this.groupImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as ExcelTableSchemaBuilder<
      T,
      TColumnId,
      TGroupId | TId,
      TDynamicId,
      TSchemaContext,
      TBooleanColumnId,
      TColumnValues
    >;
  }

  override dynamic<const TId extends string>(
    id: TId,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId,
    TGroupId,
    TDynamicId | TId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  >;
  override dynamic<const TId extends string>(
    id: TId,
    options: DynamicOptions<TSchemaContext>,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId,
    TGroupId,
    TDynamicId | TId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  >;
  override dynamic<const TId extends string>(
    id: TId,
    optionsOrBuild:
      | DynamicOptions<TSchemaContext>
      | ((builder: this, args: { ctx: TSchemaContext }) => void),
    maybeBuild?: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId,
    TGroupId,
    TDynamicId | TId,
    TSchemaContext,
    TBooleanColumnId,
    TColumnValues
  > {
    this.dynamicImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as ExcelTableSchemaBuilder<
      T,
      TColumnId,
      TGroupId,
      TDynamicId | TId,
      TSchemaContext,
      TBooleanColumnId,
      TColumnValues
    >;
  }
}

export type TypedPath<T extends object> = Path<T>;

type ChildColumnIds<TBuilder> =
  TBuilder extends BaseSchemaBuilder<any, infer TColumnId, any, any, any, any> ? TColumnId : never;

type ChildGroupIds<TBuilder> =
  TBuilder extends BaseSchemaBuilder<any, any, infer TGroupId, any, any, any> ? TGroupId : never;

type ChildDynamicIds<TBuilder> =
  TBuilder extends BaseSchemaBuilder<any, any, any, infer TDynamicId, any, any>
    ? TDynamicId
    : never;

type ChildColumnValues<TBuilder> =
  TBuilder extends BaseSchemaBuilder<any, any, any, any, any, any, infer TColumnValues>
    ? TColumnValues
    : EmptyColumnValues;

type ChildBooleanColumnIds<TBuilder> =
  TBuilder extends BaseSchemaBuilder<any, any, any, any, any, infer TBooleanColumnId>
    ? TBooleanColumnId
    : never;
