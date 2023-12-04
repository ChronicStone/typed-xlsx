/* eslint-disable node/prefer-global/buffer */
/* eslint-disable ts/ban-types */
import xlsx, { type IColumn, type IJsonSheet, getWorksheetColumnWidths } from 'json-as-xlsx'
import type { CellStyle } from 'xlsx-js-style'
import XLSX from 'xlsx-js-style'
import { deepmerge } from 'deepmerge-ts'
import type { CellValue, Column, ColumnGroup, ExcelBuildParams, ExcelSchema, GenericObject, NestedPaths, Not, SchemaColumnKeys, Sheet, TransformersMap, ValueTransformer } from './types'
import { formatKey, getPropertyFromPath, getSheetCellKey } from './utils'

export class ExcelSchemaBuilder<
  T extends GenericObject,
  CellKeyPaths extends string,
  UsedKeys extends string = never,
  TransformMap extends TransformersMap = {},
  ContextMap extends { [key: string]: any } = {},
> {
  private columns: Array<Column<T, CellKeyPaths | ((data: T) => CellValue), string, TransformMap> | ColumnGroup<T, string, CellKeyPaths, string, TransformMap, any>> = []
  private transformers: TransformMap = {} as TransformMap

  public static create<T extends GenericObject, KeyPath extends string = NestedPaths<T>>(): ExcelSchemaBuilder<T, KeyPath> {
    return new ExcelSchemaBuilder<T, KeyPath>()
  }

  public withTransformers<Transformers extends TransformersMap>(transformers: Transformers): ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap & Transformers> {
    this.transformers = transformers as TransformMap & Transformers
    return this as unknown as ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap & Transformers, ContextMap>
  }

  public column<
    K extends string,
    FieldValue extends CellKeyPaths | ((data: T) => CellValue),
  >(
    columnKey: Not<K, UsedKeys>,
    column: Omit<Column<T, FieldValue, K, TransformMap>, 'columnKey' | 'type'>,
  ): ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys | K, TransformMap, ContextMap> {
    if (this.columns.some(c => c.columnKey === columnKey))
      throw new Error(`Column with key '${columnKey}' already exists.`)

    this.columns.push({ type: 'column', columnKey, ...column } as any)
    return this as unknown as ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys | K, TransformMap, ContextMap>
  }

  public group<
    K extends `group:${string}`,
    Context,
  >(
    key: Not<K, UsedKeys>,
    handler: (builder: ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap>, context: Context) => void,
  ): ExcelSchemaBuilder<
    T,
    CellKeyPaths,
    UsedKeys | K,
    TransformMap,
    ContextMap & { [key in K]: Context }
  > {
    if (this.columns.some(c => c.columnKey === key))
      throw new Error(`Column with key '${key}' already exists.`)

    const builder = () => ExcelSchemaBuilder.create<T, CellKeyPaths>()
      .withTransformers(this.transformers)

    this.columns.push({
      type: 'group',
      columnKey: key,
      builder,
      handler,
    } as any)
    return this
  }

  public build() {
    return this.columns.map(column => column.type === 'column'
      ? ({
          ...column,
          transform: typeof column.transform === 'string'
            ? this.transformers[column.transform]
            : column.transform,
        })
      : column) as ExcelSchema<
        T,
        CellKeyPaths,
        UsedKeys,
        ContextMap
      >
  }
}

export class ExcelBuilder<UsedSheetKeys extends string = never> {
  private sheets: Array<Sheet<any, ExcelSchema<any, any, any>, any, any>> = []

  public static create(): ExcelBuilder {
    return new ExcelBuilder()
  }

  public sheet<
    Key extends string,
    T extends GenericObject,
    Schema extends ExcelSchema<T, any, string>,
    ColKeys extends SchemaColumnKeys<Schema>,
    SelectCols extends { [key in ColKeys]?: boolean } = {},
  >(
    key: Not<Key, UsedSheetKeys>,
    sheet: Omit<Sheet<T, Schema, ColKeys, SelectCols>, 'sheetKey'>,
  ): ExcelBuilder<UsedSheetKeys | Key> {
    if (this.sheets.some(s => s.sheetKey === key))
      throw new Error(`Sheet with key '${key}' already exists.`)

    this.sheets.push({ sheetKey: key, ...sheet })
    return this as ExcelBuilder<UsedSheetKeys | Key>
  }

