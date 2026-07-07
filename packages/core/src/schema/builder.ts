import {
  resolveAccessor,
  type Accessor,
  type AccessorContext,
  type AccessorValue,
} from "../core/accessor";
import type { Path } from "../core/path";
import {
  normalizeConditionalStyleInput,
  type ConditionalStyleInput,
  type ConditionalStyleRule,
} from "../styles/conditional-types";
import type { SpreadsheetTheme } from "../styles/theme";
import type { CellStyle } from "../styles/types";
import { withCellControl } from "../styles/internal";
import { deepMerge } from "../styles/merge";
import { resolveLazyText, type LazyText } from "../text";
import {
  normalizeValidationInput,
  type ResolvedValidationRule,
  type ValidationInput,
} from "../validation/types";
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

export interface HyperlinkDefinition {
  target: string;
  tooltip?: LazyText;
  style?: CellStyle;
}

export type HyperlinkInput<T extends object, TContext extends SchemaContext = SchemaContext> =
  | string
  | HyperlinkDefinition
  | null
  | ((
      context: BoundRowHyperlinkContext<T, TContext>,
    ) => string | HyperlinkDefinition | null | undefined);

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

export type ExcelTableTotalsRowDefinition =
  | { label: LazyText; function?: never }
  | { function: ExcelTableTotalsRowFunction; label?: never };

export type ResolvedExcelTableTotalsRowDefinition =
  | { label: string; function?: never }
  | { function: ExcelTableTotalsRowFunction; label?: never };

export interface BaseSchemaNodeDefinition<
  _T extends object,
  TContext extends SchemaContext = SchemaContext,
> {
  id: string;
  header?: LazyText;
  condition?: StructureConditionDefinition<TContext>;
}

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
  validation?: ValidationInput<TReference, TGroupId | TDynamicId>;
  sparkline?: SparklineInput<TPrevColumnId, TGroupId, TDynamicId>;
  headerStyle?: CellStyle;
  width?: number;
  autoWidth?: boolean;
  minWidth?: number;
  maxWidth?: number;
  summary?: SummaryInput<T>;
  formula?: FormulaFn<TPrevColumnId, TGroupId, TDynamicId, TContext>;
  expansion?: ColumnExpansion;
  totalsRow?: ExcelTableTotalsRowDefinition;
}

type ScalarTransformFn<
  T extends object,
  TValue = unknown,
  TContext extends SchemaContext = SchemaContext,
> = (context: RowTransformContext<T, TValue, TContext>) => PrimitiveCellValue;

type AccessorColumnInput<
  T extends object,
  TAccessor extends Accessor<T, unknown, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
> = Omit<
  ColumnDefinition<T, TContext, TAccessor, TPrevColumnId, TGroupId, TDynamicId, TReference>,
  "id" | "image" | "sparkline" | "type"
> & {
  accessor: TAccessor;
  formula?: never;
};

type FormulaColumnInput<
  T extends object,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TBooleanColumnId extends TPrevColumnId,
  TContext extends SchemaContext,
> = Omit<
  ColumnDefinition<T, TContext, never, TPrevColumnId, TGroupId, TDynamicId, TReference>,
  "id" | "accessor" | "image" | "sparkline" | "transform" | "type"
> & {
  accessor?: never;
  transform?: never;
  formula: FormulaFn<TPrevColumnId, TGroupId, TDynamicId, TContext, TBooleanColumnId>;
};

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

type BadgeRendererColumnInput<
  T extends object,
  TAccessor extends Accessor<T, BadgeSourceValue, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
> = Omit<
  AccessorColumnInput<T, TAccessor, TReference, TPrevColumnId, TGroupId, TDynamicId, TContext>,
  "type" | "transform"
> &
  BadgeColumnDefinition<AccessorValue<T, TAccessor>, T, TContext> & {
    type: "badge";
    transform?: never;
  };

type CheckboxRendererColumnInput<
  T extends object,
  TAccessor extends Accessor<T, CheckboxSourceValue, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
