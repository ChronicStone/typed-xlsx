import type { Accessor, AccessorValue } from "../core/accessor";
import type { Path } from "../core/path";
import type { CellStyle } from "../styles/types";
import { normalizeSummaryInput } from "../summary/builder";
import type { SummaryInput } from "../summary/builder";
import type { FormulaFunctions, FormulaRowContext, FormulaValue } from "../formula/expr";

export type PrimitiveCellValue = string | number | boolean | Date | null | undefined;
export type CellValue = PrimitiveCellValue | PrimitiveCellValue[];

export type FormulaFn<TPrevColumnId extends string> = (context: {
  row: FormulaRowContext<TPrevColumnId>;
  fx: FormulaFunctions<TPrevColumnId>;
}) => FormulaValue<TPrevColumnId>;

export type TransformFn<T, TValue = unknown> = (
  value: TValue,
  row: T,
  rowIndex: number,
) => CellValue;

export type FormatFn<T> = (row: T, rowIndex: number, subRowIndex: number) => string | undefined;

export type StyleFn<T> = (row: T, rowIndex: number, subRowIndex: number) => CellStyle | undefined;

export type SchemaKind = "report" | "excel-table";

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
  | { label: string; function?: never }
  | { function: ExcelTableTotalsRowFunction; label?: never };

export interface ColumnDefinition<
  T extends object,
  TAccessor extends Accessor<T, unknown> | Path<T> = Accessor<T, unknown> | Path<T>,
  TPrevColumnId extends string = never,
> {
  id: string;
  header?: string;
  accessor?: TAccessor;
  defaultValue?: CellValue;
  transform?: TransformFn<T, AccessorValue<T, TAccessor>>;
  format?: string | FormatFn<T>;
  style?: CellStyle | StyleFn<T>;
  headerStyle?: CellStyle;
  width?: number;
  autoWidth?: boolean;
  minWidth?: number;
  maxWidth?: number;
  summary?: SummaryInput<T>;
  formula?: FormulaFn<TPrevColumnId>;
  totalsRow?: ExcelTableTotalsRowDefinition;
}

type ScalarTransformFn<T, TValue = unknown> = (
  value: TValue,
  row: T,
  rowIndex: number,
) => PrimitiveCellValue;

type AccessorColumnInput<
  T extends object,
  TAccessor extends Accessor<T, unknown> | Path<T>,
  TPrevColumnId extends string,
> = Omit<ColumnDefinition<T, TAccessor, TPrevColumnId>, "id"> & {
  accessor: TAccessor;
  formula?: never;
};

type FormulaColumnInput<T extends object, TPrevColumnId extends string> = Omit<
  ColumnDefinition<T, never, TPrevColumnId>,
  "id" | "accessor" | "transform"
> & {
  accessor?: never;
  transform?: never;
  formula: FormulaFn<TPrevColumnId>;
};

type ExcelTableAccessorColumnInput<
  T extends object,
  TAccessor extends Accessor<T, unknown> | Path<T>,
  TPrevColumnId extends string,
> = Omit<ColumnDefinition<T, TAccessor, TPrevColumnId>, "id" | "summary" | "defaultValue"> & {
  accessor: TAccessor;
  defaultValue?: PrimitiveCellValue;
  summary?: never;
  transform?: ScalarTransformFn<T, AccessorValue<T, TAccessor>>;
  formula?: never;
};

type ExcelTableFormulaColumnInput<T extends object, TPrevColumnId extends string> = Omit<
  ColumnDefinition<T, never, TPrevColumnId>,
  "id" | "accessor" | "transform" | "summary" | "defaultValue"
> & {
  accessor?: never;
  transform?: never;
  defaultValue?: never;
  summary?: never;
  formula: FormulaFn<TPrevColumnId>;
};

export interface ColumnGroupDefinition<
  T extends object,
  TId extends string = string,
  TContext = unknown,
> {
  id: TId;
  kind: "group";
  requiresContext: boolean;
  build: (builder: SchemaBuilder<T, any>, context: TContext) => void;
}

export type SchemaNode<T extends object> = ColumnDefinition<T> | ColumnGroupDefinition<T>;
export type SchemaContext = Record<string, unknown>;

export interface SchemaDefinition<
  T extends object,
  TColumnId extends string = string,
  TGroupId extends string = never,
  TGroupContext extends SchemaContext = SchemaContext,
  TKind extends SchemaKind = "report",
> {
  kind: TKind;
  columns: SchemaNode<T>[];
  readonly __columnIds?: TColumnId | undefined;
  readonly __groupIds?: TGroupId | undefined;
  readonly __groupContext?: TGroupContext | undefined;
  readonly __kind?: TKind | undefined;
}

export type ReportSchemaDefinition<
  T extends object,
  TColumnId extends string = string,
  TGroupId extends string = never,
  TGroupContext extends SchemaContext = SchemaContext,
> = SchemaDefinition<T, TColumnId, TGroupId, TGroupContext, "report">;

export type ExcelTableSchemaDefinition<
  T extends object,
  TColumnId extends string = string,
> = SchemaDefinition<T, TColumnId, never, {}, "excel-table">;

