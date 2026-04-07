import { createExcelSchema } from "typed-xlsx";
import type { TerritoryRow } from "./data";

export const territoryPerformanceSchema = createExcelSchema<TerritoryRow, { regions: string[] }>({
  mode: "excel-table",
})
  .column("territory", {
    header: "Territory",
    accessor: "territory",
    minWidth: 18,
    totalsRow: { label: "TOTAL" },
  })
  .column("manager", {
    header: "Manager",
    accessor: "manager",
    minWidth: 16,
  })
  .column("quarter", {
    header: "Quarter",
    accessor: "quarter",
    width: 10,
  })
  .dynamic("regions", (builder, { ctx }) => {
    for (const region of ctx.regions) {
      builder.column(region, {
        header: region,
        accessor: (row) => row.revenueByRegion[region] ?? 0,
        style: { numFmt: '"$"#,##0', alignment: { horizontal: "right" } },
        totalsRow: { function: "sum" },
      });
    }
  })
  .column("regionalTotal", {
    header: "Regional Total",
    formula: ({ refs, fx }) => fx.sum(refs.dynamic("regions")),
    style: { numFmt: '"$"#,##0', alignment: { horizontal: "right" }, font: { bold: true } },
    totalsRow: { function: "sum" },
  })
  .column("regionalAverage", {
    header: "Regional Avg",
    formula: ({ refs, fx }) => fx.round(fx.average(refs.dynamic("regions")), 0),
    style: { numFmt: '"$"#,##0', alignment: { horizontal: "right" } },
    totalsRow: { function: "average" },
  })
  .build();
