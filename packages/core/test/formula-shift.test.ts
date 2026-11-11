import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createExcelSchema, createWorkbook, createWorkbookStream } from "../src";
import { shiftFormulaA1Refs } from "../src/workbook/internal/report-chrome";

describe("shiftFormulaA1Refs", () => {
  const cases: Array<[string, string, string]> = [
    ["plain references", "B2*C2", "C6*D6"],
    ["ranges", "SUM(B2:B10)", "SUM(C6:C14)"],
    ["text inside a string literal", 'IF(B2>0,"FY2024 ok","")', 'IF(C6>0,"FY2024 ok","")'],
    ["escaped quotes inside a string literal", '"say ""A1"" now"&B2', '"say ""A1"" now"&C6'],
    [
      "structured references and table names",
      "Sales[[#This Row],[Q1]]+TBL3[[#This Row],[H2]]",
      "Sales[[#This Row],[Q1]]+TBL3[[#This Row],[H2]]",
    ],
    ["function names with digits", "LOG10(B2)+ATAN2(B2,C2)", "LOG10(C6)+ATAN2(C6,D6)"],
    ["quoted sheet names", "'Q1 Data'!B2", "'Q1 Data'!C6"],
    ["absolute markers", "$B$2+B$2+$B2", "$B$2+C$2+$B6"],
  ];

  it.each(cases)("shifts only real references: %s", (_name, formula, expected) => {
    expect(shiftFormulaA1Refs(formula, 4, 1)).toBe(expected);
  });

  it("returns the formula unchanged when both offsets are zero", () => {
    expect(shiftFormulaA1Refs('IF(B2>0,"A1","")', 0, 0)).toBe('IF(B2>0,"A1","")');
  });
});

type Line = { qty: number };

const lineSchema = createExcelSchema<Line>()
  .column("qty", { header: "Qty", accessor: "qty" })
  .column("flag", {
    header: "Flag",
    formula: ({ refs, fx }) => fx.if(refs.column("qty").gt(0), "FY2024 ok", ""),
  })
  .build();

const quarterSchema = createExcelSchema<Line>({ mode: "excel-table" })
  .column("Q1", { header: "Q1", accessor: "qty" })
  .column("double", { header: "Double", formula: ({ refs }) => refs.column("Q1").mul(2) })
  .build();

const lines: Line[] = [{ qty: 1 }, { qty: 2 }];

function sheetXml(bytes: Uint8Array) {
  const entry = unzipSync(bytes)["xl/worksheets/sheet1.xml"];
  if (!entry) throw new Error("missing sheet1.xml");
  return new TextDecoder().decode(entry);
}

async function streamBytes(workbook: ReturnType<typeof createWorkbookStream>) {
  const reader = workbook.toReadableStream().getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function formulaTexts(xml: string) {
  return [...xml.matchAll(/<f>([^<]*)<\/f>/g)].map((match) => match[1] as string);
}

describe("formulas in tables that are not at A1", () => {
  it("keeps text and re-points references for a stacked report table (buffered)", () => {
    const xml = sheetXml(
      createWorkbook()
        .sheet("S")
        .table("first", { schema: lineSchema, rows: lines })
        .table("second", { schema: lineSchema, rows: lines })
        .toUint8Array(),
    );
    const formulas = formulaTexts(xml);

    expect(formulas).toHaveLength(4);
    expect(formulas.every((formula) => formula.includes("&quot;FY2024 ok&quot;"))).toBe(true);
    expect(formulas[0]).toContain("A2");
    expect(formulas[2]).not.toContain("A2");
    expect(formulas[2]).toMatch(/A\d+/);
    expect(formulas[2]).not.toContain("FY2030");
  });

  it("keeps text and re-points references for a stacked report table (stream)", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const sheet = workbook.sheet("S");
    const first = await sheet.table("first", { schema: lineSchema });
    const second = await sheet.table("second", { schema: lineSchema });
    await first.commit({ rows: lines });
    await second.commit({ rows: lines });

    const formulas = formulaTexts(sheetXml(await streamBytes(workbook)));

    expect(formulas).toHaveLength(4);
    expect(formulas.every((formula) => formula.includes("&quot;FY2024 ok&quot;"))).toBe(true);
    expect(formulas[0]).toContain("A2");
    expect(formulas[2]).not.toContain("A2");
    expect(formulas[2]).toMatch(/A\d+/);
  });

  it("keeps a Q1 header in structured references of a side-by-side excel table (buffered)", () => {
    const xml = sheetXml(
      createWorkbook({})
        .sheet("S", { tablesPerRow: 2 })
        .table("left", { schema: quarterSchema, rows: lines })
        .table("right", { schema: quarterSchema, rows: lines })
        .toUint8Array(),
    );

    const formulas = formulaTexts(xml);
    expect(formulas.length).toBeGreaterThan(0);
    expect(formulas.some((formula) => formula.includes("right[[#This Row],[Q1]]"))).toBe(true);
    expect(formulas.some((formula) => formula.includes("[Q5]"))).toBe(false);
  });

  it("keeps a Q1 header in structured references of a side-by-side excel table (stream)", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const sheet = workbook.sheet("S", { tablesPerRow: 2 });
    const left = await sheet.table("left", { schema: quarterSchema });
    const right = await sheet.table("right", { schema: quarterSchema });
    await left.commit({ rows: lines });
    await right.commit({ rows: lines });

    const formulas = formulaTexts(sheetXml(await streamBytes(workbook)));

    expect(formulas.length).toBeGreaterThan(0);
    expect(formulas.some((formula) => formula.includes("right[[#This Row],[Q1]]"))).toBe(true);
    expect(formulas.some((formula) => formula.includes("[Q5]"))).toBe(false);
  });
});
