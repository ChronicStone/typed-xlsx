import { utils } from 'xlsx-js-style'
import type XLSX from 'xlsx-js-style'
import type { CellStyle, ExcelDataType, WorkSheet } from 'xlsx-js-style'
import { deepmerge } from 'deepmerge-ts'
import type { BaseCellValue, CellValue, Column, GenericObject, SheetConfig, ValueTransformer } from './types'
import { THICK_BORDER_STYLE, THIN_BORDER_STYLE } from './const'

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

export function getCellDataType(value: CellValue): ExcelDataType {
  if (value instanceof Date)
    return 'd'
  if (typeof value === 'number')
    return 'n'
  if (typeof value === 'boolean')
    return 'b'
  return 's'
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
        .map((column): Column<any, any, any, any> | Column<any, any, any, any>[] => {
          if (column.type === 'column') {
            return column
          }
          else {
            const builder = column.builder()
            column.handler(builder, ((table.context ?? {}) as any)[column.columnKey])
            const { columns } = builder.build()
            return (columns as Column<any, any, any, any>[])
          }
        })
        .flat()
        .map((column) => {
          return {
            label: column?.label ?? formatKey(column.columnKey),
            value: (row: GenericObject, index: number): CellValue => {
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

              const transformedVal = column.transform ? (column.transform as ValueTransformer)(value, index) : value
              return (Array.isArray(transformedVal) && !transformedVal.length) ? column.default ?? null : transformedVal
            },
            _ref: column,
          }
        })

      return {
        title: table.title,
        content: table.data,
        columns,
        enableSummary: table.summary ?? true,
      }
    }),
  }))
}

export function getColumnHeaderStyle(params: { bordered: boolean }) {
  return {
    font: { bold: true },
    alignment: { horizontal: 'center', vertical: 'center' },
    fill: { fgColor: { rgb: 'E9E9E9' } },
    border: (params?.bordered ?? true)
      ? THICK_BORDER_STYLE
      : {},
  } satisfies CellStyle
}

export function getWorksheetColumnWidths(worksheet: WorkSheet, extraLength: number = 1) {
  const columnLetters: string[] = getWorksheetColumnIds(worksheet)

  return columnLetters.map((column) => {
    const columnCells: string[] = Object.keys(worksheet).filter(cell => cell.replace(/[0-9]/g, '') === column)
    const maxWidthCell = columnCells.reduce((maxWidth, cellId) => {
      const cell = worksheet[cellId]
      const cellContentLength: number = getCellValueLength(cell.v)

      if (!cell.z)
        return Math.max(maxWidth, cellContentLength)

      const cellFormatLength: number = cell.z.length
      const largestWidth: number = Math.max(cellContentLength, cellFormatLength)
      return Math.max(maxWidth, largestWidth)
    }, 0)

    return { wch: maxWidthCell + extraLength }
  })
}

function getCellValueLength(object: unknown): number {
  if (typeof object === 'string')
    return Math.max(...object.split('\n').map(string => string.length))

  if (typeof object === 'number')
    return object.toString().length

  if (typeof object === 'boolean')
    return object ? 'true'.length : 'false'.length

  if (object instanceof Date)
    return object.toString().length

  return 0
}

function getWorksheetColumnIds(worksheet: WorkSheet): string[] {
  const columnRange = utils.decode_range(worksheet['!ref'] ?? '')

  const columnIds: string[] = []
  for (let C = columnRange.s.c; C <= columnRange.e.c; C++) {
    const address = utils.encode_col(C)
    columnIds.push(address)
  }

  return columnIds
}

export function splitIntoChunks<T>(array: T[], chunkSize: number | undefined): T[][] {
  if (!chunkSize)
    return [array]
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize)
    chunks.push(array.slice(i, i + chunkSize))

  return chunks
}

