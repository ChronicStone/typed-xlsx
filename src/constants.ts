import type { Borders } from 'exceljs'

// ExcelJS BorderStyle uses string values directly
export const THIN_BORDER_STYLE: Partial<Borders> = {
  top: { style: 'thin' },
  right: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
}

export const THICK_BORDER_STYLE: Partial<Borders> = {
  top: { style: 'medium' },
  right: { style: 'medium' },
  bottom: { style: 'medium' },
  left: { style: 'medium' },
}
