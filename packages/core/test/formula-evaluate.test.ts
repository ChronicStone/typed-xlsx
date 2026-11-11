import { describe, expect, it } from "vite-plus/test";
import { createExcelSchema, createWorkbook } from "../src";
import { evaluateFormulaExpr } from "../src/formula/evaluate";
import type { FormulaEvaluationContext } from "../src/formula/evaluate";
import type { FormulaExpr } from "../src/formula/expr";
import type { PrimitiveCellValue } from "../src/schema/builder";
import { readWorkbookEntry, unzipWorkbookEntries } from "./support/xlsx";

const lit = (value: string | number | boolean): FormulaExpr => ({ kind: "literal", value });
const ref = (columnId: string): FormulaExpr => ({ kind: "ref", columnId });
const fn = (name: string, ...args: FormulaExpr[]): FormulaExpr => ({
  kind: "function",
  name: name as "SUM",
  args,
});
const bin = (op: string, left: FormulaExpr, right: FormulaExpr): FormulaExpr => ({
  kind: "binary",
  op: op as "+",
  left,
  right,
});
const range = (aggregate: "SUM" | "AVERAGE" | "COUNT" | "MIN" | "MAX"): FormulaExpr => ({
  kind: "collection-aggregate",
  aggregate,
  target: { kind: "series", columnId: "x" },
});

function context(
  series: PrimitiveCellValue[] = [],
  values: Record<string, PrimitiveCellValue> = {},
): FormulaEvaluationContext {
  return {
    getColumnValue: (columnId) => values[columnId],
    getColumnSeries: () => series,
    getScopeValues: () => series,
  };
}

describe("formula evaluator matches Excel", () => {
  const cases: Array<[string, FormulaExpr, PrimitiveCellValue[], PrimitiveCellValue]> = [
    ["ROUND(-2.5, 0)", fn("ROUND", lit(-2.5), lit(0)), [], -3],
    ["ROUND(2.5, 0)", fn("ROUND", lit(2.5), lit(0)), [], 3],
    ["ROUND(1.005, 2)", fn("ROUND", lit(1.005), lit(2)), [], 1.01],
    ["ROUND(2.675, 2)", fn("ROUND", lit(2.675), lit(2)), [], 2.68],
    ["ROUND(-1.005, 2)", fn("ROUND", lit(-1.005), lit(2)), [], -1.01],
    ["ROUND(1234.5678, -2)", fn("ROUND", lit(1234.5678), lit(-2)), [], 1200],
    ["ROUND(-0.4, 0)", fn("ROUND", lit(-0.4), lit(0)), [], 0],
    ['"12" = 12', bin("=", lit("12"), lit(12)), [], false],
    ['TRUE > "z"', bin(">", lit(true), lit("z")), [], true],
    ['"abc" = "ABC"', bin("=", lit("abc"), lit("ABC")), [], true],
    ['"a" < "B"', bin("<", lit("a"), lit("B")), [], true],
    ['"a" > 5', bin(">", lit("a"), lit(5)), [], true],
    ["FALSE < TRUE", bin("<", lit(false), lit(true)), [], true],
    ["blank = 0", bin("=", ref("blank"), lit(0)), [], true],
    ['blank = ""', bin("=", ref("blank"), lit("")), [], true],
    ['"12" * 2', bin("*", lit("12"), lit(2)), [], 24],
    ["TRUE + 1", bin("+", lit(true), lit(1)), [], 2],
    ["COUNT over [1, blank, 3]", range("COUNT"), [1, null, 3], 2],
    ["AVERAGE over [1, blank, 3]", range("AVERAGE"), [1, null, 3], 2],
    ['SUM over [1, "12", TRUE]', range("SUM"), [1, "12", true], 1],
    ["MIN over [blank, blank]", range("MIN"), [null, null], 0],
    ["SUM(1, 12, TRUE) direct args", fn("SUM", lit(1), lit("12"), lit(true)), [], 14],
    [
      'COUNT(1, "12", TRUE, "abc") direct args',
      fn("COUNT", lit(1), lit("12"), lit(true), lit("abc")),
      [],
      3,
    ],
    ["SUM(text cell ref) ignores text", fn("SUM", ref("text"), lit(1)), [], 1],
    ["IF(TRUE, 1, 2)", fn("IF", lit(true), lit(1), lit(2)), [], 1],
    ["IF(0, 1, 2)", fn("IF", lit(0), lit(1), lit(2)), [], 2],
    ["AVERAGE over []", range("AVERAGE"), [], undefined],
    ["AVERAGE over [text]", range("AVERAGE"), ["a", true], undefined],
    ['"abc" * 2', bin("*", lit("abc"), lit(2)), [], undefined],
    ['"" * 2', bin("*", lit(""), lit(2)), [], undefined],
    ["10 / 0", bin("/", lit(10), lit(0)), [], undefined],
    ["errors propagate: (10 / 0) + 1", bin("+", bin("/", lit(10), lit(0)), lit(1)), [], undefined],
    ['SUM(1, "abc") direct args', fn("SUM", lit(1), lit("abc")), [], undefined],
    ['IF("false", 1, 2)', fn("IF", lit("false"), lit(1), lit(2)), [], undefined],
    [
      "0.1 + 0.2 = 0.3 (15-digit tie)",
      bin("=", bin("+", lit(0.1), lit(0.2)), lit(0.3)),
      [],
      undefined,
    ],
  ];

  it.each(cases)("%s", (_label, expr, series, expected) => {
    const values = { text: "12" };
    expect(evaluateFormulaExpr(expr, context(series, values))).toEqual(expected);
  });
});

