// utils.ts
import type { Cell, Row, Style, Worksheet } from 'exceljs'
import { deepmerge } from 'deepmerge-ts'
import type {
  BaseCellValue,
  CellValue,
  Column,
  FormatterPreset,
  FormattersMap,
  GenericObject,
  SheetConfig,
  ValueTransformer,
} from './types'
import { THICK_BORDER_STYLE, THIN_BORDER_STYLE } from './constants'

export function getPropertyFromPath(obj: GenericObject, path: string) {
  try {
    return path.split('.').reduce((o, i) => o && o[i], obj)
  }
  catch (err) {
    return undefined
  }
}

export function formatKey(key: string) {
  return (
    key.charAt(0).toUpperCase()
    + key
      .split(/(?=[A-Z])/)
      .join(' ')
      .toLowerCase()
      .slice(1)
      .split('_')
      .join(' ')
  )
}
export function buildSheetConfig(sheets: Array<SheetConfig>) {
  return sheets.map(sheet => ({
    sheet: sheet.sheetKey,
    params: sheet.params,
    tables: sheet.tables.map((table) => {
      const columns = table.schema
        .columns
        .filter((column) => {
          if (!column)
            return false
          if (!table.select || Object.keys(table.select).length === 0)
            return true

          const selectorMap = Object.entries(table.select).map(([key, value]) => ({ key, value }))
          if (selectorMap.every(({ value }) => value === false) && !selectorMap.some(({ key }) => key === column.columnKey))
            return true

          if (selectorMap.some(({ key, value }) => key === column.columnKey && value === true))
            return true

          return false
        })
        .map((column): Column<any, any, any, any, any> | Column<any, any, any, any, any>[] => {
          if (column.type === 'column') {
            return column
          }
          else {
            const builder = column.builder()
            column.handler(builder, ((table.context ?? {}) as any)[column.columnKey])
            const { columns } = builder.build()
            return (columns as Column<any, any, any, any, any>[])
          }
        })
        .flat()
        .map((column) => {
          return {
            label: column?.label ?? column.columnKey,
            value: (row: GenericObject, index: number, subIndex: number = 0): CellValue => {
              const value = typeof column.accessor === 'string'
                ? getPropertyFromPath(row, column.accessor)
                : column.accessor(row, index, subIndex)

              if (
                typeof value === 'undefined'
                || value === null
                || value === ''
                || (Array.isArray(value) && value.length === 0 && column.default)
              )
                return column.default

              const transformedVal = column.transform ? (column.transform as ValueTransformer)(value, index) : value
              return (Array.isArray(transformedVal) && !transformedVal.length) ? column.default ?? null : transformedVal
            },
            _ref: column,
          }
        })

      return {
        title: table.title,
        titleStyle: table.titleStyle,
        content: table.data,
        columns,
        enableSummary: table.summary ?? true,
        formatPresets: table.schema.formatPresets,
      }
    }),
  }))
}

export function getColumnHeaderStyle(params: { bordered: boolean, customStyle?: Partial<Style> }): Partial<Style> {
  return deepmerge(
    {
      font: { bold: true },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE9E9E9' },
      },
      border: (params?.bordered ?? true)
        ? THICK_BORDER_STYLE
        : {},
    },
    params?.customStyle ?? {},
  ) as Partial<Style>
}

export function applyStyles(cell: Cell, styles: Partial<Style>) {
  if (styles.font)
    cell.font = styles.font

  if (styles.alignment)
    cell.alignment = styles.alignment

  if (styles.border)
    cell.border = styles.border

  if (styles.fill)
    cell.fill = styles.fill

  if (styles.numFmt)
    cell.numFmt = styles.numFmt
}

export function calculateColumnWidth(value: any): number {
  if (value === null || value === undefined)
    return 0

  let text: string

  if (value instanceof Date) {
    // Date values typically need ~10-12 characters
    return 12
  }
  else if (typeof value === 'number') {
    // Add extra space for formatted numbers
    text = value.toString()
    return Math.max(text.length + 3, 10)
  }
  else if (typeof value === 'boolean') {
    return 8 // 'true' or 'false'
  }
  else {
    text = String(value)
    // Estimate width: 1 character ≈ 1 unit
    // Complex characters like CJK might need special handling
    return Math.min(Math.max(text.length + 2, 6), 50)
  }
}

