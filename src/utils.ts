import type { GenericObject } from './types'

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
