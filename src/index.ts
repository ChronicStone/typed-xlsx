/* eslint-disable ts/ban-types */
import XLSX, { type WorkSheet, utils } from 'xlsx-js-style'
import type { CellValue, Column, ColumnGroup, ExcelBuildOutput, ExcelBuildParams, ExcelSchema, FormatterPreset, FormattersMap, GenericObject, NestedPaths, Not, SchemaColumnKeys, SheetConfig, SheetParams, SheetTable, SheetTableBuilder, TOutputType, TransformersMap } from './types'
import { SheetCacheManager, applyGroupBorders, buildSheetConfig, createCell, getColumnHeaderStyle, getColumnSeparatorIndexes, getWorksheetColumnWidths, tableHasSummary } from './utils'

export type * from './types'

export class ExcelSchemaBuilder<
  T extends GenericObject,
  CellKeyPaths extends string,
  UsedKeys extends string = never,
  TransformMap extends TransformersMap = {},
  FormatMap extends FormattersMap = {},
  ContextMap extends { [key: string]: any } = {},
> {
  private columns: Array<Column<T, CellKeyPaths | ((data: T) => CellValue), string, TransformMap, FormatMap> | ColumnGroup<T, string, CellKeyPaths, string, TransformMap, FormatMap, any>> = []
  private transformers: TransformMap = {} as TransformMap
  private formatters: FormatMap = {} as FormatMap

  public static create<T extends GenericObject, KeyPath extends string = NestedPaths<T>>(): ExcelSchemaBuilder<T, KeyPath> {
    return new ExcelSchemaBuilder<T, KeyPath>()
  }

  public withTransformers<Transformers extends TransformersMap>(transformers: Transformers): ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap & Transformers, FormatMap, ContextMap> {
    this.transformers = transformers as TransformMap & Transformers
    return this as unknown as ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap & Transformers, FormatMap, ContextMap>
  }

  withFormatters<
    Formatters extends FormattersMap,
  >(formatters: Formatters,
  ): ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap, FormatMap & Formatters, ContextMap> {
    this.formatters = formatters as FormatMap & Formatters
    return this as unknown as ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys, TransformMap, FormatMap & Formatters, ContextMap>
  }

  public column<
    K extends string,
    FieldValue extends CellKeyPaths | ((data: T) => CellValue),
    Preset extends FormatterPreset<FormatMap>[keyof FormatMap],
  >(
    columnKey: Not<K, UsedKeys>,
    column: Omit<Column<T, FieldValue, K, TransformMap, FormatMap, Preset>, 'columnKey' | 'type'>,
  ): ExcelSchemaBuilder<T, CellKeyPaths, UsedKeys | K, TransformMap, FormatMap, ContextMap> {
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
    handler: (builder: ExcelSchemaBuilder<T, CellKeyPaths, never, TransformMap, FormatMap>, context: Context) => void,
  ): ExcelSchemaBuilder<
    T,
    CellKeyPaths,
    UsedKeys | K,
    TransformMap,
    FormatMap,
    ContextMap & { [key in K]: Context }
  > {
    if (this.columns.some(c => c.columnKey === key))
      throw new Error(`Column with key '${key}' already exists.`)

    const builder = () => ExcelSchemaBuilder.create<T, CellKeyPaths>()
      .withTransformers(this.transformers)
      .withFormatters(this.formatters)

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
      formatPresets: this.formatters as FormattersMap,
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
    Schema extends ExcelSchema<T, any, string, any>,
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
  >(params: ExcelBuildParams<OutputType>,
  ): Output {
    const workbook = utils.book_new()
    const sheetsConfig = buildSheetConfig(this.sheets)
    const sheetCacheManager = new SheetCacheManager(sheetsConfig)

    const TABLE_CELL_OFFSET = 1

    sheetCacheManager.getSheets().forEach((sheetConfig, sheetIndex) => {
      const tableChunks = sheetConfig.chunks
      const worksheet: WorkSheet & { '!merges': XLSX.Range[] } = {
        '!merges': [],
      }
      let COL_OFFSET = 0
      let ROW_OFFSET = 0
      const titleRowIndexes: number[] = []

      tableChunks.forEach((chunk, chunkIndex) => {
        COL_OFFSET = 0
        if (chunkIndex > 0)
          ROW_OFFSET += TABLE_CELL_OFFSET + (chunkIndex > 0 ? sheetCacheManager.getSheetChunk({ sheetIndex, chunkIndex })?.maxHeight ?? 0 : 0)

        if (chunk.hasTitle)
          titleRowIndexes.push(ROW_OFFSET)

        chunk.tables.forEach((tableIndex) => {
          const { cache: tableCache, table: tableConfig } = sheetCacheManager.getSheetTable({ sheetIndex, tableIndex })
          if (tableIndex > 0) {
            const prevTable = sheetCacheManager.getSheetTable({ sheetIndex, tableIndex: tableIndex - 1 }).table
            COL_OFFSET += prevTable.columns.length + TABLE_CELL_OFFSET
          }

          const hasTitle = !!tableConfig.title
          if (hasTitle) {
            tableConfig.columns.forEach((_, colIndex) => {
              const titleCellRef = utils.encode_cell({ c: COL_OFFSET + colIndex, r: ROW_OFFSET })
              worksheet[titleCellRef] = createCell({
                value: colIndex === 0 ? tableConfig.title : '',
                style: getColumnHeaderStyle({ bordered: params?.bordered ?? true }),
                extraStyle: {
                  alignment: { horizontal: 'left' },
                  fill: { fgColor: { rgb: 'b4c4de' } },
                  font: { sz: 20 },
                },
                formatPresets: tableConfig.formatPresets,
              })
            })

            worksheet['!merges'].push({
              s: { c: COL_OFFSET, r: ROW_OFFSET },
              e: { c: COL_OFFSET + tableConfig.columns.length - 1, r: ROW_OFFSET },
            })
          }

          tableConfig.columns.forEach((column, colIndex) => {
            const headerCellRef = utils.encode_cell({ c: colIndex + COL_OFFSET, r: ROW_OFFSET + (chunk.hasTitle ? 1 : 0) })
            worksheet[headerCellRef] = createCell({
              value: column.label,
              bordered: params?.bordered ?? true,
              style: getColumnHeaderStyle({ bordered: params?.bordered ?? true, customStyle: column._ref.headerStyle }),
              formatPresets: tableConfig.formatPresets,
            })

            tableConfig.content.forEach((row, rowIndex) => {
              const maxRowHeight = tableCache.getRowMaxHeight(rowIndex)
              const prevRowHeight = tableCache.getPrevRowsHeight(rowIndex)
              const values = tableCache.getCellValue({ columnIndex: colIndex, rowIndex })

              values.forEach((value, valueIndex) => {
                const cellRef = utils.encode_cell({
                  c: colIndex + COL_OFFSET,
                  r: prevRowHeight + ROW_OFFSET + (chunk.hasTitle ? 1 : 0) + (valueIndex + 1),
                })

                worksheet[cellRef] = createCell({
                  value,
                  data: row,
                  format: column._ref.format,
                  style: column._ref.cellStyle,
                  bordered: params?.bordered ?? true,
                  rowIndex,
                  subRowIndex: valueIndex,
                  formatPresets: tableConfig.formatPresets,
                })
              })

              if (values.length < maxRowHeight && maxRowHeight > 1) {
                for (let valueIndex = values.length; valueIndex < maxRowHeight; valueIndex++) {
                  const cellRef = utils.encode_cell({
                    c: colIndex + COL_OFFSET,
                    r: prevRowHeight + ROW_OFFSET + (chunk.hasTitle ? 1 : 0) + (valueIndex + 1),
                  })
                  worksheet[cellRef] = createCell({ value: '', bordered: params?.bordered ?? true, formatPresets: tableConfig.formatPresets })
                }
                if (values.length === 1) {
                  worksheet['!merges'].push({
                    s: { c: colIndex + COL_OFFSET, r: prevRowHeight + 1 + ROW_OFFSET + (chunk.hasTitle ? 1 : 0) },
                    e: { c: colIndex + COL_OFFSET, r: prevRowHeight + 1 + ROW_OFFSET + (chunk.hasTitle ? 1 : 0) + maxRowHeight - 1 },
                  })
                }
              }
            })

            if (tableHasSummary(tableConfig)) {
              const summaryRowIndex = tableConfig.content.length + 1 + tableCache.getNbExtraRows()
              for (const summaryIndex in column._ref?.summary ?? []) {
                const summary = column._ref?.summary?.[summaryIndex]
                const cellRef = utils.encode_cell({
                  c: +colIndex + COL_OFFSET,
                  r: summaryRowIndex + ROW_OFFSET + +summaryIndex + (chunk.hasTitle ? 1 : 0),
                })
                if (!summary) {
                  worksheet[cellRef] = createCell({
                    value: '',
                    bordered: params?.bordered ?? true,
                    style: getColumnHeaderStyle({ bordered: params?.bordered ?? true }),
                    formatPresets: tableConfig.formatPresets,
                  })
                  continue
                }

                const value = summary.value(tableConfig.content)
                worksheet[cellRef] = createCell({
                  value,
                  data: tableConfig.content,
                  format: summary.format,
                  style: summary.cellStyle,
                  bordered: params?.bordered ?? true,
                  extraStyle: {
                    font: { bold: true },
                    fill: { fgColor: { rgb: 'E9E9E9' } },
                    alignment: { vertical: 'center' },
                  },
                  formatPresets: tableConfig.formatPresets,
                })
              }
            }
          })

          if (tableCache.getNbExtraRows() > 0) {
            tableConfig.content.forEach((row, rowIndex) => {
              const prevRowHeight = tableCache.getPrevRowsHeight(rowIndex)
              const rowStart = prevRowHeight + 1 + ROW_OFFSET + (chunk.hasTitle ? 1 : 0)
              const currentRowHeight = tableCache.getRowMaxHeight(rowIndex)
              const start = utils.encode_cell({ c: COL_OFFSET, r: rowStart })
              const end = utils.encode_cell({ c: COL_OFFSET + tableConfig.columns.length - 1, r: rowStart + (currentRowHeight - 1) })
              applyGroupBorders(worksheet, { start, end })
            })
          }
        })
      })

      const { height: sheetHeight, range: sheetRange } = sheetCacheManager.getSheetRange({ sheetIndex })
      const colSeparatorIndexes = getColumnSeparatorIndexes({ sheetConfig: sheetConfig.sheet, offset: TABLE_CELL_OFFSET })

      worksheet['!ref'] = sheetRange
      worksheet['!rows'] = Array.from(
        { length: sheetHeight },
        (_, index) => ({ hpt: titleRowIndexes.includes(index) ? 40 : params?.rowHeight ?? 30 }),
      )

      worksheet['!cols'] = getWorksheetColumnWidths(worksheet, params?.extraLength ?? 5)
        .map(({ wch }, index) => ({ wch: colSeparatorIndexes.includes(index) ? sheetConfig.sheet.params?.tableSeparatorWidth ?? 25 : wch }))

      utils.book_append_sheet(workbook, worksheet, sheetConfig.sheet.sheet)
    })

    workbook.Workbook ??= {}
    workbook.Workbook.Views ??= [{}]
    workbook.Workbook.Views.forEach(view => view.RTL = params?.rtl ?? false)

    return params.output === 'workbook' ? workbook : (XLSX.write(workbook, { type: params.output, bookType: 'xlsx' }))
  }
}