export function getSheetChunkMaxHeight(
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

export function computeSheetRange(sheetRows: Array<ReturnType<typeof buildSheetConfig>[number]['tables']>) {
  const sheetWidth = sheetRows.reduce((acc, tables) => {
    const rowWidth = tables.reduce((acc, table) => {
      const tableWidth = table.columns.length
      return acc + tableWidth + 1
    }, 0)
    return Math.max(acc, rowWidth)
  }, 0)

  const sheetHeight = sheetRows.reduce((acc, tables) => {
    const rowHeight = tables.reduce((acc, table) => {
      const hasTitle = !!table.title
      const summaryRowLength = tableSummaryRowLength(table)

      const maxRowSpan = table.columns.reduce((max, column) => {
        return Math.max(max, table.content.reduce((maxRow, row, rowIndex) => {
          const values = column.value(row, rowIndex)
          return Array.isArray(values) ? Math.max(maxRow, values.length) : maxRow
        }, 1))
      }, 1)

      const tableHeight = (table.content.length * maxRowSpan) + summaryRowLength + (hasTitle ? 1 : 0)
      return Math.max(acc, tableHeight)
    }, 0)
    return acc + rowHeight + 1
  }, 0)

  return {
    sheetHeight,
    sheetWidth,
    sheetRange: utils.encode_range({ s: { c: 0, r: 0 }, e: { c: sheetWidth - 1, r: sheetHeight - 1 } }), // Adjust end column and row index by subtracting 1
  }
}

export function formulaeBuilder<
  ColKeys extends string,
>(cols: ColKeys) {
  return {
    sum: (start: number, end: number) => `SUM(${cols}${start}:${cols}${end})`,
    count: (start: number, end: number) => `COUNT(${cols}${start}:${cols}${end})`,
    average: (start: number, end: number) => `AVERAGE(${cols}${start}:${cols}${end})`,
    max: (start: number, end: number) => `MAX(${cols}${start}:${cols}${end})`,
    min: (start: number, end: number) => `MIN(${cols}${start}:${cols}${end})`,
  }
}

export function applyGroupBorders(worksheet: WorkSheet, params: { start: string, end: string }) {
  const start = utils.decode_cell(params.start)
  const end = utils.decode_cell(params.end)

  for (let r = start.r; r <= end.r; r++) {
    for (let c = start.c; c <= end.c; c++) {
      const cellRef = utils.encode_cell({ c, r })
      const cell = worksheet[cellRef] || { t: 'z' }

      cell.s = deepmerge(cell.s ?? {}, {
        border: {
          ...(cell.s?.border ?? {}),
        },
      })

      if (r === start.r)
        cell.s.border.top = THICK_BORDER_STYLE.top
      if (r === end.r)
        cell.s.border.bottom = THICK_BORDER_STYLE.bottom
      if (c === start.c)
        cell.s.border.left = THICK_BORDER_STYLE.left
      if (c === end.c)
        cell.s.border.right = THICK_BORDER_STYLE.right

      worksheet[cellRef] = cell
    }
  }
}

export function getPrevRowsHeight(params: {
  tableConfig: ReturnType<typeof buildSheetConfig>[number]['tables'][number]
  rowIndex: number
}) {
  return params.tableConfig.columns.reduce((acc, column) => {
    return Math.max(acc, params.tableConfig.content.filter((_, i) => i < params.rowIndex).reduce((acc, row, rowIndex) => {
      const value = column.value(row, rowIndex)
      return acc + (Array.isArray(value) ? value.length : 1)
    }, 0))
  }, 0)
}

export function getRowMaxHeight(params: {
  tableConfig: ReturnType<typeof buildSheetConfig>[number]['tables'][number]
  rowIndex: number
}) {
  return params.tableConfig.columns.reduce((acc, column) => {
    const row = params.tableConfig.content[params.rowIndex]
    const _resolvedValue = column.value(row, params.rowIndex)
    const values = Array.isArray(_resolvedValue) ? _resolvedValue : [_resolvedValue]
    return Math.max(acc, values.length)
  }, 1)
}

export function getCellValue(params: {
  row: GenericObject
  rowIndex: number
  value: ReturnType<typeof buildSheetConfig>[number]['tables'][number]['columns'][number]['value']
}) {
  const _resolvedValue = params.value(params.row, params.rowIndex)
  return Array.isArray(_resolvedValue) ? _resolvedValue : [_resolvedValue]
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
  data?: GenericObject
  value?: BaseCellValue
  style?: CellStyle | ((rowData: any, rowIndex: number, subRowIndex: number) => CellStyle)
  format?: string | ((rowData: any, rowIndex: number, subRowIndex: number) => string)
  extraStyle?: CellStyle
  bordered?: boolean
  rowIndex?: number
  subRowIndex?: number
}): XLSX.CellObject {
  const style = typeof params.style === 'function'
    ? params.style(params.data ?? {}, params?.rowIndex ?? 0, params?.subRowIndex ?? 0)
    : params.style ?? {}
  const format = typeof params.format === 'function'
    ? params.format(params.data ?? {}, params?.rowIndex ?? 0, params?.subRowIndex ?? 0)
    : params.format
  return {
    v: params.value === null ? '' : params.value,
    t: getCellDataType(params.value),
    z: format,
    s: deepmerge({
      border: (params.bordered ?? true)
        ? THIN_BORDER_STYLE
        : {},
      alignment: { vertical: 'center' },
      numFmt: format,
    }, style, params.extraStyle ?? {}),

  }
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
      const rowHeight = getRowMaxHeight({ tableConfig: this.table, rowIndex })
      const _prevRowsHeight = (this.getPrevRowsHeight(rowIndex - 1) ?? 0) + (this.getRowMaxHeight(rowIndex - 1) ?? 0)
      this.rowMaxHeight.set(rowIndex, rowHeight)
      this.prevRowsHeight.set(rowIndex, _prevRowsHeight)

      table.columns.forEach((column, columnIndex) => {
        const cellValue = getCellValue({ row, rowIndex, value: column.value })
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

  getPrevRowsHeight(rowIndex: number) {
    return this.prevRowsHeight.get(rowIndex) ?? 0
  }

  getRowMaxHeight(rowIndex: number) {
    return this.rowMaxHeight.get(rowIndex) ?? 0
  }

  getCellValue({ columnIndex, rowIndex }: { columnIndex: number, rowIndex: number }) {
    return this.cellValue.get(`${columnIndex}:${rowIndex}`) ?? []
  }

  getNbExtraRows() {
    return this.nbExtraRows
  }
}

function getSheetWidth(sheetRows: Array<ReturnType<typeof buildSheetConfig>[number]['tables']>) {
  return sheetRows.reduce((acc, tables) => {
    const rowWidth = tables.reduce((acc, table) => {
      const tableWidth = table.columns.length
      return acc + tableWidth + 1
    }, 0)
    return Math.max(acc, rowWidth)
  }, 0)
}

function getSheetHeight(
  sheetChunks: Array<ReturnType<typeof buildSheetConfig>[number]['tables']>,
  tableCaches: Map<number, { table: ReturnType<typeof buildSheetConfig>[number]['tables'][number], cache: TableCacheManager }>,
) {
  return sheetChunks.reduce((acc, tables) => {
    const chunkHeight = tables.reduce((acc, _, tableIndex) => {
      const { table, cache } = tableCaches.get(tableIndex)!
      const hasTitle = !!table.title
      const summaryRowLength = tableSummaryRowLength(table)

      const maxRowSpan = table.columns.reduce((max, _, columnIndex) => {
        return Math.max(max, table.content.reduce((maxRow, _, rowIndex) => {
          const values = cache.getCellValue({ columnIndex, rowIndex })
          return Array.isArray(values) ? Math.max(maxRow, values.length) : maxRow
        }, 1))
      }, 1)

      const tableHeight = (table.content.length * maxRowSpan) + summaryRowLength + (hasTitle ? 1 : 0)
      return Math.max(acc, tableHeight)
    }, 0)
    return acc + chunkHeight + 1
  }, 0)
}

function getSheetRange(params: { width: number, height: number }) {
  return utils.encode_range({ s: { c: 0, r: 0 }, e: { c: params.width - 1, r: params.height - 1 } }) // Adjust end column and row index by subtracting 1
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
    range: { height: number, width: number, range: string }
  }> = new Map()

  constructor(sheets: ReturnType<typeof buildSheetConfig>) {
    sheets.forEach((sheet, sheetIndex) => {
      const chunks = splitIntoChunks(sheet.tables, sheet.params?.tablesPerRow)
      const tables = new Map<number, { table: ReturnType<typeof buildSheetConfig>[number]['tables'][number], cache: TableCacheManager }>()

      sheet.tables.forEach((table, tableIndex) => tables.set(tableIndex, { table, cache: new TableCacheManager(table) }))
      const width = getSheetWidth(chunks)
      const height = getSheetHeight(chunks, tables)
      const range = getSheetRange({ width, height })
      this.computedSheets.set(sheetIndex, {
        sheet,
        tables,
        chunks: chunks.map((tables, chunkIndex) => ({
          tables: tables.map((_, tableIndex) => tableIndex + chunkIndex * (sheet.params?.tablesPerRow ?? 1)),
          maxHeight: getSheetChunkMaxHeight(tables),
          hasTitle: tables.some(table => !!table.title),
        })),
        range: { height, width, range },
      })
    })
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

  getSheetRange(params: { sheetIndex: number }) {
    return this.computedSheets.get(params.sheetIndex)!.range
  }
}