type Row = { a: number | null; b: string; c: number | null };

describe("formula evaluator in excel-table output", () => {
  it("stores Excel-compatible values next to formulas and omits uncertain ones", () => {
    const schema = createExcelSchema<Row>({ mode: "excel-table" })
      .group("figures", (group) =>
        group
          .column("a", { header: "A", accessor: "a" })
          .column("b", { header: "B", accessor: "b" })
          .column("c", { header: "C", accessor: "c" }),
      )
      .column("rounded", {
        header: "Rounded",
        formula: ({ fx }) => fx.round(fx.literal(-2.5), 0),
      })
      .column("same", {
        header: "Same",
        formula: ({ fx }) => fx.if(fx.literal("12").eq(12), 1, 0),
      })
      .column("average", {
        header: "Average",
        formula: ({ fx, refs }) => fx.average(refs.group("figures")),
      })
      .column("count", {
        header: "Count",
        formula: ({ fx, refs }) => fx.count(refs.group("figures")),
      })
      .column("sum", {
        header: "Sum",
        formula: ({ fx, refs }) => fx.sum(refs.group("figures")),
      })
      .column("direct", {
        header: "Direct",
        formula: ({ fx }) => fx.sum(fx.literal(1), fx.literal("12"), fx.literal(true)),
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("S").table("t", {
      schema,
      rows: [
        { a: 1, b: "12", c: 3 },
        { a: null, b: "x", c: null },
      ],
    });
    const xml = readWorkbookEntry(
      unzipWorkbookEntries(workbook.toUint8Array()),
      "xl/worksheets/sheet1.xml",
    );

    const cached = (cellRef: string) => {
      const cell = xml.match(
        new RegExp(`<c r="${cellRef}"[^>]*>(?:<f>[^<]*</f>)(?:<v>([^<]*)</v>)?</c>`),
      );
      expect(cell, `formula cell ${cellRef}`).not.toBeNull();
      return cell?.[1];
    };

    // columns: D rounded, E same, F average, G count, H sum, I direct; row 2 is the first data row
    expect([
      cached("D2"),
      cached("E2"),
      cached("F2"),
      cached("G2"),
      cached("H2"),
      cached("I2"),
    ]).toEqual(["-3", "0", "2", "2", "4", "14"]);
    // second row has no numbers: AVERAGE is #DIV/0! in Excel, so no value is stored
    expect([cached("F3"), cached("G3"), cached("H3")]).toEqual([undefined, "0", "0"]);
  });
});
