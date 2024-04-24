import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
import type { FinancialReport } from './data'

export const financialReportSchema = ExcelSchemaBuilder.create<FinancialReport>()
  .column('month', { key: 'month', label: 'Month', format: 'mmm yyyy' })
  .column('Department Name', {
    key: 'departments',
    label: 'Department',
    transform: departments => departments.map(d => d.name),
  })
  .column('Revenue', {
    key: 'departments',
    label: 'Revenue',
    transform: departments => departments.map(d => d.revenue),
    format: '$#,##0.00',
  })
  .column('Expenses', {
    key: 'departments',
    label: 'Expenses',
    transform: departments => departments.map(d => d.expenses),
    format: '$#,##0.00',
  })
  .column('Profit', {
    key: 'departments',
    label: 'Profit',
    transform: departments => departments.map(d => d.profit),
    format: '$#,##0.00',
    cellStyle: (data, _, valueIndex) => ({
      font: { color: { rgb: data.departments[valueIndex].profit >= 0 ? '007500' : 'FF0000' } },
    }),
  })
  .column('Profit Margin', {
    key: 'departments',
    label: 'Profit Margin',
    transform: departments => departments.map(d => `${d.profitMargin}%`),
    cellStyle: (data, _, valueIndex) => ({
      font: { color: { rgb: data.departments[valueIndex].profitMargin >= 0 ? '007500' : 'FF0000' } },
    }),
  })
  .column('totalRevenue', {
    key: 'totalRevenue',
    label: 'Total Revenue',
    format: '$#,##0.00',
    summary: [
      {
        value: data => data.reduce((acc, item) => acc + item.totalRevenue, 0),
        format: () => '$#,##0.00',
      },
    ],
  })
  .column('totalExpenses', {
    key: 'totalExpenses',
    label: 'Total Expenses',
    format: '$#,##0.00',
    summary: [
      {
        value: data => data.reduce((acc, item) => acc + item.totalExpenses, 0),
        format: () => '$#,##0.00',
      },
    ],
  })
  .column('totalProfit', {
    key: 'totalProfit',
    label: 'Total Profit',
    format: '$#,##0.00',
    summary: [
      {
        value: data => data.reduce((acc, item) => acc + item.totalProfit, 0),
        format: () => '$#,##0.00',
        cellStyle: data => ({
          font: { color: { rgb: data.reduce((acc, item) => acc + item.totalProfit, 0) >= 0 ? '007500' : 'FF0000' } },
        }),
      },
    ],
    cellStyle: data => ({
      font: { color: { rgb: data.totalProfit >= 0 ? '007500' : 'FF0000' } },
    }),
  })
  .column('averageProfitMargin', {
    key: 'averageProfitMargin',
    label: 'Average Profit Margin',
    format: '0.00%',
    summary: [
      {
        value: data => data.reduce((acc, item) => acc + item.averageProfitMargin, 0) / data.length,
        format: () => '0.00%',
        cellStyle: data => ({
          font: { color: { rgb: data.reduce((acc, item) => acc + item.averageProfitMargin, 0) / data.length >= 0 ? '007500' : 'FF0000' } },
        }),
      },
    ],
    cellStyle: data => ({
      font: { color: { rgb: data.averageProfitMargin >= 0 ? '007500' : 'FF0000' } },
    }),
  })
  .build()
