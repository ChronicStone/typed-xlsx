import { ExcelBuilder } from '../../../src'
import { generateFinancialReportData } from './data'
import { financialReportSchema } from './schema'

export const financialReportExcel = await ExcelBuilder.create()
  .sheet('Financial Report | Full', { autoFormat: { headerWidthFactor: 1.5 } })
  .addTable({
    data: generateFinancialReportData(10, 3),
    schema: financialReportSchema,
  })
  .build({ output: 'buffer' })
