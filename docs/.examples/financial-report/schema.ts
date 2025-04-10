import { ExcelSchemaBuilder } from '../../../src'
import type { FinancialReport } from './data'

export const financialReportSchema = ExcelSchemaBuilder.create<FinancialReport>()
  .column('month', { accessor: 'month', label: 'Month', format: 'MMM YYYY' })
  .column('Department Name', {
    accessor: 'departments',
    label: 'Department',
    transform: departments => departments.map(d => d.name),
  })
  .column('Revenue', {
    accessor: 'departments',
    label: 'Revenue',
    transform: departments => departments.map(d => d.revenue),
    format: '$#,##0.00',
  })
  .column('Expenses', {
    accessor: 'departments',
    label: 'Expenses',
    transform: departments => departments.map(d => d.expenses),
    format: '$#,##0.00',
  })
  .column('Profit', {
    accessor: 'departments',
    label: 'Profit',
    transform: departments => departments.map(d => d.profit),
    format: '$#,##0.00',
    cellStyle: (data, _, valueIndex) => ({
      font: { color: { argb: data.departments[valueIndex].profit >= 0 ? '007500' : 'FF0000' } },
    }),
  })
  .column('Profit Margin', {
    accessor: row => row.departments.map(d => d.profitMargin),
    label: 'Profit Margin',
    format: '0.00%',
    cellStyle: (data, _, valueIndex) => ({
      font: { color: { argb: data.departments[valueIndex].profitMargin >= 0 ? '007500' : 'FF0000' } },
    }),
  })
  .column('totalRevenue', {
    accessor: 'totalRevenue',
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
    accessor: 'totalExpenses',
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
    accessor: 'totalProfit',
    label: 'Total Profit',
    format: '$#,##0.00',
    summary: [
      {
        value: data => data.reduce((acc, item) => acc + item.totalProfit, 0),
        format: () => '$#,##0.00',
        cellStyle: data => ({
          font: { color: { argb: data.reduce((acc, item) => acc + item.totalProfit, 0) >= 0 ? '007500' : 'FF0000' } },
        }),
      },
    ],
    cellStyle: data => ({
      font: { color: { argb: data.totalProfit >= 0 ? '007500' : 'FF0000' } },
    }),
  })
  .column('averageProfitMargin', {
    accessor: 'averageProfitMargin',
    label: 'Average Profit Margin',
    format: '0.00%',
    summary: [
      {
        value: data => data.reduce((acc, item) => acc + item.averageProfitMargin, 0) / data.length,
        format: () => '0.00%',
        cellStyle: data => ({
          font: { color: { argb: data.reduce((acc, item) => acc + item.averageProfitMargin, 0) / data.length >= 0 ? '007500' : 'FF0000' } },
        }),
      },
    ],
    cellStyle: data => ({
      font: { color: { argb: data.averageProfitMargin >= 0 ? '007500' : 'FF0000' } },
    }),
  })
  .build()