export type SchemaColumnId<TSchema> =
  TSchema extends SchemaDefinition<any, infer TColumnId, any, any> ? TColumnId : never;
export type SchemaGroupId<TSchema> =
  TSchema extends SchemaDefinition<any, any, infer TGroupId, any> ? TGroupId : never;
export type SchemaGroupContext<TSchema> =
  TSchema extends SchemaDefinition<any, any, any, infer TGroupContext, any> ? TGroupContext : never;
export type SchemaKindOf<TSchema> =
  TSchema extends SchemaDefinition<any, any, any, any, infer TKind> ? TKind : never;

export class SchemaBuilder<
  T extends object,
  TColumnId extends string = never,
  TGroupId extends string = never,
  TGroupContext extends SchemaContext = {},
> {
  private readonly columns: SchemaNode<T>[] = [];
  private readonly ids = new Set<string>();

  static create<T extends object>() {
    return new SchemaBuilder<T, never>();
  }

  column<TId extends string, TPath extends Path<T>>(
    id: TId,
    definition: AccessorColumnInput<T, TPath, TColumnId>,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TGroupContext>;
  column<TId extends string, TAccessor extends (row: T) => unknown>(
    id: TId,
    definition: AccessorColumnInput<T, TAccessor, TColumnId>,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TGroupContext>;
  column<TId extends string>(
    id: TId,
    definition: FormulaColumnInput<T, TColumnId>,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TGroupContext>;
  column<TId extends string, TAccessor extends Accessor<T, unknown> | Path<T>>(
    id: TId,
    definition: AccessorColumnInput<T, TAccessor, TColumnId> | FormulaColumnInput<T, TColumnId>,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TGroupContext> {
    if (this.ids.has(id)) {
      throw new Error(`Column with id '${id}' already exists.`);
    }

    this.ids.add(id);
    this.columns.push({
      id,
      ...definition,
      ...(definition.summary ? { summary: normalizeSummaryInput(definition.summary) } : {}),
    } as ColumnDefinition<T>);
    return this as unknown as SchemaBuilder<T, TColumnId | TId, TGroupId, TGroupContext>;
  }

  group<const TId extends string, TContext = undefined>(
    id: TId,
    build: (
      builder: SchemaBuilder<T>,
      ...context: [TContext] extends [undefined] ? [] : [context: TContext]
    ) => void,
  ): SchemaBuilder<
    T,
    TColumnId,
    TGroupId | TId,
    [TContext] extends [undefined] ? TGroupContext : TGroupContext & Record<TId, TContext>
  > {
    if (this.ids.has(id)) {
      throw new Error(`Column with id '${id}' already exists.`);
    }

    this.ids.add(id);
    this.columns.push({
      id,
      kind: "group",
      requiresContext: build.length > 1,
      build: build as unknown as ColumnGroupDefinition<T>["build"],
    });
    return this as unknown as SchemaBuilder<
      T,
      TColumnId,
      TGroupId | TId,
      [TContext] extends [undefined] ? TGroupContext : TGroupContext & Record<TId, TContext>
    >;
  }

  build(): SchemaDefinition<T, TColumnId, TGroupId, TGroupContext> {
    return {
      kind: "report",
      columns: [...this.columns],
    };
  }
}

export class ExcelTableSchemaBuilder<T extends object, TColumnId extends string = never> {
  private readonly columns: SchemaNode<T>[] = [];
  private readonly ids = new Set<string>();

  static create<T extends object>() {
    return new ExcelTableSchemaBuilder<T, never>();
  }

  column<TId extends string, TPath extends Path<T>>(
    id: TId,
    definition: AccessorValue<T, TPath> extends PrimitiveCellValue
      ? ExcelTableAccessorColumnInput<T, TPath, TColumnId>
      : never,
  ): ExcelTableSchemaBuilder<T, TColumnId | TId>;
  column<TId extends string, TAccessor extends (row: T) => PrimitiveCellValue>(
    id: TId,
    definition: ExcelTableAccessorColumnInput<T, TAccessor, TColumnId>,
  ): ExcelTableSchemaBuilder<T, TColumnId | TId>;
  column<TId extends string>(
    id: TId,
    definition: ExcelTableFormulaColumnInput<T, TColumnId>,
  ): ExcelTableSchemaBuilder<T, TColumnId | TId>;
  column<TId extends string, TAccessor extends Accessor<T, unknown> | Path<T>>(
    id: TId,
    definition:
      | ExcelTableAccessorColumnInput<T, TAccessor, TColumnId>
      | ExcelTableFormulaColumnInput<T, TColumnId>,
  ): ExcelTableSchemaBuilder<T, TColumnId | TId> {
    if (this.ids.has(id)) {
      throw new Error(`Column with id '${id}' already exists.`);
    }

    this.ids.add(id);
    this.columns.push({
      id,
      ...definition,
    } as ColumnDefinition<T>);
    return this as unknown as ExcelTableSchemaBuilder<T, TColumnId | TId>;
  }

  build(): ExcelTableSchemaDefinition<T, TColumnId> {
    return {
      kind: "excel-table",
      columns: [...this.columns],
    };
  }
}

export type TypedPath<T extends object> = Path<T>;
