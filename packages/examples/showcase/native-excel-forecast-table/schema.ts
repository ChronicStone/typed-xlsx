import { createExcelSchema } from "@chronicstone/typed-xlsx";
import type { ForecastRow } from "./data";

export const nativeForecastSchema = createExcelSchema<ForecastRow>({ mode: "excel-table" })
  .column("repName", {
    header: "Rep",
    accessor: "repName",
    totalsRow: { label: "TOTAL" },
  })
  .column("territory", { header: "Territory", accessor: "territory", minWidth: 14 })
  .column("stage", { header: "Stage", accessor: "stage", minWidth: 12 })
  .column("units", {
    header: "Units",
    accessor: "units",
    totalsRow: { function: "sum" },
    style: { alignment: { horizontal: "right" } },
  })
  .column("revenue", {
    header: "Revenue",
    accessor: "revenue",
    totalsRow: { function: "sum" },
    style: { numFmt: '"$"#,##0', alignment: { horizontal: "right" } },
  })
  .column("avgPrice", {
    header: "Avg Price",
    formula: ({ refs, fx }) => fx.round(refs.column("revenue").div(refs.column("units")), 2),
    totalsRow: { label: "-" },
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
  })
  .column("closeMonth", {
    header: "Close Month",
    accessor: "closeMonth",
    totalsRow: { function: "max" },
  })
  .build();
