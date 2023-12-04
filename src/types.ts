/* eslint-disable ts/ban-types */
import type { CellStyle } from 'xlsx-js-style'
import type { ExcelSchemaBuilder } from '.'

export type GenericObject = Record<string | number | symbol, any>

export type NestedPaths<T> = T extends Array<infer U>
  ? U extends (object | Date) ? never : never
  : T extends Date ? never
    : T extends object
      ? {
          [K in keyof T & (string | number)]: K extends string
            ? `${K}` | (NonNullable<T[K]> extends object ? `${K}.${NestedPaths<NonNullable<T[K]>>}` : never)
            : never;
        }[keyof T & (string | number)]
      : never

export type Not<T, U> = T extends U ? never : T

export type TypeFromPath<T extends GenericObject, Path extends string> =
  Path extends keyof T ? T[Path] : // Direct key of T
    Path extends `${infer P}.${infer R}` ? // Nested path
      P extends keyof T ?
        T[P] extends (GenericObject | null | undefined) ? // If T[P] is an object, null, or undefined
        TypeFromPath<Exclude<T[P], undefined | null>, R> | Extract<T[P], undefined | null> // Recurse with Exclude and add null/undefined if present
          : never
        : never
      : never

export type CellValue = string | number | boolean | null | undefined | Date

export type ValueTransformer = (value: any) => CellValue

export interface TransformersMap {
  [key: string]: ValueTransformer
}

export type NonNullableDeep<T> = T extends null | undefined ? never : T
export type DeepRequired<T> = {
  [P in keyof T]-?: DeepRequired<NonNullableDeep<T[P]>>;
}

export type TypedTransformersMap<TransformMap extends TransformersMap, Value> = {
  [K in keyof TransformMap]: Value extends Parameters<TransformMap[K]>[0] ? K : never;
}[keyof TransformMap]

export type ExtractColumnValue<
  T extends GenericObject,
  FieldValue extends string | ((data: T) => CellValue),
> = FieldValue extends string ? TypeFromPath<T, FieldValue> : FieldValue extends (...args: any[]) => any ? ReturnType<FieldValue> : never

export type Column<
  T extends GenericObject,
  FieldValue extends string | ((data: T) => CellValue),
  ColKey extends string,
  TransformMap extends TransformersMap,
> = {
  type: 'column'
  label?: string
  columnKey: ColKey
  key: FieldValue
  default?: CellValue
  format?: string
  cellStyle?: (rowData: T) => CellStyle
} & (
  ExtractColumnValue<T, FieldValue> extends CellValue
    ? { transform?: TypedTransformersMap<TransformMap, ExtractColumnValue<T, FieldValue>> | ((value: ExtractColumnValue<T, FieldValue>) => CellValue) }
    : { transform: TypedTransformersMap<TransformMap, ExtractColumnValue<T, FieldValue>> | ((value: ExtractColumnValue<T, FieldValue>) => CellValue) }
)

export interface ColumnGroup<
  T extends GenericObject,
  ColKey extends string,
  KeyPaths extends string,
  UsedKeys extends string,
  TransformMap extends TransformersMap,
  Context,
  // eslint-disable-next-line unused-imports/no-unused-vars
  ContextMap extends Record<string, any> = {},
> {
  type: 'group'
  columnKey: ColKey
  builder: () => ExcelSchemaBuilder<T, KeyPaths, UsedKeys, TransformMap>
  handler: GroupHandler<T, KeyPaths, UsedKeys, TransformMap, Context>
}

export type GroupHandler<
  T extends GenericObject,
  CellKeyPaths extends string,
  UsedKeys extends string,
  TransformMap extends TransformersMap,
  Context,
> = (
  builder: ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap>,
  context: Context,
) => void

export type ExcelSchema<
  T extends GenericObject,
  KeyPaths extends string,
  Key extends string,
  ContextMap extends { [key: string]: any } = {},
> = Array<Column<T, KeyPaths, Key, any> | ColumnGroup<T, Key, KeyPaths, string, any, any, ContextMap>>

export type SchemaColumnKeys<
  T extends ExcelSchema<any, any, string>,
> = T extends Array<Column<any, any, infer K, any> | ColumnGroup<any, infer K, any, any, any, any>> ? K : never

export type Sheet<
  T extends GenericObject,
  Schema extends ExcelSchema<T, any, string, any>,
> = {
  sheetKey: string
  schema: Schema
  data: T[]
  select?: { [K in SchemaColumnKeys<Schema>]?: boolean }
  context?: {}
} & (Schema extends ExcelSchema<T, any, any, infer Ctx>
  ? keyof Ctx extends never ? {} : { context: Ctx }
  : {})
