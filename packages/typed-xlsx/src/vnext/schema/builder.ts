import type { Accessor } from "../core/accessor";
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

export interface ColumnDefinition<T extends object, TAccessor = Accessor<T, unknown>> {
  id: string;
  header?: string;
  accessor: TAccessor;
  defaultValue?: CellValue;
  transform?: TransformFn<T>;
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

export interface SchemaDefinition<T extends object> {
  columns: SchemaNode<T>[];
}

export class SchemaBuilder<T extends object> {
  private readonly columns: SchemaNode<T>[] = [];
  private readonly ids = new Set<string>();

  static create<T extends object>() {
    return new SchemaBuilder<T>();
  }

  column<TPath extends Path<T>>(
    id: string,
    definition: Omit<ColumnDefinition<T, TPath>, "id" | "accessor"> & { accessor: TPath },
  ): this;
  column<TAccessor extends Accessor<T, unknown>>(
    id: string,
    definition: Omit<ColumnDefinition<T, TAccessor>, "id">,
  ): this;
  column<TAccessor extends Accessor<T, unknown> | Path<T>>(
    id: string,
    definition: Omit<ColumnDefinition<T, TAccessor>, "id">,
  ): this {
    if (this.ids.has(id)) {
      throw new Error(`Column with id '${id}' already exists.`);
    }

    this.ids.add(id);
    this.columns.push({
      id,
      ...definition,
    } as ColumnDefinition<T>);
    return this;
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
    return this;
  }

  build(): SchemaDefinition<T> {
    return {
      columns: [...this.columns],
    };
  }
}

export type TypedPath<T extends object> = Path<T>;
