/* eslint-disable ts/ban-types */
import XLSX, { type CellStyle, type WorkSheet, utils } from 'xlsx-js-style'
import { deepmerge } from 'deepmerge-ts'
import type { CellValue, Column, ColumnGroup, ExcelBuildOutput, ExcelBuildParams, ExcelSchema, GenericObject, NestedPaths, Not, SchemaColumnKeys, SheetConfig, SheetTable, SheetTableBuilder, TOutputType, TableSummary, TransformersMap } from './types'
import { buildSheetConfig, getCellDataType, getColumnHeaderStyle, getWorksheetColumnWidths } from './utils'

export class ExcelSchemaBuilder<
  T extends GenericObject,
  CellKeyPaths extends string,
  UsedKeys extends string = never,
  TransformMap extends TransformersMap = {},
  ContextMap extends { [key: string]: any } = {},
  SummaryMap extends TableSummary<T, UsedKeys> = {},
> {
  private columns: Array<Column<T, CellKeyPaths | ((data: T) => CellValue), string, TransformMap> | ColumnGroup<T, string, CellKeyPaths, string, TransformMap, any>> = []
  private transformers: TransformMap = {} as TransformMap
  private summaryMap: SummaryMap = {} as SummaryMap

  public static create<T extends GenericObject, KeyPath extends string = NestedPaths<T>>(): ExcelSchemaBuilder<T, KeyPath> {
    return new ExcelSchemaBuilder<T, KeyPath>()
  }

  public withTransformers<Transformers extends TransformersMap>(transformers: Transformers): ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap & Transformers, SummaryMap> {
    this.transformers = transformers as TransformMap & Transformers
    return this as unknown as ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap & Transformers, ContextMap, SummaryMap>
  }

  public column<
    K extends string,
    FieldValue extends CellKeyPaths | ((data: T) => CellValue),
  >(
    columnKey: Not<K, UsedKeys>,
    column: Omit<Column<T, FieldValue, K, TransformMap>, 'columnKey' | 'type'>,
  ): ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys | K, TransformMap, ContextMap, SummaryMap> {
    if (this.columns.some(c => c.columnKey === columnKey))
      throw new Error(`Column with key '${columnKey}' already exists.`)

    this.columns.push({ type: 'column', columnKey, ...column } as any)
    return this
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
    ContextMap & { [key in K]: Context },
    SummaryMap
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
    return this as any
  }

  summary<Summary extends TableSummary<T, UsedKeys>>(summary: Summary): ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap, ContextMap, Summary> {
    this.summaryMap = summary as SummaryMap & Summary
    return this as unknown as ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap, ContextMap, SummaryMap & Summary>
  }

  public build() {
    const columns = this.columns.map(column => column.type === 'column'
      ? ({
          ...column,
          transform: typeof column.transform === 'string'
            ? this.transformers[column.transform]
            : column.transform,
        })
      : column)

    return {
      columns,
      summary: this.summaryMap,
    } as ExcelSchema<
      T,
      CellKeyPaths,
      UsedKeys,
      ContextMap,
      SummaryMap
    >
  }
}

export class ExcelBuilder<UsedSheetKeys extends string = never> {
  private sheets: Array<SheetConfig> = []

  public static create(): ExcelBuilder {
    return new ExcelBuilder()
  }

  public sheet<Key extends string>(
    key: Not<Key, UsedSheetKeys>,
  ): SheetTableBuilder<ExcelBuilder<UsedSheetKeys | Key>, UsedSheetKeys | Key> {
    if (this.sheets.some(s => s.sheetKey === key))
      throw new Error(`Sheet with key '${key}' already exists.`)

    this.sheets.push({ sheetKey: key, tables: [] })
    return {
      addTable: table => this.defineTable(key, table as any),
      sheet: key => this.sheet(key as any),
      build: params => this.build(params),
    }
  }

  private defineTable<
    Key extends string,
    T extends GenericObject,
    Schema extends ExcelSchema<T, any, string>,
    ColKeys extends SchemaColumnKeys<Schema>,
    SelectCols extends { [key in ColKeys]?: boolean } = {},
  >(
    key: Key,
    table: SheetTable<T, Schema, ColKeys, SelectCols>,
  ): SheetTableBuilder<ExcelBuilder<UsedSheetKeys>, UsedSheetKeys> {
    const sheet = this.sheets.find(s => s.sheetKey === key)
    if (!sheet)
      throw new Error(`Sheet with key '${key}' does not exist.`)

    sheet.tables.push(table as any)
    return {
      addTable: newTable => this.defineTable(key, newTable),
      sheet: key => this.sheet(key as any),
      build: params => this.build(params),
    }
  }