export function autoSizeColumns(worksheet: Worksheet, params: {
  minWidth?: number
  maxWidth?: number
  headerWidthFactor?: number
} = {}): void {
  const {
    minWidth = 6,
    maxWidth = 50,
    headerWidthFactor = 1.2,
  } = params

  // Get all used columns
  const columnCount = worksheet.columnCount

  // Initialize width array
  const columnWidths: number[] = Array(columnCount).fill(minWidth)

  // Process header row
  const headerRow = worksheet.getRow(1)
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (cell.value !== null && cell.value !== undefined) {
      const width = calculateColumnWidth(cell.value) * headerWidthFactor
      columnWidths[colNumber - 1] = Math.max(columnWidths[colNumber - 1], width)
    }
  })

  // Process data rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1)
      return // Skip header row, already processed

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (cell.value !== null && cell.value !== undefined) {
        const width = calculateColumnWidth(cell.value)
        columnWidths[colNumber - 1] = Math.max(columnWidths[colNumber - 1], width)
      }
    })
  })

  // Apply calculated widths within constraints
  columnWidths.forEach((width, i) => {
    const constrainedWidth = Math.min(Math.max(width, minWidth), maxWidth)
    worksheet.getColumn(i + 1).width = constrainedWidth
  })
}

export function splitIntoChunks<T>(array: T[], chunkSize: number | undefined): T[][] {
  if (!chunkSize)
    return [array]
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize)
    chunks.push(array.slice(i, i + chunkSize))

  return chunks
}

export function tableHasSummary(table: ReturnType<typeof buildSheetConfig>[number]['tables'][number]) {
  return table.enableSummary
    && table.columns.some(column => column._ref?.summary?.length)
}

export function tableSummaryRowLength(table: ReturnType<typeof buildSheetConfig>[number]['tables'][number]) {
  return table.columns.reduce((acc, column) => {
    const columnSummaryLength = column._ref?.summary?.length ?? 0
    return Math.max(acc, columnSummaryLength)
  }, 0)
}

export function getColumnSeparatorIndexes(params: {
  offset: number
  sheetConfig: ReturnType<typeof buildSheetConfig>[number]
}) {
  return params.sheetConfig.tables.map((table, index) => {
    if (index === params.sheetConfig.tables.length - 1)
      return []

    const tableConfig = params.sheetConfig.tables[index]
    const colsCount = tableConfig.columns.length
    return Array.from({ length: params.offset }, (_, i) => colsCount + i)
  }).flat()
}

export function createCell(params: {
  worksheet: Worksheet
  row: number
  col: number
  data?: GenericObject
  value?: BaseCellValue
  style?: Partial<Style> | ((rowData: any, rowIndex: number, subRowIndex: number) => Partial<Style>)
  format?: string | FormatterPreset<any> | ((rowData: any, rowIndex: number, subRowIndex: number) => string | FormatterPreset<any>)
  extraStyle?: Partial<Style>
  bordered?: boolean
  rowIndex?: number
  subRowIndex?: number
  formatPresets: FormattersMap
}): Cell {
  const cell = params.worksheet.getCell(params.row, params.col)
  const value = params.value === null ? '' : params.value

  cell.value = value

  const style = typeof params.style === 'function'
    ? params.style(params.data ?? {}, params?.rowIndex ?? 0, params?.subRowIndex ?? 0)
    : params.style ?? {}

  const rawFormat = typeof params.format === 'function'
    ? params.format(params.data ?? {}, params?.rowIndex ?? 0, params?.subRowIndex ?? 0)
    : params.format

  const format = typeof rawFormat === 'string'
    ? rawFormat
    : rawFormat?.preset
      ? params.formatPresets[rawFormat.preset as unknown as string]
        ? typeof params.formatPresets[rawFormat.preset as unknown as string] === 'function'
          ? (params.formatPresets[rawFormat.preset as unknown as string] as Function)(rawFormat.params)
          : params.formatPresets[rawFormat.preset as unknown as string]
        : ''
      : rawFormat

  const combinedStyle = deepmerge(
    {
      border: (params.bordered ?? true) ? THIN_BORDER_STYLE : {},
      alignment: { vertical: 'middle' },
      numFmt: format,
    },
    style,
    params.extraStyle ?? {},
  ) as Partial<Style>

  applyStyles(cell, combinedStyle)

  return cell
}

