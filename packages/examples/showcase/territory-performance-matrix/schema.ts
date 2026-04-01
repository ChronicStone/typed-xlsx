import { createExcelSchema } from "@chronicstone/typed-xlsx";
import type { TerritoryRow } from "./data";

export const territoryPerformanceSchema = createExcelSchema<TerritoryRow>({ mode: "excel-table" })
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
  .group("regions", (group, regions: string[]) => {
    for (const region of regions) {
      group.column(region, {
        header: region,
        accessor: (row) => row.revenueByRegion[region] ?? 0,
        style: { numFmt: '"$"#,##0', alignment: { horizontal: "right" } },
        totalsRow: { function: "sum" },
      });
    }
  })
  .column("regionalTotal", {
    header: "Regional Total",
    formula: ({ row }) => row.group("regions").sum(),
    style: { numFmt: '"$"#,##0', alignment: { horizontal: "right" }, font: { bold: true } },
    totalsRow: { function: "sum" },
  })
  .column("regionalAverage", {
    header: "Regional Avg",
    formula: ({ row, fx }) => fx.round(row.group("regions").average(), 0),
    style: { numFmt: '"$"#,##0', alignment: { horizontal: "right" } },
    totalsRow: { function: "average" },
  })
  .build();
