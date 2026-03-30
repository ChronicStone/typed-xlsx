import type { Accessor, AccessorValue } from "../core/accessor";
import type { Path } from "../core/path";
import type { CellStyle } from "../styles/types";
import type { SummaryDefinition } from "../summary/runtime";

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
  summary?: SummaryDefinition<T, any> | SummaryDefinition<T, any>[];
}

export interface ColumnGroupDefinition<T extends object, TContext = unknown> {
  id: string;
  kind: "group";
  build: (builder: SchemaBuilder<T>, context: TContext) => void;
}

export type SchemaNode<T extends object> = ColumnDefinition<T> | ColumnGroupDefinition<T>;
export type SchemaContext = Record<string, unknown>;

export interface SchemaDefinition<T extends object, TColumnId extends string = string> {
  columns: SchemaNode<T>[];
  readonly __columnIds?: TColumnId | undefined;
}

export type SchemaColumnId<TSchema> =
  TSchema extends SchemaDefinition<any, infer TColumnId> ? TColumnId : never;

export class SchemaBuilder<T extends object, TColumnId extends string = never> {
  private readonly columns: SchemaNode<T>[] = [];
  private readonly ids = new Set<string>();

  static create<T extends object>() {
    return new SchemaBuilder<T, never>();
  }

  column<TId extends string, TPath extends Path<T>>(
    id: TId,
    definition: Omit<ColumnDefinition<T, TPath>, "id" | "accessor"> & { accessor: TPath },
  ): SchemaBuilder<T, TColumnId | TId>;
  column<TId extends string, TAccessor extends Accessor<T, unknown>>(
    id: TId,
    definition: Omit<ColumnDefinition<T, TAccessor>, "id">,
  ): SchemaBuilder<T, TColumnId | TId>;
  column<TId extends string, TAccessor extends Accessor<T, unknown> | Path<T>>(
    id: TId,
    definition: Omit<ColumnDefinition<T, TAccessor>, "id">,
  ): SchemaBuilder<T, TColumnId | TId> {
    if (this.ids.has(id)) {
      throw new Error(`Column with id '${id}' already exists.`);
    }

    this.ids.add(id);
    this.columns.push({
      id,
      ...definition,
    } as ColumnDefinition<T>);
    return this as unknown as SchemaBuilder<T, TColumnId | TId>;
  }

  group<TContext>(id: string, build: (builder: SchemaBuilder<T>, context: TContext) => void) {
    if (this.ids.has(id)) {
      throw new Error(`Column with id '${id}' already exists.`);
    }

    this.ids.add(id);
    this.columns.push({
      id,
      kind: "group",
      build: build as ColumnGroupDefinition<T>["build"],
    });
    return this as SchemaBuilder<T, TColumnId>;
  }

  build(): SchemaDefinition<T, TColumnId> {
    return {
      columns: [...this.columns],
    };
  }
}

export type TypedPath<T extends object> = Path<T>;
