import { type CellStyle, type ExcelDataType, type WorkSheet, utils } from 'xlsx-js-style'
import { deepmerge } from 'deepmerge-ts'
import type { CellValue, Column, GenericObject, SheetConfig, ValueTransformer } from './types'
import { THICK_BORDER_STYLE } from './const'

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
            // const childSummaryMap = Object.keys(summary as object).reduce((acc, key) => ({ [`${column.columnKey}:${key}`]: (summary as any)[key], ...acc }), {})
            // tableSummary = deepmerge(tableSummary, childSummaryMap)
            return (columns as Column<any, any, any, any>[])
            // .map(col => ({ ...col, key: `${column.columnKey}:${col.key}` }))
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
              return (Array.isArray(transformedVal) && !transformedVal.length) ? null : transformedVal
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

    // Calculate the maximum row span needed for any row within this table using .reduce
    const maxRowSpan = table.content.reduce((max, row, rowIndex) => {
      return Math.max(max, ...table.columns.map((column) => {
        const values = column.value(row, rowIndex)
        return Array.isArray(values) ? values.length : 1
      }))
    }, 1) // Start with 1 as the minimum span

    // Calculate the total height of the table, considering the max row span
    const tableHeight = (table.content.length * maxRowSpan) + 1 + summaryRowLength + (hasTitle ? 1 : 0)

    return Math.max(acc, tableHeight) // Update the accumulated maximum with the current table's height
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
      return acc + tableWidth + 1 // Includes space for column separation
    }, 0)
    return Math.max(acc, rowWidth)
  }, 0)

  const sheetHeight = sheetRows.reduce((acc, tables) => {
    const rowHeight = tables.reduce((acc, table) => {
      const hasTitle = !!table.title
      const summaryRowLength = tableSummaryRowLength(table)

      // Compute max row span due to multi-value columns
      const maxRowSpan = table.columns.reduce((max, column) => {
        return Math.max(max, table.content.reduce((maxRow, row, rowIndex) => {
          const values = column.value(row, rowIndex)
          return Array.isArray(values) ? Math.max(maxRow, values.length) : maxRow
        }, 1))
      }, 1)

      const tableHeight = (table.content.length * maxRowSpan) + summaryRowLength + (hasTitle ? 1 : 0)
      return Math.max(acc, tableHeight) // We find the maximum height needed for any table in the row
    }, 0)
    return acc + rowHeight + 1 // Adding each row's height plus one for spacing between rows
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
  const start = utils.decode_cell(params.start) // e.g., {c: 0, r: 0} for 'A1'
  const end = utils.decode_cell(params.end) // e.g., {c: 1, r: 2} for 'B3'

  for (let r = start.r; r <= end.r; r++) {
    for (let c = start.c; c <= end.c; c++) {
      const cellRef = utils.encode_cell({ c, r })
      const cell = worksheet[cellRef] || { t: 'z' } // Ensure the cell exists

      // Default to thin borders
      cell.s = deepmerge(cell.s ?? {}, {
        border: {
          ...(cell.s?.border ?? {}),
        },
      })

      // Adjust borders for cells on the boundary of the range
      if (r === start.r)
        cell.s.border.top = THICK_BORDER_STYLE.top
      if (r === end.r)
        cell.s.border.bottom = THICK_BORDER_STYLE.bottom
      if (c === start.c)
        cell.s.border.left = THICK_BORDER_STYLE.left
      if (c === end.c)
        cell.s.border.right = THICK_BORDER_STYLE.right

      worksheet[cellRef] = cell // Apply the styled cell back to the worksheet
    }
  }
}