export function createStreamCell(params: {
  row: Row
  colIndex: number
  value?: BaseCellValue
  style?: Partial<Style>
  format?: string
  bordered?: boolean
}): Cell {
  const cell = params.row.getCell(params.colIndex)
  const value = params.value === null ? '' : params.value

  cell.value = value

  const combinedStyle: Partial<Style> = {
    border: (params.bordered ?? true)
      ? {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
      : {},
    alignment: { vertical: 'middle' },
    numFmt: params.format,
    ...params.style,
  }

  applyStyles(cell, combinedStyle)

  return cell
}

export class TableCacheManager {
  private table: ReturnType<typeof buildSheetConfig>[number]['tables'][number]
  private rows: GenericObject[]
  private rowMaxHeight: Map<number, number> = new Map()
  private prevRowsHeight: Map<number, number> = new Map()
  private cellValue: Map<string, BaseCellValue[]> = new Map()
  private nbExtraRows: number = 0

  constructor(table: ReturnType<typeof buildSheetConfig>[number]['tables'][number]) {
    this.table = table
    this.rows = table.content

    table.content.forEach((row, rowIndex) => {
      const rowHeight = this.calculateRowMaxHeight(rowIndex)
      const _prevRowsHeight = (this.getPrevRowsHeight(rowIndex - 1) ?? 0) + (this.getRowMaxHeight(rowIndex - 1) ?? 0)
      this.rowMaxHeight.set(rowIndex, rowHeight)
      this.prevRowsHeight.set(rowIndex, _prevRowsHeight)

      table.columns.forEach((column, columnIndex) => {
        const cellValue = this.calculateCellValue(row, rowIndex, column.value)
        this.cellValue.set(`${columnIndex}:${rowIndex}`, cellValue)
      })
    })

    this.nbExtraRows = table.columns.reduce((acc, _, columnIndex) => {
      return Math.max(acc, table.content.reduce((acc, _, rowIndex) => {
        const values = this.getCellValue({ columnIndex, rowIndex })
        return values.length - 1 + acc
      }, 0))
    }, 0)
  }

  private calculateRowMaxHeight(rowIndex: number): number {
    return this.table.columns.reduce((acc, column) => {
      const row = this.table.content[rowIndex]
      const _resolvedValue = column.value(row, rowIndex)
      const values = Array.isArray(_resolvedValue) ? _resolvedValue : [_resolvedValue]
      return Math.max(acc, values.length)
    }, 1)
  }

  private calculateCellValue(row: GenericObject, rowIndex: number, valueFn: any): BaseCellValue[] {
    const _resolvedValue = valueFn(row, rowIndex)
    return Array.isArray(_resolvedValue) ? _resolvedValue : [_resolvedValue]
  }

  getTableHeight(): number {
    return Array.from(this.rowMaxHeight.values()).reduce((acc, rowHeight) => acc + rowHeight, 0)
  }

  getPrevRowsHeight(rowIndex: number): number {
    return this.prevRowsHeight.get(rowIndex) ?? 0
  }

  getRowMaxHeight(rowIndex: number): number {
    return this.rowMaxHeight.get(rowIndex) ?? 0
  }

  getCellValue({ columnIndex, rowIndex }: { columnIndex: number, rowIndex: number }): BaseCellValue[] {
    return this.cellValue.get(`${columnIndex}:${rowIndex}`) ?? []
  }

  getNbExtraRows(): number {
    return this.nbExtraRows
  }
}

export class SheetCacheManager {
  private computedSheets: Map<number, {
    sheet: ReturnType<typeof buildSheetConfig>[number]
    tables: Map<number, { table: ReturnType<typeof buildSheetConfig>[number]['tables'][number], cache: TableCacheManager }>
    chunks: Array<{
      tables: Array<number>
      maxHeight: number
      hasTitle: boolean
    }>
  }> = new Map()

  constructor(sheets: ReturnType<typeof buildSheetConfig>) {
    sheets.forEach((sheet, sheetIndex) => {
      const chunks = splitIntoChunks(sheet.tables, sheet.params?.tablesPerRow)
      const tables = new Map<number, { table: ReturnType<typeof buildSheetConfig>[number]['tables'][number], cache: TableCacheManager }>()

      sheet.tables.forEach((table, tableIndex) => tables.set(tableIndex, { table, cache: new TableCacheManager(table) }))

      this.computedSheets.set(sheetIndex, {
        sheet,
        tables,
        chunks: chunks.map((tables, chunkIndex) => ({
          tables: tables.map((_, tableIndex) => tableIndex + chunkIndex * (sheet.params?.tablesPerRow ?? 1)),
          maxHeight: this.getSheetChunkMaxHeight(tables),
          hasTitle: tables.some(table => !!table.title),
        })),
      })
    })
  }

  private getSheetChunkMaxHeight(
    tables: ReturnType<typeof buildSheetConfig>[number]['tables'],
  ) {
    return tables.reduce((acc, table) => {
      const hasTitle = !!table.title
      const summaryRowLength = tableSummaryRowLength(table)

      const maxRowSpan = table.content.reduce((max, row, rowIndex) => {
        return Math.max(max, ...table.columns.map((column) => {
          const values = column.value(row, rowIndex)
          return Array.isArray(values) ? values.length : 1
        }))
      }, 1)

      const tableHeight = (table.content.length * maxRowSpan) + 1 + summaryRowLength + (hasTitle ? 1 : 0)
      return Math.max(acc, tableHeight)
    }, 0)
  }

  getSheets() {
    return Array.from(this.computedSheets.values())
  }

  getSheetChunk(params: { sheetIndex: number, chunkIndex: number }) {
    return this.computedSheets.get(params.sheetIndex)?.chunks[params.chunkIndex]
  }

  getSheetTable(params: { sheetIndex: number, tableIndex: number }) {
    return this.computedSheets.get(params.sheetIndex)!.tables.get(params.tableIndex)!
  }
}