> = Omit<
  AccessorColumnInput<T, TAccessor, TReference, TPrevColumnId, TGroupId, TDynamicId, TContext>,
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
> = Omit<
  ColumnDefinition<T, TContext, TAccessor, TPrevColumnId, TGroupId, TDynamicId, TReference>,
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
  accessor: TAccessor;
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
> = BaseImageColumnInput<
  T,
  TAccessor,
  TReference,
  TPrevColumnId,
  TGroupId,
  TDynamicId,
  TContext
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
> = BaseImageColumnInput<
  T,
  TAccessor,
  TReference,
  TPrevColumnId,
  TGroupId,
  TDynamicId,
  TContext
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
> =
  | EmbeddedImageColumnInput<T, any, TReference, TPrevColumnId, TGroupId, TDynamicId, TContext>
  | UrlImageColumnInput<T, any, TReference, TPrevColumnId, TGroupId, TDynamicId, TContext>;

type HyperlinkRendererColumnInput<
  T extends object,
  TAccessor extends Accessor<T, unknown, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
> = Omit<
  AccessorColumnInput<T, TAccessor, TReference, TPrevColumnId, TGroupId, TDynamicId, TContext>,
  "hyperlink" | "type"
> & {
  type: "hyperlink";
  target: HyperlinkInput<T, TContext>;
  tooltip?: LazyText;
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
> = Omit<
  ColumnDefinition<T, TContext, TAccessor, TPrevColumnId, TGroupId, TDynamicId, TReference>,
  "id" | "image" | "summary" | "defaultValue" | "sparkline" | "type"
> & {
  accessor: TAccessor;
  defaultValue?: PrimitiveCellValue;
  summary?: never;
  transform?: ScalarTransformFn<T, AccessorValue<T, TAccessor>, TContext>;
  formula?: never;
};

type ExcelTableFormulaColumnInput<
  T extends object,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TBooleanColumnId extends TPrevColumnId,
  TContext extends SchemaContext,
> = Omit<
  ColumnDefinition<T, TContext, never, TPrevColumnId, TGroupId, TDynamicId, TReference>,
  "id" | "accessor" | "image" | "transform" | "summary" | "defaultValue" | "sparkline" | "type"
> & {
  accessor?: never;
  transform?: never;
  defaultValue?: never;
  summary?: never;
  formula: FormulaFn<TPrevColumnId, TGroupId, TDynamicId, TContext, TBooleanColumnId>;
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

type ExcelTableBadgeRendererColumnInput<
  T extends object,
  TAccessor extends Accessor<T, BadgeSourceValue, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
> = Omit<
  ExcelTableAccessorColumnInput<
    T,
    TAccessor,
    TReference,
    TPrevColumnId,
    TGroupId,
    TDynamicId,
    TContext
  >,
  "transform" | "type"
> &
  BadgeColumnDefinition<AccessorValue<T, TAccessor>, T, TContext> & {
    type: "badge";
    transform?: never;
  };

type ExcelTableCheckboxRendererColumnInput<
  T extends object,
  TAccessor extends Accessor<T, CheckboxSourceValue, TContext> | Path<T>,
  TReference extends string,
  TPrevColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
  TContext extends SchemaContext,
> = Omit<
  ExcelTableAccessorColumnInput<
    T,
    TAccessor,
    TReference,
    TPrevColumnId,
    TGroupId,
    TDynamicId,
    TContext
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
> = Omit<
  ImageColumnInput<T, TAccessor, TReference, TPrevColumnId, TGroupId, TDynamicId, TContext>,
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
> = Omit<
  ExcelTableAccessorColumnInput<
    T,
    TAccessor,
    TReference,
    TPrevColumnId,
    TGroupId,
    TDynamicId,
    TContext
  >,
  "hyperlink" | "type"
> & {
  type: "hyperlink";
  target: HyperlinkInput<T, TContext>;
  tooltip?: LazyText;
  linkStyle?: CellStyle;
  hyperlink?: never;
};

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
> {
  kind: TKind;
  columns: SchemaNode<T, TSchemaContext>[];
  theme?: SpreadsheetTheme;
  readonly __columnIds?: TColumnId | undefined;
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
> = SchemaDefinition<T, TColumnId, TGroupId, TDynamicId, TSchemaContext, "report">;

export type ExcelTableSchemaDefinition<
  T extends object,
  TColumnId extends string = string,
  TGroupId extends string = never,
  TDynamicId extends string = never,
  TSchemaContext extends SchemaContext = SchemaContext,
> = SchemaDefinition<T, TColumnId, TGroupId, TDynamicId, TSchemaContext, "excel-table">;

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
export type SchemaKindOf<TSchema> =
  TSchema extends SchemaDefinition<any, any, any, any, any, infer TKind> ? TKind : never;

interface GroupOptions<TContext extends SchemaContext> {
  header?: LazyText;
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
    ...(normalizedDefinition.header
      ? { header: resolveLazyText(normalizedDefinition.header) }
      : {}),
    ...(normalizedDefinition.totalsRow && "label" in normalizedDefinition.totalsRow
      ? {
          totalsRow: {
            label: resolveLazyText(normalizedDefinition.totalsRow.label),
          },
        }
      : {}),
    ...(normalizedDefinition.summary
      ? { summary: normalizeSummaryInput(normalizedDefinition.summary) }
      : {}),
    ...(normalizedDefinition.conditionalStyle
      ? {
          conditionalStyle: normalizeConditionalStyleInput(
            normalizedDefinition.conditionalStyle,
          ) as ConditionalStyleRule<string, string>[],
        }
      : {}),
    ...(normalizedDefinition.validation
      ? {
          validation: normalizeValidationInput(
            normalizedDefinition.validation,
          ) as ResolvedValidationRule<string, string>,
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
      tooltip?: LazyText;
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
  tooltip?: LazyText,
  linkStyle?: CellStyle,
): HyperlinkInput<T, TContext> {
  const resolvedTooltip = resolveLazyText(tooltip);
  if (!resolvedTooltip && !linkStyle) {
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
        tooltip: resolvedTooltip,
        style: linkStyle,
      };
    }

    return {
      ...resolved,
      tooltip: resolved.tooltip ?? resolvedTooltip,
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
    ...(options?.header ? { header: resolveLazyText(options.header) } : {}),
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
> {
  protected readonly columns: SchemaNode<T, TSchemaContext>[] = [];
  protected readonly ids = new Set<string>();
  protected currentTheme?: SpreadsheetTheme;

  protected abstract createChildBuilder(): this;
  protected abstract buildSchema(
    kind: SchemaKind,
  ): SchemaDefinition<T, TColumnId, TGroupId, TDynamicId, TSchemaContext, any>;
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
    TBooleanColumnId | Exclude<ChildBooleanColumnIds<TResult>, TBooleanColumnId>
  >;
  group<const TId extends string>(
    id: TId,
    build: (builder: this) => void,
  ): BaseSchemaBuilder<T, TColumnId, TGroupId | TId, TDynamicId, TSchemaContext, TBooleanColumnId>;
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
    TBooleanColumnId | Exclude<ChildBooleanColumnIds<TResult>, TBooleanColumnId>
  >;
  group<const TId extends string>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => void,
  ): BaseSchemaBuilder<T, TColumnId, TGroupId | TId, TDynamicId, TSchemaContext, TBooleanColumnId>;
  group<const TId extends string>(
    id: TId,
    optionsOrBuild: GroupOptions<TSchemaContext> | ((builder: this) => unknown),
    maybeBuild?: (builder: this) => unknown,
  ): BaseSchemaBuilder<T, TColumnId, TGroupId | TId, TDynamicId, TSchemaContext, TBooleanColumnId> {
    this.groupImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as BaseSchemaBuilder<
      T,
      TColumnId,
      TGroupId | TId,
      TDynamicId,
      TSchemaContext,
      TBooleanColumnId
    >;
  }

  dynamic<const TId extends string>(
    id: TId,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): BaseSchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext, TBooleanColumnId>;
  dynamic<const TId extends string>(
    id: TId,
    options: DynamicOptions<TSchemaContext>,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): BaseSchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext, TBooleanColumnId>;
  dynamic<const TId extends string>(
    id: TId,
    optionsOrBuild:
      | DynamicOptions<TSchemaContext>
      | ((builder: this, args: { ctx: TSchemaContext }) => void),
    maybeBuild?: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): BaseSchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext, TBooleanColumnId> {
    this.dynamicImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as BaseSchemaBuilder<
      T,
      TColumnId,
      TGroupId,
      TDynamicId | TId,
      TSchemaContext,
      TBooleanColumnId
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
> extends BaseSchemaBuilder<T, TColumnId, TGroupId, TDynamicId, TSchemaContext, TBooleanColumnId> {
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
      TBooleanColumnId
    >() as this;
  }

  protected buildSchema() {
    return {
      kind: "report" as const,
      columns: [...this.columns],
      theme: this.currentTheme,
    } satisfies ReportSchemaDefinition<T, TColumnId, TGroupId, TDynamicId, TSchemaContext>;
  }

  column<TId extends string, TPath extends Path<T>>(
    id: TId,
    definition: AccessorColumnInput<
      T,
      TPath,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext, TBooleanColumnId>;
  column<TId extends string, TAccessor extends Accessor<T, unknown, TSchemaContext>>(
    id: TId,
    definition: AccessorColumnInput<
      T,
      TAccessor,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext, TBooleanColumnId>;
  column<TId extends string>(
    id: TId,
    definition: FormulaColumnInput<
      T,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TBooleanColumnId,
      TSchemaContext
    >,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext, TBooleanColumnId>;
  column<TId extends string>(
    id: TId,
    definition: SparklineRendererColumnInput<T, TColumnId, TGroupId, TDynamicId, TSchemaContext>,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext, TBooleanColumnId>;
  column<TId extends string, TPath extends Path<T>>(
    id: TId,
    definition: BadgeRendererColumnInput<
      T,
      TPath,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext, TBooleanColumnId>;
  column<TId extends string, TAccessor extends Accessor<T, BadgeSourceValue, TSchemaContext>>(
    id: TId,
    definition: BadgeRendererColumnInput<
      T,
      TAccessor,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext, TBooleanColumnId>;
  column<TId extends string, TPath extends Path<T>>(
    id: TId,
    definition: CheckboxRendererColumnInput<
      T,
      TPath,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): SchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId | TId
  >;
  column<TId extends string, TAccessor extends Accessor<T, CheckboxSourceValue, TSchemaContext>>(
    id: TId,
    definition: CheckboxRendererColumnInput<
      T,
      TAccessor,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): SchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId | TId
  >;
  column<TId extends string, TPath extends Path<T>>(
    id: TId,
    definition: ImageColumnInput<
      T,
      TPath,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext, TBooleanColumnId>;
  column<TId extends string, TAccessor extends Accessor<T, ImageSourceValue, TSchemaContext>>(
    id: TId,
    definition: ImageColumnInput<
      T,
      TAccessor,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext, TBooleanColumnId>;
  column<TId extends string, TAccessor extends Accessor<T, ImageUrlSourceValue, TSchemaContext>>(
    id: TId,
    definition: ImageColumnInput<
      T,
      TAccessor,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext, TBooleanColumnId>;
  column<TId extends string, TPath extends Path<T>>(
    id: TId,
    definition: HyperlinkRendererColumnInput<
      T,
      TPath,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext, TBooleanColumnId>;
  column<TId extends string, TAccessor extends Accessor<T, unknown, TSchemaContext>>(
    id: TId,
    definition: HyperlinkRendererColumnInput<
      T,
      TAccessor,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext, TBooleanColumnId>;
  column<TId extends string, TAccessor extends Accessor<T, unknown, TSchemaContext> | Path<T>>(
    id: TId,
    definition:
      | AccessorColumnInput<T, TAccessor, string, TColumnId, TGroupId, TDynamicId, TSchemaContext>
      | FormulaColumnInput<
          T,
          string,
          TColumnId,
          TGroupId,
          TDynamicId,
          TBooleanColumnId,
          TSchemaContext
        >
      | SparklineRendererColumnInput<T, TColumnId, TGroupId, TDynamicId, TSchemaContext>
      | BadgeRendererColumnInput<T, any, string, TColumnId, TGroupId, TDynamicId, TSchemaContext>
      | CheckboxRendererColumnInput<T, any, string, TColumnId, TGroupId, TDynamicId, TSchemaContext>
      | ImageColumnInput<T, any, string, TColumnId, TGroupId, TDynamicId, TSchemaContext>
      | HyperlinkRendererColumnInput<
          T,
          any,
          string,
          TColumnId,
          TGroupId,
          TDynamicId,
          TSchemaContext
        >,
  ): SchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId | TId
  > {
    this.ensureIdAvailable(id);
    this.addColumnNode(normalizeColumnDefinition(id, definition as any));
    return this as unknown as SchemaBuilder<
      T,
      TColumnId | TId,
      TGroupId,
      TDynamicId,
      TSchemaContext,
      TBooleanColumnId | TId
    >;
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
    TBooleanColumnId | Exclude<ChildBooleanColumnIds<TResult>, TBooleanColumnId>
  >;
  override group<const TId extends string>(
    id: TId,
    build: (builder: this) => void,
  ): SchemaBuilder<T, TColumnId, TGroupId | TId, TDynamicId, TSchemaContext, TBooleanColumnId>;
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
    TBooleanColumnId | Exclude<ChildBooleanColumnIds<TResult>, TBooleanColumnId>
  >;
  override group<const TId extends string>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => void,
  ): SchemaBuilder<T, TColumnId, TGroupId | TId, TDynamicId, TSchemaContext, TBooleanColumnId>;
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
      TBooleanColumnId
    >;
  }

  override dynamic<const TId extends string>(
    id: TId,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): SchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext, TBooleanColumnId>;
  override dynamic<const TId extends string>(
    id: TId,
    options: DynamicOptions<TSchemaContext>,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): SchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext, TBooleanColumnId>;
  override dynamic<const TId extends string>(
    id: TId,
    optionsOrBuild:
      | DynamicOptions<TSchemaContext>
      | ((builder: this, args: { ctx: TSchemaContext }) => void),
    maybeBuild?: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): SchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext, TBooleanColumnId> {
    this.dynamicImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as SchemaBuilder<
      T,
      TColumnId,
      TGroupId,
      TDynamicId | TId,
      TSchemaContext,
      TBooleanColumnId
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
> extends BaseSchemaBuilder<T, TColumnId, TGroupId, TDynamicId, TSchemaContext, TBooleanColumnId> {
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
      TBooleanColumnId
    >() as this;
  }

  protected buildSchema() {
    return {
      kind: "excel-table" as const,
      columns: [...this.columns],
      theme: this.currentTheme,
    } satisfies ExcelTableSchemaDefinition<T, TColumnId, TGroupId, TDynamicId, TSchemaContext>;
  }

  column<TId extends string, TPath extends Path<T>>(
    id: TId,
    definition: AccessorValue<T, TPath> extends PrimitiveCellValue
      ? ExcelTableAccessorColumnInput<
          T,
          TPath,
          FormulaLikeReference<TId, TColumnId>,
          TColumnId,
          TGroupId,
          TDynamicId,
          TSchemaContext
        >
      : never,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId
  >;
  column<TId extends string, TAccessor extends Accessor<T, BadgeSourceValue, TSchemaContext>>(
    id: TId,
    definition: ExcelTableAccessorColumnInput<
      T,
      TAccessor,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId
  >;
  column<TId extends string>(
    id: TId,
    definition: ExcelTableFormulaColumnInput<
      T,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TBooleanColumnId,
      TSchemaContext
    >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId
  >;
  column<TId extends string>(
    id: TId,
    definition: ExcelTableSparklineRendererColumnInput<
      T,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId
  >;
  column<TId extends string, TPath extends Path<T>>(
    id: TId,
    definition: ExcelTableBadgeRendererColumnInput<
      T,
      TPath,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId
  >;
  column<TId extends string, TAccessor extends Accessor<T, PrimitiveCellValue, TSchemaContext>>(
    id: TId,
    definition: ExcelTableBadgeRendererColumnInput<
      T,
      TAccessor,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId
  >;
  column<TId extends string, TPath extends Path<T>>(
    id: TId,
    definition: ExcelTableCheckboxRendererColumnInput<
      T,
      TPath,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId | TId
  >;
  column<TId extends string, TAccessor extends Accessor<T, CheckboxSourceValue, TSchemaContext>>(
    id: TId,
    definition: ExcelTableCheckboxRendererColumnInput<
      T,
      TAccessor,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId | TId
  >;
  column<TId extends string, TPath extends Path<T>>(
    id: TId,
    definition: ExcelTableImageColumnInput<
      T,
      TPath,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId
  >;
  column<TId extends string, TAccessor extends Accessor<T, ImageSourceValue, TSchemaContext>>(
    id: TId,
    definition: ExcelTableImageColumnInput<
      T,
      TAccessor,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId
  >;
  column<TId extends string, TAccessor extends Accessor<T, ImageUrlSourceValue, TSchemaContext>>(
    id: TId,
    definition: ExcelTableImageColumnInput<
      T,
      TAccessor,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId
  >;
  column<TId extends string, TPath extends Path<T>>(
    id: TId,
    definition: ExcelTableHyperlinkRendererColumnInput<
      T,
      TPath,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId
  >;
  column<TId extends string, TAccessor extends Accessor<T, PrimitiveCellValue, TSchemaContext>>(
    id: TId,
    definition: ExcelTableHyperlinkRendererColumnInput<
      T,
      TAccessor,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId
  >;
  column<TId extends string, TAccessor extends Accessor<T, unknown, TSchemaContext> | Path<T>>(
    id: TId,
    definition:
      | ExcelTableAccessorColumnInput<
          T,
          TAccessor,
          string,
          TColumnId,
          TGroupId,
          TDynamicId,
          TSchemaContext
        >
      | ExcelTableFormulaColumnInput<
          T,
          string,
          TColumnId,
          TGroupId,
          TDynamicId,
          TBooleanColumnId,
          TSchemaContext
        >
      | ExcelTableSparklineRendererColumnInput<T, TColumnId, TGroupId, TDynamicId, TSchemaContext>
      | ExcelTableBadgeRendererColumnInput<
          T,
          any,
          string,
          TColumnId,
          TGroupId,
          TDynamicId,
          TSchemaContext
        >
      | ExcelTableCheckboxRendererColumnInput<
          T,
          any,
          string,
          TColumnId,
          TGroupId,
          TDynamicId,
          TSchemaContext
        >
      | ExcelTableImageColumnInput<T, any, string, TColumnId, TGroupId, TDynamicId, TSchemaContext>
      | ExcelTableHyperlinkRendererColumnInput<
          T,
          any,
          string,
          TColumnId,
          TGroupId,
          TDynamicId,
          TSchemaContext
        >,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | TId,
    TGroupId,
    TDynamicId,
    TSchemaContext,
    TBooleanColumnId | TId
  > {
    this.ensureIdAvailable(id);
    this.addColumnNode(normalizeColumnDefinition(id, definition as any));
    return this as unknown as ExcelTableSchemaBuilder<
      T,
      TColumnId | TId,
      TGroupId,
      TDynamicId,
      TSchemaContext,
      TBooleanColumnId | TId
    >;
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
    TBooleanColumnId | Exclude<ChildBooleanColumnIds<TResult>, TBooleanColumnId>
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
    TBooleanColumnId
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
    TBooleanColumnId | Exclude<ChildBooleanColumnIds<TResult>, TBooleanColumnId>
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
    TBooleanColumnId
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
      TBooleanColumnId
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
    TBooleanColumnId
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
    TBooleanColumnId
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
    TBooleanColumnId
  > {
    this.dynamicImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as ExcelTableSchemaBuilder<
      T,
      TColumnId,
      TGroupId,
      TDynamicId | TId,
      TSchemaContext,
      TBooleanColumnId
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

type ChildBooleanColumnIds<TBuilder> =
  TBuilder extends BaseSchemaBuilder<any, any, any, any, any, infer TBooleanColumnId>
    ? TBooleanColumnId
    : never;
