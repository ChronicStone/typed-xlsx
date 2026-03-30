import type { Accessor, AccessorValue } from "../core/accessor";
import type { Path } from "../core/path";
import type { CellStyle } from "../styles/types";
import { normalizeSummaryInput } from "../summary/builder";
import type { SummaryInput } from "../summary/builder";

export type PrimitiveCellValue = string | number | boolean | Date | null | undefined;
export type CellValue = PrimitiveCellValue | PrimitiveCellValue[];

export type TransformFn<T, TValue = unknown> = (
  value: TValue,
  row: T,
  rowIndex: number,
) => CellValue;

export type FormatFn<T> = (row: T, rowIndex: number, subRowIndex: number) => string | undefined;

export type StyleFn<T> = (row: T, rowIndex: number, subRowIndex: number) => CellStyle | undefined;

export interface ColumnDefinition<
  T extends object,
  TAccessor extends Accessor<T, unknown> | Path<T> = Accessor<T, unknown> | Path<T>,
> {
  id: string;
  header?: string;
  accessor: TAccessor;
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
}

export interface ColumnGroupDefinition<
  T extends object,
  TId extends string = string,
  TContext = unknown,
> {
  id: TId;
  kind: "group";
  requiresContext: boolean;
  build: (builder: SchemaBuilder<T, string>, context: TContext) => void;
}

export type SchemaNode<T extends object> = ColumnDefinition<T> | ColumnGroupDefinition<T>;
export type SchemaContext = Record<string, unknown>;

export interface SchemaDefinition<
  T extends object,
  TColumnId extends string = string,
  TGroupId extends string = never,
  TGroupContext extends SchemaContext = SchemaContext,
> {
  columns: SchemaNode<T>[];
  readonly __columnIds?: TColumnId | undefined;
  readonly __groupIds?: TGroupId | undefined;
  readonly __groupContext?: TGroupContext | undefined;
}

export type SchemaColumnId<TSchema> =
  TSchema extends SchemaDefinition<any, infer TColumnId, any, any> ? TColumnId : never;
export type SchemaGroupId<TSchema> =
  TSchema extends SchemaDefinition<any, any, infer TGroupId, any> ? TGroupId : never;
export type SchemaGroupContext<TSchema> =
  TSchema extends SchemaDefinition<any, any, any, infer TGroupContext> ? TGroupContext : never;

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
    definition: Omit<ColumnDefinition<T, TPath>, "id" | "accessor"> & { accessor: TPath },
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TGroupContext>;
  column<TId extends string, TAccessor extends (row: T) => unknown>(
    id: TId,
    definition: Omit<ColumnDefinition<T, TAccessor>, "id">,
  ): SchemaBuilder<T, TColumnId | TId, TGroupId, TGroupContext>;
  column<TId extends string, TAccessor extends Accessor<T, unknown> | Path<T>>(
    id: TId,
    definition: Omit<ColumnDefinition<T, TAccessor>, "id">,
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
      build: build as ColumnGroupDefinition<T>["build"],
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
      columns: [...this.columns],
    };
  }
}

export type TypedPath<T extends object> = Path<T>;
