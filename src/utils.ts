import { type CellStyle, type ExcelDataType, type WorkSheet, utils } from 'xlsx-js-style'
import type { CellValue, Column, GenericObject, SheetConfig, ValueTransformer } from './types'

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
    tables: sheet.tables.map(table => ({
      content: table.data,
      summary: table.schema.summary,
      enableSummary: table.summary ?? true,
      columns: table.schema
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
            return columns as Column<any, any, any, any>[]
          }
        })
        .flat()
        .map((column) => {
          return {
            label: column?.label ?? formatKey(column.columnKey),
            value: (row: GenericObject) => {
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
            _ref: column,
          }
        }),
    }),
    ),
  }))
}

export function getColumnHeaderStyle(params: { bordered: boolean }) {
  return {
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
