import { createExcelSchema } from "@chronicstone/typed-xlsx";
import type { LogicalPhysicalRow } from "./data";

export const logicalVsPhysicalSummarySchema = createExcelSchema<LogicalPhysicalRow>()
  .column("customer", {
    header: "Customer",
    accessor: "customer",
    minWidth: 20,
    summary: (summary) => [
      summary.label("Physical total"),
      summary.label("Physical average"),
      summary.label("Logical average"),
      summary.label("Logical sum"),
    ],
  })
  .column("segment", {
    header: "Segment",
    accessor: "segment",
    minWidth: 14,
  })
  .column("monthlyAmount", {
    header: "Monthly Amount",
    accessor: (row) => row.monthlyAmounts,
    minWidth: 14,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
    summary: (summary) => [
      summary.formula("sum"),
      summary.formula(({ column }) => column.cells().average()),
      summary.formula(({ column }) => column.rows().average((row) => row.cells().average())),
      summary.formula(({ column }) => column.rows().sum((row) => row.cells().average())),
    ],
  })
  .column("rowAverage", {
    header: "Row Avg",
    formula: ({ row, fx }) => fx.round(row.series("monthlyAmount").average(), 2),
    expansion: "single",
    minWidth: 12,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
    summary: (summary) => [
      summary.empty(),
      summary.empty(),
      summary.formula(({ column }) => column.rows().average((row) => row.cells().average())),
      summary.empty(),
    ],
  })
  .column("rowTotal", {
    header: "Row Total",
    formula: ({ row, fx }) => fx.round(row.series("monthlyAmount").sum(), 2),
    expansion: "single",
    minWidth: 12,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
    summary: (summary) => [
      summary.empty(),
      summary.empty(),
      summary.empty(),
      summary.formula(({ column }) => column.rows().sum((row) => row.cells().average())),
    ],
  })
  .build();
