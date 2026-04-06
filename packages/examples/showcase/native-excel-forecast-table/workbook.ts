import { createWorkbook } from "xlsmith";
import { createForecastRows } from "./data";
import { nativeForecastSchema } from "./schema";

export function buildNativeExcelForecastTableWorkbook() {
  const workbook = createWorkbook();

  workbook.sheet("Forecast Table").table("forecast", {
    rows: createForecastRows(),
    schema: nativeForecastSchema,
    name: "ForecastTable",
    style: "TableStyleMedium2",
    totalsRow: true,
    autoFilter: true,
  });

  return workbook.toUint8Array();
}

export const buildArtifact = buildNativeExcelForecastTableWorkbook;
