import { describe, expect, it } from "vitest";
import { createExcelSchema, createWorkbook, createWorkbookStream } from "../src";
import { unzipWorkbookEntries } from "./support/xlsx";

type Row = { name: string; score: number; target: number };

// `target` is highlighted when its own row's score is below it, and `check` validates against the
// same row's score. Both formulas must point at the first data row of wherever the table lands.
const schema = createExcelSchema<Row>()
  .column("name", { accessor: "name" })
  .column("score", { accessor: "score" })
  .column("target", {
    accessor: "target",
    conditionalStyle: (c) =>
      c.when(({ refs }) => refs.column("score").lt(refs.column("target")), {
        fill: { color: { rgb: "FEE2E2" } },
      }),
  })
  .column("check", {
    accessor: "target",
    validation: (v) => v.custom(({ refs }) => refs.column("score").gte(0)),
  })
  .build();

const rows: Row[] = [
  { name: "a", score: 1, target: 5 },
  { name: "b", score: 9, target: 5 },
];

function readRules(bytes: Uint8Array | Buffer) {
  const xml = unzipWorkbookEntries(bytes).get("xl/worksheets/sheet1.xml") ?? "";
  const unescape = (value: string) => value.replaceAll("&lt;", "<").replaceAll("&gt;", ">");

  return {
    formats: [
      ...xml.matchAll(/<conditionalFormatting sqref="([^"]+)">.*?<formula>(.*?)<\/formula>/g),
    ].map((match) => `${match[1]} ${unescape(match[2]!)}`),
    validations: [
      ...xml.matchAll(/<dataValidation [^>]*sqref="([^"]+)"[^>]*><formula1>(.*?)<\/formula1>/g),
    ].map((match) => `${match[1]} ${unescape(match[2]!)}`),
  };
}

async function streamBytes(workbook: ReturnType<typeof createWorkbookStream>) {
  const chunks: Uint8Array[] = [];
  await workbook.pipeTo(
    new WritableStream({
      write(chunk) {
        chunks.push(chunk);
      },
    }),
  );
  return Buffer.concat(chunks);
}

describe("conditional formats and validations on placed tables", () => {
  it("anchors on the first data row of a table at the sheet origin", () => {
    const workbook = createWorkbook();
    workbook.sheet("S").table("t", { schema, rows });

    expect(readRules(workbook.toUint8Array())).toEqual({
      formats: ["C2:C3 (B2<$C2)"],
      validations: ["D2:D3 (B2>=0)"],
    });
  });

  it("moves the range and the formula below a title row", () => {
    const workbook = createWorkbook();
    workbook.sheet("S").table("t", { schema, rows, title: "Scores" });

    expect(readRules(workbook.toUint8Array())).toEqual({
      formats: ["C3:C4 (B3<$C3)"],
      validations: ["D3:D4 (B3>=0)"],
    });
  });

  it("anchors a second stacked table on its own rows", () => {
    const workbook = createWorkbook();
    const sheet = workbook.sheet("S");
    sheet.table("first", { schema, rows });
    sheet.table("second", { schema, rows });

    expect(readRules(workbook.toUint8Array())).toEqual({
      formats: ["C2:C3 (B2<$C2)", "C6:C7 (B6<$C6)"],
      validations: ["D2:D3 (B2>=0)", "D6:D7 (B6>=0)"],
    });
  });

  it("anchors a side-by-side table on its own columns", () => {
    const workbook = createWorkbook();
    const sheet = workbook.sheet("S", { tablesPerRow: 2 });
    sheet.table("left", { schema, rows });
    sheet.table("right", { schema, rows });

    expect(readRules(workbook.toUint8Array())).toEqual({
      formats: ["C2:C3 (B2<$C2)", "H2:H3 (G2<$H2)"],
      validations: ["D2:D3 (B2>=0)", "I2:I3 (G2>=0)"],
    });
  });

  it("anchors streamed tables the same way as buffered ones", async () => {
    const workbook = createWorkbookStream();
    const sheet = workbook.sheet("S", { tablesPerRow: 2 });
    const titled = await sheet.table("titled", { schema, title: "Scores" });
    await titled.commit({ rows });
    const plain = await sheet.table("plain", { schema });
    await plain.commit({ rows });

    expect(readRules(await streamBytes(workbook))).toEqual({
      formats: ["C3:C4 (B3<$C3)", "H2:H3 (G2<$H2)"],
      validations: ["D3:D4 (B3>=0)", "I2:I3 (G2>=0)"],
    });
  });
});
