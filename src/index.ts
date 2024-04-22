/* eslint-disable ts/ban-types */
import XLSX, { type CellStyle, type WorkSheet, utils } from 'xlsx-js-style'
import { deepmerge } from 'deepmerge-ts'
import type { CellValue, Column, ColumnGroup, ExcelBuildOutput, ExcelBuildParams, ExcelSchema, GenericObject, NestedPaths, Not, SchemaColumnKeys, SheetConfig, SheetParams, SheetTable, SheetTableBuilder, TOutputType, TransformersMap } from './types'
import { applyGroupBorders, buildSheetConfig, computeSheetRange, getCellDataType, getColumnHeaderStyle, getSheetChunkMaxHeight, getWorksheetColumnWidths, splitIntoChunks, tableHasSummary } from './utils'

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
    return this
  }

  public group<
    K extends `group:${string}`,
    Context,
  >(
    key: Not<K, UsedKeys>,
    handler: (builder: ExcelSchemaBuilder<T, CellKeyPaths, never, TransformMap>, context: Context) => void,
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
    return this as any
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
    } as ExcelSchema<
      T,
      CellKeyPaths,
      UsedKeys,
      ContextMap
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
    params?: SheetParams,
  ): SheetTableBuilder<ExcelBuilder<UsedSheetKeys | Key>, UsedSheetKeys | Key> {
    if (this.sheets.some(s => s.sheetKey === key))
      throw new Error(`Sheet with key '${key}' already exists.`)

    this.sheets.push({ sheetKey: key, params: params ?? {}, tables: [] })
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
      sheet: (key, params) => this.sheet(key as any, params),
      build: params => this.build(params),
    }
  }

  public build<
    OutputType extends TOutputType,
    Output = ExcelBuildOutput<OutputType>,
  >(params: ExcelBuildParams<OutputType>): Output {
    const workbook = utils.book_new()
    const _sheets = buildSheetConfig(this.sheets)

    const TABLE_CELL_OFFSET = 1

    _sheets.forEach((sheetConfig) => {
      const tableRows = splitIntoChunks(sheetConfig.tables, sheetConfig.params?.tablesPerRow)
      const worksheet: WorkSheet = {}
      let COL_OFFSET = 0
      let ROW_OFFSET = 0
      const titleRowIndexes: number[] = []

      tableRows.forEach((tables, rowIndex) => {
        COL_OFFSET = 0
        if (rowIndex > 0) {
          const prevRow = tableRows[rowIndex - 1]
          ROW_OFFSET += getSheetChunkMaxHeight(prevRow) + TABLE_CELL_OFFSET
        }

        const rowHasTitle = tables.some(table => !!table.title)
        if (rowHasTitle)
          titleRowIndexes.push(ROW_OFFSET)

        tables.forEach((tableConfig, tableIndex) => {
          if (tableIndex > 0) {
            const prevTable = tables[tableIndex - 1]
            COL_OFFSET += prevTable.columns.length + TABLE_CELL_OFFSET
          }

          const tableContentExtraRows = tableConfig.columns.reduce((acc, col) => {
            return Math.max(acc, tableConfig.content.reduce((acc, row, rowIndex) => {
              const _resolvedValue = col.value(row, rowIndex)
              const values = Array.isArray(_resolvedValue) ? _resolvedValue : [_resolvedValue]
              return values.length - 1 + acc
            }, 0))
          }, 0)

          const hasTitle = !!tableConfig.title
          if (hasTitle) {
            tableConfig.columns.forEach((_, colIndex) => {
              const titleCellRef = utils.encode_cell({ c: COL_OFFSET + colIndex, r: ROW_OFFSET })
              worksheet[titleCellRef] = {
                v: colIndex === 0 ? tableConfig.title : '',
                t: 's',
                s: deepmerge(
                  getColumnHeaderStyle({ bordered: params?.bordered ?? true }),
                  {
                    alignment: { horizontal: 'left' },
                    fill: { fgColor: { rgb: 'b4c4de' } },
                    font: { sz: 20 },
                  } satisfies CellStyle,
                ),
              } satisfies XLSX.CellObject
            })

            if (!worksheet['!merges'])
              worksheet['!merges'] = []
            worksheet['!merges'].push({
              s: { c: COL_OFFSET, r: ROW_OFFSET },
              e: { c: COL_OFFSET + tableConfig.columns.length - 1, r: ROW_OFFSET },
            })
          }

          tableConfig.columns.forEach((column, colIndex) => {
            const headerCellRef = utils.encode_cell({ c: colIndex + COL_OFFSET, r: ROW_OFFSET + (rowHasTitle ? 1 : 0) })
            worksheet[headerCellRef] = {
              v: column.label,
              t: 's',
              s: getColumnHeaderStyle({ bordered: params?.bordered ?? true }),
            } satisfies XLSX.CellObject

            tableConfig.content.forEach((row, rowIndex) => {
              const maxRowHeight = tableConfig.columns.reduce((acc, column) => {
                const _resolvedValue = column.value(row, rowIndex)
                const values = Array.isArray(_resolvedValue) ? _resolvedValue : [_resolvedValue]
                return Math.max(acc, values.length)
              }, 1)

              const prevRowHeight = tableConfig.columns.reduce((acc, column) => {
                return Math.max(acc, tableConfig.content.filter((_, i) => i < rowIndex).reduce((acc, row, rowIndex) => {
                  const value = column.value(row, rowIndex)
                  return acc + (Array.isArray(value) ? value.length : 1)
                }, 0))
              }, 0)

              const _resolvedValue = column.value(row, rowIndex)
              const values = Array.isArray(_resolvedValue) ? _resolvedValue : [_resolvedValue]
              const style = typeof column._ref.cellStyle === 'function'
                ? column._ref.cellStyle(row)
                : column._ref.cellStyle ?? {}
              const format = typeof column._ref.format === 'function'
                ? column._ref.format(row)
                : column._ref.format

              values.forEach((value, valueIndex) => {
                const cellRef = utils.encode_cell({
                  c: colIndex + COL_OFFSET,
                  r: prevRowHeight + ROW_OFFSET + (rowHasTitle ? 1 : 0) + (valueIndex + 1),
                })

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

              if (values.length < maxRowHeight && maxRowHeight > 1) {
                for (let valueIndex = values.length; valueIndex < maxRowHeight; valueIndex++) {
                  const cellRef = utils.encode_cell({
                    c: colIndex + COL_OFFSET,
                    r: prevRowHeight + ROW_OFFSET + (rowHasTitle ? 1 : 0) + (valueIndex + 1),
                  })
                  worksheet[cellRef] = {
                    v: '',
                    t: 's',
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
                      } satisfies CellStyle,
                    ),
                  } satisfies XLSX.CellObject
                }
                if (values.length === 1) {
                  if (!worksheet['!merges'])
                    worksheet['!merges'] = []

                  worksheet['!merges'].push({
                    s: { c: colIndex + COL_OFFSET, r: prevRowHeight + 1 + ROW_OFFSET + (rowHasTitle ? 1 : 0) },
                    e: { c: colIndex + COL_OFFSET, r: prevRowHeight + 1 + ROW_OFFSET + (rowHasTitle ? 1 : 0) + maxRowHeight - 1 },
                  })
                }
              }
            })

            if (tableHasSummary(tableConfig)) {
              const summaryRowIndex = tableConfig.content.length + 1 + tableContentExtraRows
              for (const summaryIndex in column._ref?.summary ?? []) {
                const summary = column._ref?.summary?.[summaryIndex]
                const cellRef = utils.encode_cell({
                  c: +colIndex + COL_OFFSET,
                  r: summaryRowIndex + ROW_OFFSET + +summaryIndex + (rowHasTitle ? 1 : 0),
                })
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

          // worksheet['!merges'].push({
          //   s: { prevRowHeight + 1 + ROW_OFFSET + (rowHasTitle ? 1 : 0) },
          //   e: { c: colIndex + COL_OFFSET, r: prevRowHeight + 1 + ROW_OFFSET + (rowHasTitle ? 1 : 0) + maxRowHeight - 1 },
          // })

          if (tableContentExtraRows > 0) {
            tableConfig.content.forEach((row, rowIndex) => {
              const prevRowHeight = tableConfig.columns.reduce((acc, column) => {
                return Math.max(acc, tableConfig.content.filter((_, i) => i < rowIndex).reduce((acc, row, rowIndex) => {
                  const value = column.value(row, rowIndex)
                  return acc + (Array.isArray(value) ? value.length : 1)
                }, 0))
              }, 0)
              const rowStart = prevRowHeight + 1 + ROW_OFFSET + (rowHasTitle ? 1 : 0)
              const currentRowHeight = tableConfig.columns.reduce((acc, col) => {
                const value = col.value(row, rowIndex)
                return Math.max(acc, Array.isArray(value) ? value.length : 1)
              }, 1)

              const start = utils.encode_cell({ c: COL_OFFSET, r: rowStart })
              const end = utils.encode_cell({ c: COL_OFFSET + tableConfig.columns.length - 1, r: rowStart + (currentRowHeight - 1) })
              applyGroupBorders(worksheet, { start, end })
            })
          }
        })
      })

      const { sheetHeight, sheetRange } = computeSheetRange(tableRows)

      const colSeparatorIndexes = sheetConfig.tables.map((table, index) => {
        if (index === sheetConfig.tables.length - 1)
          return []

        const tableConfig = sheetConfig.tables[index]
        const colsCount = tableConfig.columns.length
        return Array.from({ length: TABLE_CELL_OFFSET }, (_, i) => colsCount + i)
      }).flat()

      worksheet['!ref'] = sheetRange

      worksheet['!rows'] = Array.from(
        { length: sheetHeight },
        (_, index) => ({
          hpt: titleRowIndexes.includes(index) ? 40 : params?.rowHeight ?? 30,
        }),
      )

      worksheet['!cols'] = getWorksheetColumnWidths(worksheet, params?.extraLength ?? 5)
        .map(({ wch }, index) => ({
          wch: colSeparatorIndexes.includes(index) ? sheetConfig.params?.tableSeparatorWidth ?? 25 : wch,
        }))

      utils.book_append_sheet(workbook, worksheet, sheetConfig.sheet)
    })

    workbook.Workbook ??= {}
    workbook.Workbook.Views ??= [{}]
    workbook.Workbook.Views.forEach(view => view.RTL = params?.rtl ?? false)

    return params.output === 'workbook' ? workbook : (XLSX.write(workbook, { type: params.output, bookType: 'xlsx' }))
  }
}
