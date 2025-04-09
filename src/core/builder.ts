// core/builder.ts
/* eslint-disable ts/ban-types */
import { Buffer } from 'node:buffer'
import { Workbook } from 'exceljs'
import type {
  ExcelBuildOutput,
  ExcelBuildParams,
  ExcelSchema,
  GenericObject,
  Not,
  SchemaColumnKeys,
  SheetConfig,
  SheetParams,
  SheetTable,
  SheetTableBuilder,
  TOutputType,
} from '../types'
import {
  SheetCacheManager,
  autoSizeColumns,
  buildSheetConfig,
  createCell,
  getColumnHeaderStyle,
  tableHasSummary,
} from '../utils'

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

  public async build<
      OutputType extends TOutputType,
      Output = ExcelBuildOutput<OutputType>,
    >(params: ExcelBuildParams<OutputType>,
  ): Promise<Output> {
    const workbook = new Workbook()

    // if (params.rtl)
    //   workbook.views = [{ rightToLeft: true }]

    const sheetsConfig = buildSheetConfig(this.sheets)
    const sheetCacheManager = new SheetCacheManager(sheetsConfig)

    const TABLE_CELL_OFFSET = 1

    sheetCacheManager.getSheets().forEach((sheetConfig, sheetIndex) => {
      const tableChunks = sheetConfig.chunks
      const worksheet = workbook.addWorksheet(sheetConfig.sheet.sheet)

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
            const titleStyle = typeof tableConfig.titleStyle === 'function' ? tableConfig.titleStyle(tableConfig.content) : tableConfig.titleStyle ?? {}

            // Create title cell
            createCell({
              worksheet,
              row: ROW_OFFSET + 1, // ExcelJS rows are 1-based
              col: COL_OFFSET + 1, // ExcelJS cols are 1-based
              value: tableConfig.title,
              style: getColumnHeaderStyle({ bordered: params?.bordered ?? true, customStyle: titleStyle }),
              extraStyle: {
                alignment: { horizontal: 'left' },
                fill: {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFB4C4DE' },
                },
                font: { size: 20 },
              },
              formatPresets: tableConfig.formatPresets,
              bordered: params?.bordered ?? true,
            })

            // Merge cells for title
            if (tableConfig.columns.length > 1) {
              worksheet.mergeCells(
                ROW_OFFSET + 1,
                COL_OFFSET + 1,
                ROW_OFFSET + 1,
                COL_OFFSET + tableConfig.columns.length,
              )
            }
          }

          // Create header row
          tableConfig.columns.forEach((column, colIndex) => {
            createCell({
              worksheet,
              row: ROW_OFFSET + (chunk.hasTitle ? 2 : 1),
              col: colIndex + COL_OFFSET + 1,
              value: column.label,
              style: getColumnHeaderStyle({ bordered: params?.bordered ?? true, customStyle: column._ref.headerStyle }),
              formatPresets: tableConfig.formatPresets,
              bordered: params?.bordered ?? true,
            })

            // Set column width if specified
            if (column._ref.width)
              worksheet.getColumn(colIndex + COL_OFFSET + 1).width = column._ref.width
          })

          // Create data rows
          tableConfig.content.forEach((row, rowIndex) => {
            const maxRowHeight = tableCache.getRowMaxHeight(rowIndex)
            const prevRowHeight = tableCache.getPrevRowsHeight(rowIndex)

            tableConfig.columns.forEach((column, colIndex) => {
              const values = tableCache.getCellValue({ columnIndex: colIndex, rowIndex })

              values.forEach((value, valueIndex) => {
                const rowNum = prevRowHeight + ROW_OFFSET + (chunk.hasTitle ? 2 : 1) + valueIndex

                createCell({
                  worksheet,
                  row: rowNum,
                  col: colIndex + COL_OFFSET + 1,
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

              // Handle merging for multi-row cells
              if (values.length === 1 && maxRowHeight > 1) {
                const startRow = prevRowHeight + ROW_OFFSET + (chunk.hasTitle ? 2 : 1)
                const endRow = startRow + maxRowHeight - 1

                if (startRow < endRow) {
                  worksheet.mergeCells(
                    startRow,
                    colIndex + COL_OFFSET + 1,
                    endRow,
                    colIndex + COL_OFFSET + 1,
                  )
                }
              }
            })

            // Set row height if specified
            if (params?.rowHeight) {
              for (let i = 0; i < maxRowHeight; i++) {
                const rowNum = prevRowHeight + ROW_OFFSET + (chunk.hasTitle ? 2 : 1) + i
                worksheet.getRow(rowNum).height = params.rowHeight
              }
            }
          })

          // Create summary rows if needed
          if (tableHasSummary(tableConfig)) {
            const summaryRowIndex = tableConfig.content.length + 1 + tableCache.getNbExtraRows()

            tableConfig.columns.forEach((column, colIndex) => {
              for (const summaryIndex in column._ref?.summary ?? []) {
                const summary = column._ref?.summary?.[summaryIndex]
                const rowNum = summaryRowIndex + ROW_OFFSET + Number.parseInt(summaryIndex) + (chunk.hasTitle ? 2 : 1)

                if (!summary) {
                  createCell({
                    worksheet,
                    row: rowNum,
                    col: colIndex + COL_OFFSET + 1,
                    value: '',
                    style: getColumnHeaderStyle({ bordered: params?.bordered ?? true }),
                    formatPresets: tableConfig.formatPresets,
                    bordered: params?.bordered ?? true,
                  })
                  continue
                }

                const value = summary.value(tableConfig.content)
                createCell({
                  worksheet,
                  row: rowNum,
                  col: colIndex + COL_OFFSET + 1,
                  value,
                  data: tableConfig.content,
                  format: summary.format,
                  style: summary.cellStyle,
                  bordered: params?.bordered ?? true,
                  extraStyle: {
                    font: { bold: true },
                    fill: {
                      type: 'pattern',
                      pattern: 'solid',
                      fgColor: { argb: 'FFE9E9E9' },
                    },
                    alignment: { vertical: 'middle' },
                  },
                  formatPresets: tableConfig.formatPresets,
                })
              }
            })
          }
        })
      })

      // Set title row heights
      titleRowIndexes.forEach((rowIndex) => {
        worksheet.getRow(rowIndex + 1).height = 40
      })

      // Apply auto-sizing if requested
      if (params.autoSizeColumns)
        autoSizeColumns(worksheet, params.columnSizing || {})
    })

    // Handle output format
    if (params.output === 'workbook') {
      return workbook as Output
    }
    else if (params.output === 'buffer') {
      return await workbook.xlsx.writeBuffer() as unknown as Output
    }
    else if (params.output === 'base64') {
      const buffer = await workbook.xlsx.writeBuffer()
      return Buffer.from(buffer).toString('base64') as unknown as Output
    }

    throw new Error(`Unsupported output type: ${params.output}`)
  }
}
