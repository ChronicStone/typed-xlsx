import { describe, expect, it, vi } from "vite-plus/test";
import { createExcelSchema, createWorkbook, createWorkbookStream } from "../src";

type Line = { qty: number };

function createLines(count: number): Line[] {
  return Array.from({ length: count }, (_, index) => ({ qty: index + 1 }));
}

describe("row writer work that must not repeat", () => {
  it("runs each summary reducer once per row and finalizes once in buffered report mode", () => {
    const step = vi.fn((acc: number, row: Line) => acc + row.qty);
    const finalize = vi.fn((acc: number) => acc);
    const schema = createExcelSchema<Line>()
      .column("qty", {
        header: "Qty",
        accessor: "qty",
        summary: (summary) => [summary.cell({ init: () => 0, step, finalize })],
      })
      .build();

    createWorkbook()
      .sheet("S")
      .table("lines", { schema, rows: createLines(3) })
      .toUint8Array();

    expect(step).toHaveBeenCalledTimes(3);
    expect(finalize).toHaveBeenCalledTimes(1);
  });

  function createFormulaSchema(formula: () => void) {
    return createExcelSchema<Line>()
      .column("qty", { header: "Qty", accessor: "qty" })
      .column("double", {
        header: "Double",
        formula: ({ refs }) => {
          formula();
          return refs.column("qty").mul(2);
        },
      })
      .build();
  }

  it("builds a formula column expression once per table in the buffered builder", () => {
    const formula = vi.fn();

    createWorkbook()
      .sheet("S")
      .table("lines", { schema: createFormulaSchema(formula), rows: createLines(100) })
      .toUint8Array();

    expect(formula).toHaveBeenCalledTimes(1);
  });

  it("builds a formula column expression once per table in the stream builder", async () => {
    const formula = vi.fn();
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook
      .sheet("S")
      .table("lines", { schema: createFormulaSchema(formula) });

    await table.commit({ rows: createLines(60) });
    await table.commit({ rows: createLines(40) });
    await workbook.dispose();

    expect(formula).toHaveBeenCalledTimes(1);
  });
});
