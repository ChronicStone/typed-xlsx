import type { ExcelDataType } from 'xlsx-js-style'
import type { CellValue, GenericObject } from './types'

export function getPropertyFromPath(obj: GenericObject, path: string) {
  try {
    return path.split('.').reduce((o, i) => o && o[i], obj)
  }
  catch (err) {
    return undefined
  }
}

export function getSheetCellKey(col: number, row: number) {
  let columnLabel = ''

  while (col > 0) {
    col--
    const remainder = col % 26
    columnLabel = String.fromCharCode(65 + remainder) + columnLabel
    col = Math.floor(col / 26)
  }

  return columnLabel + row
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