  public build<
  OutputType extends 'buffer' | 'workbook',
  Output = OutputType extends 'workbook' ? XLSX.WorkBook : Buffer,
 >(params: ExcelBuildParams<OutputType>): Output {
    const _sheets = this.sheets.map(sheet => ({
      sheet: sheet.sheetKey,
      columns: sheet.schema
        .filter((column) => {
          if (!column)
            return false
          if (!sheet.select || Object.keys(sheet.select).length === 0)
            return true

          const selectorMap = Object.entries(sheet.select).map(([key, value]) => ({ key, value }))
          if (selectorMap.every(({ value }) => value === false) && !selectorMap.some(({ key }) => key === column.columnKey))
            return true

          if (selectorMap.some(({ key, value }) => key === column.columnKey && value === true))
            return true

          return false
        })
        .map((column): Column<any, any, any, any> | Column<any, any, any, any>[] => {
          if (column.type === 'column') {
            return column
          }
          else {
            const builder = column.builder()
            column.handler(builder, ((sheet.context ?? {}) as any)[column.columnKey])
            const columns = builder.build()
            return columns as Column<any, any, any, any>[]
          }
        })
        .flat()
        .map((column) => {
          return {
            label: column?.label ?? formatKey(column.columnKey),
            value: (row) => {
              const value = typeof column.key === 'string'
                ? getPropertyFromPath(row, column.key)
                : column.key(row)

              if (
                typeof value === 'undefined'
                  || value === null
                  || value === ''
                  || (Array.isArray(value) && value.length === 0 && column.default)
              )
                return column.default

              return column.transform ? (column.transform as ValueTransformer)(value) : value
            },
            format: column.format,
            _ref: column,
          } satisfies (IColumn & { _ref: Column<any, any, any, any> })
        }),
      content: sheet.data,
    })) satisfies IJsonSheet[]

    const fileBody = xlsx(_sheets, {
      fileName: Date.now().toString(),
      extraLength: params?.extraLength ?? 3,
      RTL: params?.rtl ?? false,
      writeOptions: {
        type: 'buffer',
        bookType: 'xlsx',

      },

    }) as Buffer

    const workbook = XLSX.read(fileBody, { type: 'buffer' })
    workbook.SheetNames.forEach((sheetName) => {
      const sheetConfig = _sheets.find(({ sheet }) => sheet === sheetName)
      if (!sheetConfig)
        return

      workbook.Sheets[sheetName]['!rows'] = Array.from({
        length: sheetConfig.content.length + 1,
      }, () => ({ hpt: params?.rowHeight ?? 30 }))

      workbook.Sheets[sheetName]['!cols'] = getWorksheetColumnWidths(workbook.Sheets[sheetName], params?.extraLength ?? 5).map(({ width }) => ({
        wch: width,
      }))

      sheetConfig.columns.forEach((column, index) => {
        const headerCellRef = getSheetCellKey(index + 1, 1)
        if (!workbook.Sheets[sheetName][headerCellRef])
          return
        workbook.Sheets[sheetName][headerCellRef].s = {
          font: { bold: true },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: 'E9E9E9' } },
          border: (params?.bordered ?? true)
            ? {
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } },
                top: { style: 'thin', color: { rgb: '000000' } },
              }
            : {},
        } satisfies CellStyle
        sheetConfig.content.forEach((row, rowIndex) => {
          const cellRef = getSheetCellKey(index + 1, rowIndex + 2)
          const style = column._ref.cellStyle?.(row) ?? {}
          workbook.Sheets[sheetName][cellRef].s = deepmerge(
            style,
            {
              alignment: { vertical: 'center' },
              border: (params?.bordered ?? true)
                ? {
                    bottom: { style: 'thin', color: { rgb: '000000' } },
                    left: { style: 'thin', color: { rgb: '000000' } },
                    right: { style: 'thin', color: { rgb: '000000' } },
                    top: { style: 'thin', color: { rgb: '000000' } },
                  }
                : {},
              numFmt: column._ref.format,
            } satisfies CellStyle,
          )
        })
      })
    })

    return params?.output === 'workbook' ? workbook : (XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
  }
}
