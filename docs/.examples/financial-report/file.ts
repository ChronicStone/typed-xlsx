import { ExcelBuilder } from '@chronicstone/typed-xlsx'
import { generateFinancialReportData } from './data'
import { financialReportSchema } from './schema'

export const financialReportExcel = ExcelBuilder.create()
  .sheet('Financial Report | Full')
  .addTable({
    data: generateFinancialReportData(10, 3),
    schema: financialReportSchema,
  })
  .build({ output: 'buffer' })
