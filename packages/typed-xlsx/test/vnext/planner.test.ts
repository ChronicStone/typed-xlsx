import { describe, expect, it } from "vitest";
import * as VNext from "../../src/vnext";

describe("vnext planner", () => {
  it("expands multi-value cells into physical rows and tracks widths", () => {
    const schema = VNext.SchemaBuilder.create<{
      id: string;
      tags: string[];
    }>()
      .column("id", {
        accessor: "id",
      })
      .column("tags", {
        accessor: (row) => row.tags,
      })
      .build();

    const result = VNext.planRows(schema, [
      { id: "1", tags: ["a", "bbb"] },
      { id: "2", tags: ["cccc"] },
    ]);

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].cells[1]?.value).toBe("a");
    expect(result.rows[1].cells[1]?.value).toBe("bbb");
    expect(result.rows[2].cells[1]?.value).toBe("cccc");
    expect(result.stats.columnWidths.get("tags")).toBe(4);
    expect(result.merges).toEqual([
      {
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: 0,
      },
    ]);
  });

  it("computes reducer-based summaries", () => {
    const schema = VNext.SchemaBuilder.create<{ amount: number }>()
      .column("amount", {
        accessor: "amount",
        summary: {
          init: () => 0,
          step: (acc: number, row) => acc + row.amount,
          finalize: (acc: number) => acc,
        },
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Totals").table({
      schema,
      rows: [{ amount: 3 }, { amount: 4 }],
    });

    const plan = workbook.buildPlan();
    expect(plan.sheets[0]?.tables[0]?.summaries).toEqual([
      {
        columnId: "amount",
        summaryIndex: 0,
        value: 7,
        style: undefined,
      },
    ]);
  });

  it("tracks row heights for multiline styled values", () => {
    const schema = VNext.SchemaBuilder.create<{ notes: string }>()
      .column("notes", {
        accessor: "notes",
        style: {
          font: { size: 14 },
        },
      })
      .build();

    const result = VNext.planRows(schema, [{ notes: "line 1\nline 2" }]);

    expect(result.rows[0]?.height).toBeGreaterThan(VNext.getDefaultRowHeight());
    expect(result.stats.rowHeights.get(0)).toBe(result.rows[0]?.height);
  });
});
