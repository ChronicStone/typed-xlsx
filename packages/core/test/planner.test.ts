import { describe, expect, it } from "vitest";
import * as Internal from "../src/index-internal";

describe("planner", () => {
  it("expands multi-value cells into physical rows and tracks widths", () => {
    const schema = Internal.SchemaBuilder.create<{
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

    const result = Internal.planRows(schema, [
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
    const schema = Internal.SchemaBuilder.create<{ amount: number }>()
      .column("amount", {
        accessor: "amount",
        summary: {
          init: () => 0,
          step: (acc: number, row) => acc + row.amount,
          finalize: (acc: number) => acc,
        },
      })
      .build();

    const workbook = Internal.BufferedWorkbookBuilder.create();
    workbook.sheet("Totals").table("totals", {
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
        conditionalFormatting: undefined,
        unstyled: false,
      },
    ]);
  });

  it("resolves dynamic reducer summary styles from the finalized value", () => {
    const schema = Internal.SchemaBuilder.create<{ amount: number }>()
      .column("amount", {
        accessor: "amount",
        summary: {
          init: () => 0,
          step: (acc: number, row) => acc + row.amount,
          finalize: (acc: number) => acc,
          style: (value) => ({
            font: {
              bold: true,
              color: { rgb: (value as number) >= 10 ? "166534" : "991B1B" },
            },
          }),
        },
      })
      .build();

    const workbook = Internal.BufferedWorkbookBuilder.create();
    workbook.sheet("Totals").table("totals", {
      schema,
      rows: [{ amount: 3 }, { amount: 9 }],
    });

    const plan = workbook.buildPlan();
    expect(plan.sheets[0]?.tables[0]?.summaries[0]?.style).toEqual({
      font: { bold: true, color: { rgb: "166534" } },
    });
  });

  it("tracks row heights for multiline styled values", () => {
    const schema = Internal.SchemaBuilder.create<{ notes: string }>()
      .column("notes", {
        accessor: "notes",
        style: {
          font: { size: 14 },
        },
      })
      .build();

    const result = Internal.planRows(schema, [{ notes: "line 1\nline 2" }]);

    expect(result.rows[0]?.height).toBeGreaterThan(Internal.getDefaultRowHeight());
    expect(result.stats.rowHeights.get(0)).toBe(result.rows[0]?.height);
  });

  it("plans formula-based columns using predecessor references", () => {
    const schema = Internal.SchemaBuilder.create<{ qty: number; unitPrice: number }>()
      .column("qty", {
        accessor: "qty",
      })
      .column("unitPrice", {
        accessor: "unitPrice",
      })
      .column("lineTotal", {
        formula: ({ row }) => row.ref("qty").mul(row.ref("unitPrice").toExpr()),
      })
      .build();

    const result = Internal.planRows(schema, [{ qty: 3, unitPrice: 7 }]);
    const formulaCell = result.rows[0]?.cells[2]?.value;

    expect(formulaCell).toEqual({
      kind: "formula",
      formula: "(A2*B2)",
    });
  });

  it("plans richer conditional formulas", () => {
    const schema = Internal.SchemaBuilder.create<{ qty: number; unitPrice: number }>()
      .column("qty", {
        accessor: "qty",
      })
      .column("unitPrice", {
        accessor: "unitPrice",
      })
      .column("status", {
        formula: ({ row, fx }) =>
          fx.if(row.ref("qty").gt(10).and(row.ref("unitPrice").gte(100)), "PRIORITY", "STANDARD"),
      })
      .build();

    const result = Internal.planRows(schema, [{ qty: 12, unitPrice: 120 }]);
    const formulaCell = result.rows[0]?.cells[2]?.value;

    expect(formulaCell).toEqual({
      kind: "formula",
      formula: 'IF(AND((A2>10),(B2>=100)),"PRIORITY","STANDARD")',
    });
  });

  it("anchors formula cells to physical sub-rows when rows expand", () => {
    const schema = Internal.SchemaBuilder.create<{ items: number[]; qtys: number[] }>()
      .column("items", {
        accessor: (row) => row.items,
      })
      .column("qtys", {
        accessor: (row) => row.qtys,
      })
      .column("lineTotal", {
        formula: ({ row }) => row.ref("items").mul(row.ref("qtys")),
      })
      .build();

    const result = Internal.planRows(schema, [{ items: [2, 3], qtys: [4, 5] }]);

    expect(result.rows[0]?.cells[2]?.value).toEqual({
      kind: "formula",
      formula: "(A2*B2)",
    });
    expect(result.rows[1]?.cells[2]?.value).toEqual({
      kind: "formula",
      formula: "(A3*B3)",
    });
  });

  it("broadcasts scalar refs while keeping expanded refs aligned in nested formulas", () => {
    const schema = Internal.SchemaBuilder.create<{
      discountRate: number;
      qtys: number[];
      prices: number[];
    }>()
      .column("discountRate", {
        accessor: "discountRate",
      })
      .column("qtys", {
        accessor: (row) => row.qtys,
      })
      .column("prices", {
        accessor: (row) => row.prices,
      })
      .column("netRevenue", {
        formula: ({ row, fx }) =>
          row
            .ref("qtys")
            .mul(row.ref("prices"))
            .mul(fx.literal(1).sub(row.ref("discountRate"))),
      })
      .build();

    const result = Internal.planRows(schema, [
      { discountRate: 0.1, qtys: [2, 3], prices: [10, 20] },
    ]);

    expect(result.rows[0]?.cells[3]?.value).toEqual({
      kind: "formula",
      formula: "((B2*C2)*(1-A2))",
    });
    expect(result.rows[1]?.cells[3]?.value).toEqual({
      kind: "formula",
      formula: "((B3*C3)*(1-A2))",
    });
  });

  it("supports row-local series aggregates in expanded formulas", () => {
    const schema = Internal.SchemaBuilder.create<{ amounts: number[] }>()
      .column("amount", {
        accessor: (row) => row.amounts,
      })
      .column("rowAverage", {
        formula: ({ row }) => row.series("amount").average(),
      })
      .build();

    const result = Internal.planRows(schema, [{ amounts: [10, 20, 30] }]);

    expect(result.rows[0]?.cells[1]?.value).toEqual({
      kind: "formula",
      formula: "AVERAGE(A2:A4)",
    });
  });

  it("keeps row-level aggregate formulas scalar when expansion is single", () => {
    const schema = Internal.SchemaBuilder.create<{ amounts: number[] }>()
      .column("amount", {
        accessor: (row) => row.amounts,
      })
      .column("rowAverage", {
        formula: ({ row }) => row.series("amount").average(),
        expansion: "single",
      })
      .build();

    const result = Internal.planRows(schema, [{ amounts: [10, 20, 30] }]);

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]?.cells[1]?.value).toEqual({
      kind: "formula",
      formula: "AVERAGE(A2:A4)",
    });
    expect(result.rows[1]?.cells[1]?.value).toBeNull();
    expect(result.rows[2]?.cells[1]?.value).toBeNull();
    expect(result.merges).toContainEqual({ startRow: 0, endRow: 2, startCol: 1, endCol: 1 });
  });

  it("repeats row-level aggregate formulas when expansion is expand", () => {
    const schema = Internal.SchemaBuilder.create<{ amounts: number[] }>()
      .column("amount", {
        accessor: (row) => row.amounts,
      })
      .column("rowAverage", {
        formula: ({ row }) => row.series("amount").average(),
        expansion: "expand",
      })
      .build();

    const result = Internal.planRows(schema, [{ amounts: [10, 20, 30] }]);

    expect(result.rows[0]?.cells[1]?.value).toEqual({ kind: "formula", formula: "AVERAGE(A2:A4)" });
    expect(result.rows[1]?.cells[1]?.value).toEqual({ kind: "formula", formula: "AVERAGE(A2:A4)" });
    expect(result.rows[2]?.cells[1]?.value).toEqual({ kind: "formula", formula: "AVERAGE(A2:A4)" });
  });

  it("resolves grouped columns from context during planning", () => {
    type User = {
      firstName: string;
      organizations: Array<{ id: number; name: string }>;
    };

    const schema = Internal.SchemaBuilder.create<
      User,
      { orgs: Array<{ id: number; name: string }> }
    >()
      .column("firstName", {
        accessor: "firstName",
      })
      .dynamic("orgs", (builder, { ctx }) => {
        for (const org of ctx.orgs) {
          builder.column(`org-${org.id}`, {
            header: org.name,
            accessor: (row) => row.organizations.some((entry) => entry.id === org.id),
          });
        }
      })
      .build();

    const columns = Internal.resolveColumns(schema, {
      orgs: [
        { id: 1, name: "Core" },
        { id: 2, name: "Finance" },
      ],
    });

    expect(columns.map((column) => column.id)).toEqual(["firstName", "org-1", "org-2"]);
    expect(columns.map((column) => column.headerLabel)).toEqual(["First name", "Core", "Finance"]);
  });
});
