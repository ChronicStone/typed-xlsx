import { unzipSync } from "fflate";
import { describe, expect, it } from "vite-plus/test";
import { createExcelSchema, createWorkbook } from "../src";

type Row = { name: string; note: string };

function schemaWith(headers: [string, string]) {
  return createExcelSchema<Row>()
    .column("name", { header: headers[0], accessor: "name" })
    .column("note", { header: headers[1], accessor: "note" })
    .build();
}

describe("worksheet columns of stacked tables", () => {
  it("writes one <col> per column and keeps the widest width of the stacked tables", () => {
    const bytes = createWorkbook()
      .sheet("S")
      .table("narrow", {
        schema: schemaWith(["Name", "Note"]),
        rows: [{ name: "a", note: "b" }],
      })
      .table("wide", {
        schema: schemaWith(["A much longer first header", "N"]),
        rows: [{ name: "a", note: "b" }],
      })
      .toUint8Array();
    const xml = new TextDecoder().decode(unzipSync(bytes)["xl/worksheets/sheet1.xml"]);
    const cols = [...xml.matchAll(/<col min="(\d+)" max="(\d+)" width="([\d.]+)"/g)].map(
      (match) => ({ min: Number(match[1]), max: Number(match[2]), width: Number(match[3]) }),
    );

    expect(cols.map((col) => [col.min, col.max])).toEqual([
      [1, 1],
      [2, 2],
    ]);
    // "A much longer first header" is the widest content of column 1; column 2 stays the narrow one.
    expect(cols[0]!.width).toBeGreaterThan(20);
    expect(cols[1]!.width).toBeLessThan(10);
  });
});
