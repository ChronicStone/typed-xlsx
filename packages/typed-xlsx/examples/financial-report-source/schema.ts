import { createExcelSchema, type CellStyle } from "../../src";
import type { FinancialReport } from "./data";

function currencyStyle(): CellStyle {
  return {
    numFmt: "$#,##0.00",
  };
}

function profitColor(rgb: string): CellStyle {
  return {
    font: {
      color: { rgb },
    },
  };
}

export const financialReportSchema = createExcelSchema<FinancialReport>()
  .column("month", {
    header: "Month",
    accessor: "month",
    format: "MMM YYYY",
  })
  .column("departmentName", {
    header: "Department",
    accessor: (row) => row.departments.map((department) => department.name),
  })
  .column("revenue", {
    header: "Revenue",
    accessor: (row) => row.departments.map((department) => department.revenue),
    style: currencyStyle(),
  })
  .column("expenses", {
    header: "Expenses",
    accessor: (row) => row.departments.map((department) => department.expenses),
    style: currencyStyle(),
  })
  .column("profit", {
    header: "Profit",
    accessor: (row) => row.departments.map((department) => department.profit),
    style: (row, _rowIndex, subRowIndex) =>
      ({
        ...currencyStyle(),
        ...profitColor(row.departments[subRowIndex]?.profit >= 0 ? "007500" : "FF0000"),
      }) satisfies CellStyle,
  })
  .column("profitMargin", {
    header: "Profit Margin",
    accessor: (row) => row.departments.map((department) => `${department.profitMargin}%`),
    style: (row, _rowIndex, subRowIndex) =>
      profitColor(row.departments[subRowIndex]?.profitMargin >= 0 ? "007500" : "FF0000"),
  })
  .column("totalRevenue", {
    header: "Total Revenue",
    accessor: "totalRevenue",
    style: currencyStyle(),
    summary: (summary) => [
      summary.cell({
        init: () => 0,
        step: (acc: number, row) => acc + row.totalRevenue,
        finalize: (acc: number) => acc,
        style: currencyStyle(),
      }),
    ],
  })
  .column("totalExpenses", {
    header: "Total Expenses",
    accessor: "totalExpenses",
    style: currencyStyle(),
    summary: (summary) => [
      summary.cell({
        init: () => 0,
        step: (acc: number, row) => acc + row.totalExpenses,
        finalize: (acc: number) => acc,
        style: currencyStyle(),
      }),
    ],
  })
  .column("totalProfit", {
    header: "Total Profit",
    accessor: "totalProfit",
    style: (row) =>
      ({
        ...currencyStyle(),
        ...profitColor(row.totalProfit >= 0 ? "007500" : "FF0000"),
      }) satisfies CellStyle,
    summary: (summary) => [
      summary.cell({
        init: () => 0,
        step: (acc: number, row) => acc + row.totalProfit,
        finalize: (acc: number) => acc,
        style: (value) =>
          ({
            ...currencyStyle(),
            ...profitColor((Number(value) || 0) >= 0 ? "007500" : "FF0000"),
          }) satisfies CellStyle,
      }),
    ],
  })
  .column("averageProfitMargin", {
    header: "Average Profit Margin",
    accessor: "averageProfitMargin",
    style: (row) => ({
      numFmt: "0.00%",
      ...profitColor(row.averageProfitMargin >= 0 ? "007500" : "FF0000"),
    }),
    summary: (summary) => [
      summary.cell({
        init: () => ({ total: 0, count: 0 }),
        step: (acc: { total: number; count: number }, row) => ({
          total: acc.total + row.averageProfitMargin,
          count: acc.count + 1,
        }),
        finalize: (acc: { total: number; count: number }) =>
          acc.count > 0 ? acc.total / acc.count : 0,
        style: (value) => ({
          numFmt: "0.00%",
          ...profitColor((Number(value) || 0) >= 0 ? "007500" : "FF0000"),
        }),
      }),
    ],
  })
  .build();
