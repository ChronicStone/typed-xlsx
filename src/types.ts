/* eslint-disable ts/ban-types */
import type { Buffer, File } from 'node:buffer'
import type { CellStyle } from 'xlsx-js-style'
import type XLSX from 'xlsx-js-style'
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

type IfExistsInAllUnionMembers<T, K extends PropertyKey> =
    T extends any ? K extends keyof T ? true : false : never

// Main TypeFromPath type
export type TypeFromPath<T, Path extends string> =
    T extends any ? (
      Path extends keyof T ? T[Path] :
        Path extends `${infer P}.${infer R}` ?
          P extends keyof T ?
            T[P] extends GenericObject | null | undefined ?
              TypeFromPath<Exclude<T[P], undefined | null>, R> :
              never :
            never :
          never
    ) : never

// Modified part to handle union types with undefined
export type TypeFromPathUnion<T, Path extends string> =
    IfExistsInAllUnionMembers<T, Path> extends true
      ? TypeFromPath<T, Path>
      : TypeFromPath<T, Path> | undefined

export type AllKeysMatch<T extends object, U> = {
  [K in keyof T]: T[K] extends U ? true : false;
}[keyof T] extends true ? true : false

// https://twitter.com/mattpocockuk/status/1622730173446557697?s=20
export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

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
> = FieldValue extends string ? TypeFromPathUnion<T, FieldValue> : FieldValue extends (...args: any[]) => any ? ReturnType<FieldValue> : never

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
  format?: string | ((rowData: T) => string)
  cellStyle?: CellStyle | ((rowData: T) => CellStyle)
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
  ColumnKeys extends SchemaColumnKeys<Schema>,
  SelectColsMap extends { [key in ColumnKeys]?: boolean } | never,
  SelectedCols extends string = ExtractSelectedColumns<ColumnKeys, SelectColsMap>,
  ContextMap extends { [key: string]: any } = ExtractContextMap<Schema>,
  SelectedContextMap extends ExtractSelectedContext<ContextMap, SelectedCols> = ExtractSelectedContext<ContextMap, SelectedCols>,
> = {
  sheetKey: string
  schema: Schema
  data: T[]
  select?: SelectColsMap
  context?: {}
} & (keyof SelectedContextMap extends never ? {} : { context: Prettify<SelectedContextMap> })

export type ExtractContextMap<
  Schema extends ExcelSchema<any, any, string, any>,
> = Schema extends ExcelSchema<any, any, any, infer Ctx> ? Ctx : {}

export type ExtractSelectedColumns<
  ColKeys extends string,
  SelectCols extends { [key in ColKeys]?: boolean },
> = keyof SelectCols extends never ? ColKeys :
  AllKeysMatch<SelectCols, false> extends true
    ? Exclude<ColKeys, keyof SelectCols>
    : {
        [K in ColKeys]: SelectCols[K] extends true ? K : never;
      }[ColKeys]

export type ExtractSelectedContext<
  ContextMap extends { [key: string]: any },
  SelectedCols extends string,
> = {
  [K in keyof ContextMap as K extends SelectedCols ? K : never]: ContextMap[K];
}

export type TOutputType = 'buffer' | 'workbook' | 'base64' | 'file'

export interface ExcelBuildParams<Output extends TOutputType,
  > {
  output: Output
  rtl?: boolean
  extraLength?: number
  rowHeight?: number
  bordered?: boolean
}

export type ExcelBuildOutput<
  Output extends TOutputType,
> =
  Output extends 'workbook'
    ? XLSX.WorkBook
    : Output extends 'base64'
      ? string
      : Output extends 'buffer'
        ? Buffer
        : Output extends 'file'
          ? File
          : never
