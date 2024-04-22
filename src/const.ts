import type XLSX from 'xlsx-js-style'

export const THIN_BORDER_STYLE = {
  top: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
} satisfies XLSX.CellStyle['border']

export const THICK_BORDER_STYLE = {
  top: { style: 'medium', color: { rgb: '000000' } },
  left: { style: 'medium', color: { rgb: '000000' } },
  right: { style: 'medium', color: { rgb: '000000' } },
  bottom: { style: 'medium', color: { rgb: '000000' } },
} satisfies XLSX.CellStyle['border']
