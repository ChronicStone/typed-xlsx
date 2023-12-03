import xlsx, { type IColumn, type IJsonSheet, getWorksheetColumnWidths } from 'json-as-xlsx'
import type { CellStyle } from 'xlsx-js-style'
import XLSX from 'xlsx-js-style'
import { deepmerge } from 'deepmerge-ts'
import type { CellValue, Column, ExcelSchema, GenericObject, NestedPaths, Not, Sheet, TransformersMap, ValueTransformer } from './types'
import { formatKey, getPropertyFromPath, getSheetCellKey } from './utils'

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

  public build() {
    const _sheets: IJsonSheet[] = this.sheets.map(sheet => ({
      sheet: sheet.sheetKey,
      columns: sheet.schema
        .filter(column => !sheet.select || sheet.select.includes(column.columnKey))
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
          } satisfies IColumn
        }),
      content: sheet.data,
    }))

    const fileBody = xlsx(_sheets, {
      fileName: Date.now().toString(),
      extraLength: 3,
      writeOptions: {
        type: 'buffer',
        bookType: 'xlsx',
      },
    // eslint-disable-next-line node/prefer-global/buffer
    }) as Buffer

    const workbook = XLSX.read(fileBody, { type: 'buffer' })
    workbook.SheetNames.forEach((sheetName) => {
      const sheetConfig = this.sheets.find(sheet => sheet.sheetKey === sheetName)
      if (!sheetConfig)
        return

      workbook.Sheets[sheetName]['!rows'] = Array.from({
        length: sheetConfig.data.length + 1,
      }, () => ({ hpt: 30 }))

      workbook.Sheets[sheetName]['!cols'] = getWorksheetColumnWidths(workbook.Sheets[sheetName], 10).map(({ width }) => ({ wch: width }))

      sheetConfig.schema.forEach((column, index) => {
        const headerCellRef = getSheetCellKey(index + 1, 1)
        if (!workbook.Sheets[sheetName][headerCellRef])
          return
        workbook.Sheets[sheetName][headerCellRef].s = {
          font: { bold: true },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: 'E9E9E9' } },
          border: {
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } },
            top: { style: 'thin', color: { rgb: '000000' } },
          },
        } satisfies CellStyle
        sheetConfig.data.forEach((row, rowIndex) => {
          const cellRef = getSheetCellKey(index + 1, rowIndex + 2)
          const style = column.cellStyle?.(row) ?? {}
          workbook.Sheets[sheetName][cellRef].s = deepmerge(
            style,
            {
              alignment: { vertical: 'center' },
              border: {
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } },
                top: { style: 'thin', color: { rgb: '000000' } },
              },
              numFmt: column.format,
            } satisfies CellStyle,
          )
        })
      })
    })

    // eslint-disable-next-line node/prefer-global/buffer
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    // for()
  }
}
