import { faker } from '@faker-js/faker'

export interface FinancialReport {
  month: string
  departments: DepartmentData[]
  totalRevenue: number
  totalExpenses: number
  totalProfit: number
  averageProfitMargin: number
  operatingCashFlow: number
  investingCashFlow: number
  financingCashFlow: number
  grossMargin: number
  EBIT: number
  debtToEquityRatio: number
  ROI: number
  YoYGrowth: number
}

export interface DepartmentData {
  name: string
  revenue: number
  targetRevenue: number
  expenses: number
  profit: number
  profitMargin: number
  revenueAchievement: number
  growth: number
  COGS: number // New field for Cost of Goods Sold
}

export function generateFinancialReportData(months: number, departmentsPerMonth: number): FinancialReport[] {
  const departments = ['Sales', 'Marketing', 'R&D', 'Customer Support', 'Human Resources']

  return Array.from({ length: months }, () => {
    const month = faker.date.between({ from: '2023-01-01', to: '2023-12-31' }).toISOString().slice(0, 7)
    let totalRevenue = 0
    let totalExpenses = 0
    let totalProfit = 0
    let totalProfitMargin = 0
    let totalCOGS = 0

    const departmentData = Array.from({ length: departmentsPerMonth }, () => {
      const name = faker.helpers.arrayElement(departments)
      const targetRevenue = faker.number.int({ min: 20000, max: 120000 })
      const revenue = faker.number.int({ min: 10000, max: 100000 })
      const expenses = faker.number.int({ min: 5000, max: 50000 })
      const profit = revenue - expenses
      const COGS = faker.number.int({ min: 2000, max: 40000 })
      const profitMargin = Number.parseFloat(((profit / revenue) * 100).toFixed(2))

      totalRevenue += revenue
      totalExpenses += expenses
      totalProfit += profit
      totalProfitMargin += profitMargin
      totalCOGS += COGS

      return {
        name,
        revenue,
        targetRevenue,
        expenses,
        profit,
        profitMargin,
        revenueAchievement: Number.parseFloat(((revenue / targetRevenue) * 100).toFixed(2)),
        growth: revenue - targetRevenue,
        COGS,
      }
    })

    const grossMargin = totalRevenue > 0 ? Number.parseFloat(((totalRevenue - totalCOGS) / totalRevenue * 100).toFixed(2)) : 0
    const averageProfitMargin = departmentsPerMonth > 0 ? totalProfitMargin / departmentsPerMonth : 0

    return {
      month,
      departments: departmentData,
      totalRevenue,
      totalExpenses,
      totalProfit,
      averageProfitMargin,
      operatingCashFlow: faker.number.int({ min: 1000, max: 30000 }),
      investingCashFlow: faker.number.int({ min: -20000, max: 10000 }),
      financingCashFlow: faker.number.int({ min: -10000, max: 5000 }),
      grossMargin,
      EBIT: totalProfit - faker.number.int({ min: 1000, max: 5000 }),
      debtToEquityRatio: Number.parseFloat(faker.finance.amount({ min: 2000, max: 40000, dec: 2, symbol: '%', autoFormat: true })),
      ROI: Number.parseFloat(faker.finance.amount({ min: 2000, max: 40000, dec: 2, symbol: '%', autoFormat: true })),
      YoYGrowth: Number.parseFloat(faker.finance.amount({ min: -5000, max: 5000, dec: 2, symbol: '%', autoFormat: true })),
    }
  })
}
