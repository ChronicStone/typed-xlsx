import type { Accessor, AccessorContext, AccessorValue } from "../core/accessor";
import type { Path } from "../core/path";
import {
  normalizeConditionalStyleInput,
  type ConditionalStyleInput,
  type ConditionalStyleRule,
} from "../styles/conditional-types";
import type { SpreadsheetTheme } from "../styles/theme";
import type { CellStyle } from "../styles/types";
import { resolveLazyText, type LazyText } from "../text";
import {
  normalizeValidationInput,
  type ResolvedValidationRule,
  type ValidationInput,
} from "../validation/types";
import { normalizeSummaryInput } from "../summary/builder";
import type { SummaryInput } from "../summary/builder";
import type {
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

export type FormulaFn<
  TPrevColumnId extends string,
  TGroupId extends string = never,
  TDynamicId extends string = never,
  TContext extends SchemaContext = SchemaContext,
> = (context: {
  row: FormulaRowContext<TPrevColumnId, TGroupId | TDynamicId>;
  refs: FormulaRefs<TPrevColumnId, TGroupId, TDynamicId>;
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
  tooltip?: string;
  style?: CellStyle;
}

export type HyperlinkInput<T extends object, TContext extends SchemaContext = SchemaContext> =
  | string
  | HyperlinkDefinition
  | null
  | ((
      context: BoundRowHyperlinkContext<T, TContext>,
    ) => string | HyperlinkDefinition | null | undefined);

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
  accessor?: TAccessor;
  defaultValue?: CellValue;
  transform?: TransformFn<T, AccessorValue<T, TAccessor>, TContext>;
  format?: string | FormatFn<T, TContext>;
  style?: CellStyle | StyleFn<T, TContext>;
  hyperlink?: HyperlinkInput<T, TContext>;
  conditionalStyle?: ConditionalStyleInput<TReference, TGroupId | TDynamicId>;
  validation?: ValidationInput<TReference, TGroupId | TDynamicId>;
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
  "id"
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
  TContext extends SchemaContext,
> = Omit<
  ColumnDefinition<T, TContext, never, TPrevColumnId, TGroupId, TDynamicId, TReference>,
  "id" | "accessor" | "transform"
> & {
  accessor?: never;
  transform?: never;
  formula: FormulaFn<TPrevColumnId, TGroupId, TDynamicId, TContext>;
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
  "id" | "summary" | "defaultValue"
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
  TContext extends SchemaContext,
> = Omit<
  ColumnDefinition<T, TContext, never, TPrevColumnId, TGroupId, TDynamicId, TReference>,
  "id" | "accessor" | "transform" | "summary" | "defaultValue"
> & {
  accessor?: never;
  transform?: never;
  defaultValue?: never;
  summary?: never;
  formula: FormulaFn<TPrevColumnId, TGroupId, TDynamicId, TContext>;
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

function normalizeColumnDefinition<T extends object, TContext extends SchemaContext>(
  id: string,
  definition: ColumnDefinition<T, TContext, any, any, any, any, any>,
) {
  return {
    kind: "column" as const,
    ...definition,
    id,
    ...(definition.header ? { header: resolveLazyText(definition.header) } : {}),
    ...(definition.totalsRow && "label" in definition.totalsRow
      ? {
          totalsRow: {
            label: resolveLazyText(definition.totalsRow.label),
          },
        }
      : {}),
    ...(definition.summary ? { summary: normalizeSummaryInput(definition.summary) } : {}),
    ...(definition.conditionalStyle
      ? {
          conditionalStyle: normalizeConditionalStyleInput(
            definition.conditionalStyle,
          ) as ConditionalStyleRule<string, string>[],
        }
      : {}),
    ...(definition.validation
      ? {
          validation: normalizeValidationInput(definition.validation) as ResolvedValidationRule<
            string,
            string
          >,
        }
      : {}),
  } as ColumnDefinition<T, TContext, any, any, any, any, any>;
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
    TSchemaContext
  >;
  group<const TId extends string>(
    id: TId,
    build: (builder: this) => void,
  ): BaseSchemaBuilder<T, TColumnId, TGroupId | TId, TDynamicId, TSchemaContext>;
  group<const TId extends string, TResult>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => TResult,
  ): BaseSchemaBuilder<
    T,
    TColumnId | Exclude<ChildColumnIds<TResult>, TColumnId>,
    TGroupId | TId | Exclude<ChildGroupIds<TResult>, TGroupId>,
    TDynamicId | Exclude<ChildDynamicIds<TResult>, TDynamicId>,
    TSchemaContext
  >;
  group<const TId extends string>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => void,
  ): BaseSchemaBuilder<T, TColumnId, TGroupId | TId, TDynamicId, TSchemaContext>;
  group<const TId extends string>(
    id: TId,
    optionsOrBuild: GroupOptions<TSchemaContext> | ((builder: this) => unknown),
    maybeBuild?: (builder: this) => unknown,
  ): BaseSchemaBuilder<T, TColumnId, TGroupId | TId, TDynamicId, TSchemaContext> {
    this.groupImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as BaseSchemaBuilder<
      T,
      TColumnId,
      TGroupId | TId,
      TDynamicId,
      TSchemaContext
    >;
  }

  dynamic<const TId extends string>(
    id: TId,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): BaseSchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext>;
  dynamic<const TId extends string>(
    id: TId,
    options: DynamicOptions<TSchemaContext>,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): BaseSchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext>;
  dynamic<const TId extends string>(
    id: TId,
    optionsOrBuild:
      | DynamicOptions<TSchemaContext>
      | ((builder: this, args: { ctx: TSchemaContext }) => void),
    maybeBuild?: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): BaseSchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext> {
    this.dynamicImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as BaseSchemaBuilder<
      T,
      TColumnId,
      TGroupId,
      TDynamicId | TId,
      TSchemaContext
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
> extends BaseSchemaBuilder<T, TColumnId, TGroupId, TDynamicId, TSchemaContext> {
  protected readonly schemaKind = "report" as const;

  static create<T extends object, TContext extends SchemaContext = unknown>() {
    return new SchemaBuilder<T, never, never, never, TContext>();
  }

  protected createChildBuilder(): this {
    return new SchemaBuilder<T, TColumnId, TGroupId, TDynamicId, TSchemaContext>() as this;
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
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext>;
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
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext>;
  column<TId extends string>(
    id: TId,
    definition: FormulaColumnInput<
      T,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext>;
  column<TId extends string, TAccessor extends Accessor<T, unknown, TSchemaContext> | Path<T>>(
    id: TId,
    definition:
      | AccessorColumnInput<T, TAccessor, string, TColumnId, TGroupId, TDynamicId, TSchemaContext>
      | FormulaColumnInput<T, string, TColumnId, TGroupId, TDynamicId, TSchemaContext>,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext> {
    this.ensureIdAvailable(id);
    this.addColumnNode(normalizeColumnDefinition(id, definition as any));
    return this as unknown as SchemaBuilder<
      T,
      TColumnId | TId,
      TGroupId,
      TDynamicId,
      TSchemaContext
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
    TSchemaContext
  >;
  override group<const TId extends string>(
    id: TId,
    build: (builder: this) => void,
  ): SchemaBuilder<T, TColumnId, TGroupId | TId, TDynamicId, TSchemaContext>;
  override group<const TId extends string, TResult>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => TResult,
  ): SchemaBuilder<
    T,
    TColumnId | Exclude<ChildColumnIds<TResult>, TColumnId>,
    TGroupId | TId | Exclude<ChildGroupIds<TResult>, TGroupId>,
    TDynamicId | Exclude<ChildDynamicIds<TResult>, TDynamicId>,
    TSchemaContext
  >;
  override group<const TId extends string>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => void,
  ): SchemaBuilder<T, TColumnId, TGroupId | TId, TDynamicId, TSchemaContext>;
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
      TSchemaContext
    >;
  }

  override dynamic<const TId extends string>(
    id: TId,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): SchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext>;
  override dynamic<const TId extends string>(
    id: TId,
    options: DynamicOptions<TSchemaContext>,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): SchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext>;
  override dynamic<const TId extends string>(
    id: TId,
    optionsOrBuild:
      | DynamicOptions<TSchemaContext>
      | ((builder: this, args: { ctx: TSchemaContext }) => void),
    maybeBuild?: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): SchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext> {
    this.dynamicImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as SchemaBuilder<
      T,
      TColumnId,
      TGroupId,
      TDynamicId | TId,
      TSchemaContext
    >;
  }
}

export class ExcelTableSchemaBuilder<
  T extends object,
  TColumnId extends string = never,
  TGroupId extends string = never,
  TDynamicId extends string = never,
  TSchemaContext extends SchemaContext = unknown,
> extends BaseSchemaBuilder<T, TColumnId, TGroupId, TDynamicId, TSchemaContext> {
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
      TSchemaContext
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
  ): ExcelTableSchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext>;
  column<TId extends string, TAccessor extends Accessor<T, PrimitiveCellValue, TSchemaContext>>(
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
  ): ExcelTableSchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext>;
  column<TId extends string>(
    id: TId,
    definition: ExcelTableFormulaColumnInput<
      T,
      FormulaLikeReference<TId, TColumnId>,
      TColumnId,
      TGroupId,
      TDynamicId,
      TSchemaContext
    >,
  ): ExcelTableSchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext>;
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
      | ExcelTableFormulaColumnInput<T, string, TColumnId, TGroupId, TDynamicId, TSchemaContext>,
  ): ExcelTableSchemaBuilder<T, TColumnId | TId, TGroupId, TDynamicId, TSchemaContext> {
    this.ensureIdAvailable(id);
    this.addColumnNode(normalizeColumnDefinition(id, definition as any));
    return this as unknown as ExcelTableSchemaBuilder<
      T,
      TColumnId | TId,
      TGroupId,
      TDynamicId,
      TSchemaContext
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
    TSchemaContext
  >;
  override group<const TId extends string>(
    id: TId,
    build: (builder: this) => void,
  ): ExcelTableSchemaBuilder<T, TColumnId, TGroupId | TId, TDynamicId, TSchemaContext>;
  override group<const TId extends string, TResult>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => TResult,
  ): ExcelTableSchemaBuilder<
    T,
    TColumnId | Exclude<ChildColumnIds<TResult>, TColumnId>,
    TGroupId | TId | Exclude<ChildGroupIds<TResult>, TGroupId>,
    TDynamicId | Exclude<ChildDynamicIds<TResult>, TDynamicId>,
    TSchemaContext
  >;
  override group<const TId extends string>(
    id: TId,
    options: GroupOptions<TSchemaContext>,
    build: (builder: this) => void,
  ): ExcelTableSchemaBuilder<T, TColumnId, TGroupId | TId, TDynamicId, TSchemaContext>;
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
      TSchemaContext
    >;
  }

  override dynamic<const TId extends string>(
    id: TId,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): ExcelTableSchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext>;
  override dynamic<const TId extends string>(
    id: TId,
    options: DynamicOptions<TSchemaContext>,
    build: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): ExcelTableSchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext>;
  override dynamic<const TId extends string>(
    id: TId,
    optionsOrBuild:
      | DynamicOptions<TSchemaContext>
      | ((builder: this, args: { ctx: TSchemaContext }) => void),
    maybeBuild?: (builder: this, args: { ctx: TSchemaContext }) => void,
  ): ExcelTableSchemaBuilder<T, TColumnId, TGroupId, TDynamicId | TId, TSchemaContext> {
    this.dynamicImpl(id, optionsOrBuild, maybeBuild);
    return this as unknown as ExcelTableSchemaBuilder<
      T,
      TColumnId,
      TGroupId,
      TDynamicId | TId,
      TSchemaContext
    >;
  }
}

export type TypedPath<T extends object> = Path<T>;

type ChildColumnIds<TBuilder> =
  TBuilder extends BaseSchemaBuilder<any, infer TColumnId, any, any, any> ? TColumnId : never;

type ChildGroupIds<TBuilder> =
  TBuilder extends BaseSchemaBuilder<any, any, infer TGroupId, any, any> ? TGroupId : never;

type ChildDynamicIds<TBuilder> =
  TBuilder extends BaseSchemaBuilder<any, any, any, infer TDynamicId, any> ? TDynamicId : never;