  public build<
    OutputType extends TOutputType,
    Output = ExcelBuildOutput<OutputType>,
  >(params: ExcelBuildParams<OutputType>): Output {
    const _sheets = buildSheetConfig(this.sheets)
    const workbook = utils.book_new()

    const TABLE_CELL_OFFSET = 2

    _sheets.forEach((sheetConfig) => {
      const worksheet: WorkSheet = {}
      let COL_OFFSET = 0
      sheetConfig.tables.forEach((tableConfig, tableIndex) => {
        if (tableIndex > 0) {
          const prevTable = sheetConfig.tables[tableIndex - 1]
          COL_OFFSET += prevTable.columns.length + TABLE_CELL_OFFSET
        }
        tableConfig.columns.forEach((column, index) => {
          const headerCellRef = utils.encode_cell({ c: index + COL_OFFSET, r: 0 })
          worksheet[headerCellRef] = {
            v: column.label,
            t: 's',
            s: getColumnHeaderStyle({ bordered: params?.bordered ?? true }),
          } satisfies XLSX.CellObject

          tableConfig.content.forEach((row, rowIndex) => {
            const cellRef = utils.encode_cell({ c: index + COL_OFFSET, r: rowIndex + 1 })
            const value = column.value(row)
            const style = typeof column._ref.cellStyle === 'function'
              ? column._ref.cellStyle(row)
              : column._ref.cellStyle ?? {}
            const format = typeof column._ref.format === 'function'
              ? column._ref.format(row)
              : column._ref.format

            worksheet[cellRef] = {
              v: value === null ? '' : value,
              t: getCellDataType(value),
              z: format,
              s: deepmerge(
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
                  numFmt: format,
                } satisfies CellStyle,
              ),
            } satisfies XLSX.CellObject
          })

          const hasSummary = Object.keys(tableConfig.summary).length > 0
            && tableConfig.enableSummary
            && Object.keys(tableConfig.summary).some(key => tableConfig.columns.some(column => column._ref.columnKey === key))

          if (hasSummary) {
            const summaryRowIndex = tableConfig.content.length + 1
            for (const columnIndex in tableConfig.columns) {
              const column = tableConfig.columns[columnIndex]
              const summary = (tableConfig.summary as TableSummary<GenericObject, string>)[column._ref.columnKey]
              const cellRef = utils.encode_cell({ c: +columnIndex + COL_OFFSET, r: summaryRowIndex })
              if (!summary) {
                worksheet[cellRef] = {
                  v: '',
                  t: 's',
                  s: getColumnHeaderStyle({ bordered: params?.bordered ?? true }),
                } satisfies XLSX.CellObject

                continue
              }

              const style = typeof summary.cellStyle === 'function'
                ? summary.cellStyle(tableConfig.content)
                : summary.cellStyle ?? {}
              const format = typeof summary.format === 'function'
                ? summary.format(tableConfig.content)
                : summary.format
              const value = summary.value(tableConfig.content)

              worksheet[cellRef] = {
                v: value === null ? '' : value,
                t: getCellDataType(value),
                z: format,
                s: deepmerge(
                  style,
                {
                  font: { bold: true },
                  fill: { fgColor: { rgb: 'E9E9E9' } },
                  alignment: { vertical: 'center' },
                  border: (params?.bordered ?? true)
                    ? {
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } },
                        top: { style: 'thin', color: { rgb: '000000' } },
                      }
                    : {},
                  numFmt: format,
                } satisfies CellStyle,
                ),
              } satisfies XLSX.CellObject
            }
          }
        })
      })

      const totalCols = sheetConfig.tables.reduce((acc, table) => acc + table.columns.length + TABLE_CELL_OFFSET, 0)
      const maxRows = sheetConfig.tables.reduce((acc, table, index) => {
        const tableConfig = sheetConfig.tables[index]
        const hasSummary = Object.keys(tableConfig.summary).length > 0
          && tableConfig.enableSummary
          && Object.keys(tableConfig.summary).some(key => tableConfig.columns.some(column => column._ref.columnKey === key))
        return Math.max(acc, table.content.length + (hasSummary ? 2 : 1))
      }, 0)

      worksheet['!ref'] = `A1:${utils.encode_cell({ c: totalCols, r: maxRows })}`

      worksheet['!rows'] = Array.from(
        { length: maxRows },
        () => ({ hpt: params?.rowHeight ?? 30 }),
      )

      worksheet['!cols'] = getWorksheetColumnWidths(worksheet, params?.extraLength ?? 5)

      utils.book_append_sheet(workbook, worksheet, sheetConfig.sheet)
    })

    workbook.Workbook ??= {}
    workbook.Workbook.Views ??= [{}]
    workbook.Workbook.Views.forEach(view => view.RTL = params?.rtl ?? false)

    return params.output === 'workbook' ? workbook : (XLSX.write(workbook, { type: params.output, bookType: 'xlsx' }))
  }
}
