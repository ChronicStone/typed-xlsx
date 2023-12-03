import xlsx, { type IColumn, type IJsonSheet, type ISettings } from 'json-as-xlsx'
import type { CellValue, Column, ExcelSchema, GenericObject, NestedPaths, Not, Sheet, TransformersMap, ValueTransformer } from './types'
import { getPropertyFromPath } from './utils'

export class ExcelSchemaBuilder<
  T extends GenericObject,
  CellKeyPaths extends string,
  UsedKeys extends string = never,
  // eslint-disable-next-line ts/ban-types
  TransformMap extends TransformersMap = {},
> {
  private columns: Column<T, CellKeyPaths | ((data: T) => CellValue), string, TransformMap>[] = []
  private transformers: TransformMap = {} as TransformMap

  public static create<T extends GenericObject, KeyPath extends string = NestedPaths<T>>(): ExcelSchemaBuilder<T, KeyPath> {
    return new ExcelSchemaBuilder<T, KeyPath>()
  }

  public withTransformers<Transformers extends TransformersMap>(transformers: Transformers): ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap & Transformers> {
    this.transformers = transformers as TransformMap & Transformers
    return this as unknown as ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap & Transformers>
  }

  public column<
    K extends string,
    FieldValue extends CellKeyPaths | ((data: T) => CellValue),
  >(
    columnKey: Not<K, UsedKeys>,
    column: Omit<Column<T, FieldValue, K, TransformMap>, 'columnKey'>,
  ): ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys | K, TransformMap> {
    if (this.columns.some(c => c.columnKey === columnKey))
      throw new Error(`Column with key '${columnKey}' already exists.`)

    this.columns.push({ columnKey, ...column } as any)
    return this as unknown as ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys | K, TransformMap>
  }

  public build() {
    return this.columns.map(column => ({
      ...column,
      transform: typeof column.transform === 'string'
        ? this.transformers[column.transform]
        : column.transform,
    })) as ExcelSchema<T, CellKeyPaths, UsedKeys>
  }
}

export class ExcelBuilder<UsedSheetKeys extends string = never> {
  private sheets: Array<Sheet<any, ExcelSchema<any, any, any>>> = []

  public static create(): ExcelBuilder {
    return new ExcelBuilder()
  }

  public sheet<Key extends string, T extends GenericObject, Schema extends ExcelSchema<T, any, string>>(
    key: Not<Key, UsedSheetKeys>,
    sheet: Omit<Sheet<T, Schema>, 'sheetKey'>,
  ): ExcelBuilder<UsedSheetKeys | Key> {
    if (this.sheets.some(s => s.sheetKey === key))
      throw new Error(`Sheet with key '${key}' already exists.`)

    this.sheets.push({ sheetKey: key, ...sheet })
    return this as ExcelBuilder<UsedSheetKeys | Key>
  }

  public build(settings: ISettings) {
    const _sheets: IJsonSheet[] = this.sheets.map(sheet => ({
      sheet: sheet.sheetKey,
      columns: sheet.schema
        .filter(column => !sheet.select || sheet.select.includes(column.columnKey))
        .map((column) => {
          return {
            label: column.columnKey,
            value: (row) => {
              const value = typeof column.value === 'string'
                ? getPropertyFromPath(row, column.value)
                : column.value(row)

              if (!value)
                return column.default ?? ''
              return column.transform ? (column.transform as ValueTransformer)(value) : value
            },
          } satisfies IColumn
        }),
      content: sheet.data,
    }))

    return xlsx(_sheets, settings)
  }
}
