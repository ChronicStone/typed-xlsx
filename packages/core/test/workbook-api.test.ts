import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createExcelSchema,
  createWorkbook,
  defineSpreadsheetTheme,
  spreadsheetThemes,
  type ExcelTableSchemaDefinition,
  type TableSelection,
} from "../src";

describe("public buffered api", () => {
  it("infers selection ids from the schema and preserves transform value types", () => {
    type Order = {
      amount: number;
      name: string;
      lines: Array<{ sku: string; qty: number }>;
    };

    const schema = createExcelSchema<Order>({ mode: "report" })
      .column("name", {
        accessor: "name",
      })
      .column("amount", {
        accessor: "amount",
      })
      .column("lineCount", {
        accessor: "lines",
        transform: ({ value }) => {
          expectTypeOf(value).toEqualTypeOf<Order["lines"]>();
          return value.length;
        },
        summary: (summary) => [
          summary.cell({
            init: () => 0,
            step: (acc, row) => {
              expectTypeOf(acc).toEqualTypeOf<number>();
              expectTypeOf(row).toEqualTypeOf<Order>();
              return acc + row.lines.length;
            },
            finalize: (acc) => acc,
          }),
        ],
      })
      .build();

    type Selection = TableSelection<"name" | "amount" | "lineCount">;

    expectTypeOf<Selection["include"]>().toEqualTypeOf<
      readonly ("name" | "amount" | "lineCount")[] | undefined
    >();

    createWorkbook()
      .sheet("Orders")
      .table("orders", {
        rows: [],
        schema,
        select: {
          include: ["name", "lineCount"],
          exclude: ["amount"],
        },
      });

    createWorkbook()
      .sheet("Orders")
      .table("orders-invalid", {
        rows: [],
        schema,
        select: {
          // @ts-expect-error invalid column id should be rejected
          include: ["email"],
        },
      });
  });

  it("supports typed selection for group ids and requires group context", () => {
    type Row = { name: string; orgs: number[] };

    const schema = createExcelSchema<Row, { memberships: number[] }>({ mode: "report" })
      .column("name", { accessor: "name" })
      .dynamic("memberships", (builder, { ctx }) => {
        for (const id of ctx.memberships) {
          builder.column(`org-${id}`, {
            accessor: (row) => row.orgs.includes(id),
          });
        }
      })
      .build();

    createWorkbook()
      .sheet("Sheet")
      .table("groups", {
        rows: [],
        schema,
        context: { memberships: [] },
        select: { exclude: ["memberships"] },
      });

    expect(() => {
      const workbook = createWorkbook();
      workbook.sheet("Sheet").table("groups-runtime", {
        rows: [{ name: "Ada", orgs: [1, 2] }],
        schema,
        context: { memberships: [1, 2] },
        select: { exclude: ["memberships"] },
      });
      workbook.toUint8Array();
    }).not.toThrow();

    createWorkbook()
      .sheet("Sheet")
      .table("groups-invalid", {
        rows: [],
        schema,
        context: { memberships: [1, 2, 3] },
        select: {
          // @ts-expect-error generated child ids are not part of the public select API
          exclude: ["org-2"],
        },
      });

    createWorkbook()
      .sheet("Sheet")
      // @ts-expect-error contextful schemas always require context
      .table("groups-missing-context", { rows: [], schema, select: { include: ["memberships"] } });
  });

  it("supports flat column groups in buffered native Excel table schemas", () => {
    type Row = { memberships: number[]; name: string };

    const schema = createExcelSchema<Row, { memberships: number[] }>({ mode: "excel-table" })
      .column("name", { accessor: "name" })
      .dynamic("memberships", (builder, { ctx }) => {
        for (const id of ctx.memberships) {
          builder.column(`org-${id}`, {
            accessor: (row) => row.memberships.includes(id),
          });
        }
      })
      .build();

    expect(() => {
      const workbook = createWorkbook();
      workbook.sheet("Sheet").table("groups", {
        rows: [{ memberships: [1], name: "Ada" }],
        schema,
        context: { memberships: [1, 2] },
      });
      workbook.toUint8Array();
    }).not.toThrow();
  });

  it("allows formulas inside groups to reference outer predecessor columns in buffered mode", () => {
    const schema = createExcelSchema<{ amount: number }>({ mode: "report" })
      .column("amount", { accessor: "amount" })
      .group("derived", (builder) => {
        builder
          .column("doubleAmount", {
            formula: ({ row }) => row.ref("amount").mul(2),
          })
          .column("tripleAmount", {
            formula: ({ row }) => row.ref("doubleAmount").add(row.ref("amount")),
          });
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table("orders", {
      rows: [{ amount: 3 }],
      schema,
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>(A3*2)</f>");
    expect(content).toContain("<f>(B3+A3)</f>");
  });

  it("allows formulas inside groups to reference outer predecessor columns in buffered excel-table mode", () => {
    const schema = createExcelSchema<{ amount: number }>({ mode: "excel-table" })
      .column("amount", { accessor: "amount" })
      .group("derived", (builder) => {
        builder
          .column("doubleAmount", {
            formula: ({ row }) => row.ref("amount").mul(2),
          })
          .column("tripleAmount", {
            formula: ({ row }) => row.ref("doubleAmount").add(row.ref("amount")),
          });
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table("orders", {
      rows: [{ amount: 3 }],
      schema,
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>([@[Amount]]*2)</f>");
    expect(content).toContain("<f>([@[Double amount]]+[@[Amount]])</f>");
  });

  it("supports aggregating dynamic groups from later buffered report formulas", () => {
    const schema = createExcelSchema<{ amount: number }>({ mode: "report" })
      .column("amount", { accessor: "amount" })
      .group("derived", (builder) => {
        builder
          .column("doubleAmount", {
            formula: ({ row }) => row.ref("amount").mul(2),
          })
          .column("tripleAmount", {
            formula: ({ row }) => row.ref("amount").mul(3),
          });
      })
      .column("derivedTotal", {
        formula: ({ row }) => row.group("derived").sum(),
      })
      .column("derivedMax", {
        formula: ({ row }) => row.group("derived").max(),
      })
      .column("derivedCount", {
        formula: ({ row }) => row.group("derived").count(),
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table("orders", {
      rows: [{ amount: 3 }],
      schema,
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>SUM(B3,C3)</f>");
    expect(content).toContain("<f>MAX(B3,C3)</f>");
    expect(content).toContain("<f>COUNT(B3,C3)</f>");
  });

  it("supports opting out of grouped report headers for flat header rendering", () => {
    const schema = createExcelSchema<{ amount: number }>({ mode: "report" })
      .column("amount", { accessor: "amount" })
      .group("derived", (builder) => {
        builder.column("doubleAmount", {
          formula: ({ row }) => row.ref("amount").mul(2),
        });
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table("orders", {
      rows: [{ amount: 3 }],
      schema,
      render: { groupHeaders: false },
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>(A2*2)</f>");
    expect(content).not.toContain("Derived");
  });

  it("supports aggregating dynamic groups from later buffered excel-table formulas", () => {
    const schema = createExcelSchema<{ amount: number }>({ mode: "excel-table" })
      .column("amount", { accessor: "amount" })
      .group("derived", (builder) => {
        builder
          .column("doubleAmount", {
            formula: ({ row }) => row.ref("amount").mul(2),
          })
          .column("tripleAmount", {
            formula: ({ row }) => row.ref("amount").mul(3),
          });
      })
      .column("derivedTotal", {
        formula: ({ row }) => row.group("derived").sum(),
      })
      .column("derivedAverage", {
        formula: ({ row }) => row.group("derived").average(),
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table("orders", {
      rows: [{ amount: 3 }],
      schema,
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>SUM([@[Double amount]],[@[Triple amount]])</f>");
    expect(content).toContain("<f>AVERAGE([@[Double amount]],[@[Triple amount]])</f>");
  });

  it("does not require context for groups without a context parameter", () => {
    const schema = createExcelSchema<{ name: string; tags: string[] }>({ mode: "report" })
      .column("name", { accessor: "name" })
      .group("derived", (builder) => {
        builder.column("tagCount", { accessor: (row) => row.tags.length });
      })
      .build();

    const workbook = createWorkbook();

    expect(() => {
      workbook.sheet("Sheet").table("derived", {
        rows: [{ name: "Ada", tags: ["a", "b"] }],
        schema,
        select: { include: ["derived", "name"] },
      });

      workbook.toUint8Array();
    }).not.toThrow();
  });

  it("keeps explicitly included grouped child columns in buffered selections", () => {
    const schema = createExcelSchema<{
      accountName: string;
      arr: number;
      projectedArr: number;
      nrr: number;
      healthScore: number;
      executiveSummary: string;
    }>({ mode: "report" })
      .column("accountName", { accessor: "accountName" })
      .group("commercial", (builder) =>
        builder
          .column("arr", { accessor: "arr" })
          .column("projectedArr", { accessor: "projectedArr" })
          .column("nrr", { accessor: "nrr" }),
      )
      .group("adoption", (builder) => builder.column("healthScore", { accessor: "healthScore" }))
      .group("renewal", (builder) =>
        builder.column("executiveSummary", { accessor: "executiveSummary" }),
      )
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Board").table("watchlist", {
      rows: [
        {
          accountName: "Acme",
          arr: 10,
          projectedArr: 12,
          nrr: 1.1,
          healthScore: 88,
          executiveSummary: "Healthy",
        },
      ],
      schema,
      select: {
        include: ["accountName", "arr", "projectedArr", "nrr", "healthScore", "executiveSummary"],
      },
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("Account name");
    expect(content).toContain("Arr");
    expect(content).toContain("Projected arr");
    expect(content).toContain("Nrr");
    expect(content).toContain("Health score");
    expect(content).toContain("Executive summary");
  });

  it("supports theme slot resolution and extension", () => {
    const theme = defineSpreadsheetTheme({
      slots: {
        header: {
          fill: { color: { rgb: "112233" } },
        },
      },
    });

    const extended = theme.extend({
      slots: {
        header: {
          font: { color: { rgb: "FFFFFF" } },
        },
      },
    });

    expect(theme.slot("header").fill?.color?.rgb).toBe("112233");
    expect(extended.slot("header").fill?.color?.rgb).toBe("112233");
    expect(extended.slot("header").font?.color?.rgb).toBe("FFFFFF");
    expect(
      extended.slot("header", { alignment: { horizontal: "left" } }).alignment?.horizontal,
    ).toBe("left");
    expect(spreadsheetThemes.classic.slot("groupHeader").fill?.color?.rgb).toBeDefined();
  });

  it("applies schema theme, then table theme, then explicit defaults", () => {
    const schemaTheme = defineSpreadsheetTheme({
      slots: {
        header: {
          fill: { color: { rgb: "111111" } },
          font: { color: { rgb: "EEEEEE" } },
        },
      },
    });
    const tableTheme = defineSpreadsheetTheme({
      slots: {
        header: {
          fill: { color: { rgb: "222222" } },
        },
      },
    });

    const schema = createExcelSchema<{ name: string }>({ mode: "report" })
      .theme(schemaTheme)
      .column("name", { accessor: "name" })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table("orders", {
      rows: [{ name: "Ada" }],
      schema,
      theme: tableTheme,
      defaults: {
        header: {
          style: {
            fill: { color: { rgb: "333333" } },
          },
        },
      },
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("FF333333");
    expect(content).not.toContain("FF111111");
  });

  it("builds a workbook as a Uint8Array", () => {
    const schema = createExcelSchema<{ amount: number; name: string }>({ mode: "report" })
      .column("name", {
        accessor: "name",
      })
      .column("amount", {
        accessor: "amount",
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table("orders", {
      rows: [
        { amount: 3, name: "A" },
        { amount: 7, name: "B" },
      ],
      schema,
    });

    const bytes = workbook.toUint8Array();
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it("can write a buffered workbook directly to a file path", async () => {
    const schema = createExcelSchema<{ value: string }>({ mode: "excel-table" })
      .column("value", {
        accessor: "value",
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Logs").table("logs", {
      rows: [{ value: "line-1" }, { value: "line-2" }],
      schema,
    });

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "typed-xlsx-public-buffered-"));
    const filePath = path.join(directory, "report.xlsx");

    await workbook.writeToFile(filePath);

    const bytes = fs.readFileSync(filePath);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it("expands grouped columns from table context in buffered mode", () => {
    type User = {
      firstName: string;
      organizations: Array<{ id: number; name: string }>;
    };

    const schema = createExcelSchema<User, { orgs: Array<{ id: number; name: string }> }>({
      mode: "report",
    })
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

    const workbook = createWorkbook();
    workbook.sheet("Users").table("users", {
      rows: [
        {
          firstName: "Ada",
          organizations: [
            { id: 1, name: "Core" },
            { id: 3, name: "Labs" },
          ],
        },
      ],
      schema,
      context: {
        orgs: [
          { id: 1, name: "Core" },
          { id: 2, name: "Finance" },
          { id: 3, name: "Labs" },
        ],
      },
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("Core");
    expect(content).toContain("Finance");
    expect(content).toContain("Labs");
  });

  it("accepts buffered autoFilter table options through the public api", () => {
    const schema = createExcelSchema<{ value: string }>({ mode: "report" })
      .column("value", {
        accessor: "value",
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Logs").table("logs", {
      autoFilter: true,
      rows: [{ value: "line-1" }],
      schema,
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain('<autoFilter ref="A1:A2"/>');
  });

  it("accepts buffered native Excel table options through the public api", () => {
    const schema = createExcelSchema<{ value: string }>({ mode: "excel-table" })
      .column("value", {
        accessor: "value",
      })
      .build();

    expect(() => {
      const workbook = createWorkbook();
      workbook.sheet("Logs").table("logs", {
        autoFilter: true,
        name: "LogsTable",
        rows: [{ value: "line-1" }],
        schema,
      });
      workbook.toUint8Array();
    }).not.toThrow();

    expect(() => {
      const workbook = createWorkbook();
      workbook.sheet("Logs").table("logs", {
        autoFilter: true,
        rows: [{ value: "line-1" }],
        schema,
      });
      workbook.toUint8Array();
    }).not.toThrow();
  });

  it("accepts buffered native Excel totals-row options through the public api", () => {
    const schema = createExcelSchema<{ amount: number; label: string }>({ mode: "excel-table" })
      .column("label", {
        accessor: "label",
        totalsRow: { label: "TOTAL" },
      })
      .column("amount", {
        accessor: "amount",
        totalsRow: { function: "sum" },
      })
      .build();

    expect(() => {
      const workbook = createWorkbook();
      workbook.sheet("Orders").table("orders", {
        rows: [
          { amount: 3, label: "A" },
          { amount: 7, label: "B" },
        ],
        schema,
        totalsRow: true,
      });
      workbook.toUint8Array();
    }).not.toThrow();
  });

  it("accepts excel-table formula columns through the public buffered api", () => {
    const schema = createExcelSchema<{ qty: number; unitPrice: number }>({ mode: "excel-table" })
      .column("qty", {
        accessor: "qty",
      })
      .column("unitPrice", {
        accessor: "unitPrice",
      })
      .column("lineTotal", {
        formula: ({ row }) => row.ref("qty").mul(row.ref("unitPrice")),
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table("orders", {
      rows: [{ qty: 3, unitPrice: 7 }],
      schema,
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>([@[Qty]]*[@[Unit price]])</f>");
  });

  it("rejects buffered native Excel tables that would produce merged body rows", () => {
    const schema = {
      kind: "excel-table",
      columns: [
        { accessor: "id", id: "id" },
        {
          accessor: (row: { id: string; tags: string[] }) => row.tags.join(", "),
          id: "tagList",
          transform: (_value: string, row: { id: string; tags: string[] }) => row.tags,
        },
      ],
    } as unknown as ExcelTableSchemaDefinition<{ id: string; tags: string[] }, "id" | "tagList">;

    expect(() => {
      const workbook = createWorkbook();
      workbook.sheet("Logs").table("logs", {
        rows: [{ id: "1", tags: ["a", "b"] }],
        schema,
      });
      workbook.toUint8Array();
    }).toThrow(
      "Native Excel tables require flat physical rows. Remove array-expanded columns and merged body cells, or use the default report table mode.",
    );
  });

  it("supports formula summaries through the public buffered api", () => {
    const schema = createExcelSchema<{ amount: number; label: string }>({ mode: "report" })
      .column("label", {
        accessor: "label",
        summary: (summary) => [summary.label("TOTAL")],
      })
      .column("amount", {
        accessor: "amount",
        summary: (summary) => [summary.formula("sum")],
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table("orders", {
      rows: [
        { amount: 3, label: "A" },
        { amount: 7, label: "B" },
      ],
      schema,
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>SUM(B2:B3)</f>");
  });

  it("supports richer summary formula callbacks through the public buffered api", () => {
    const schema = createExcelSchema<{ amount: number; label: string }>({ mode: "report" })
      .column("label", {
        accessor: "label",
        summary: (summary) => [summary.label("TOTAL")],
      })
      .column("amount", {
        accessor: "amount",
        summary: (summary) => [
          summary.formula(({ column, fx }) => fx.round(column.cells().sum(), 2)),
        ],
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table("orders", {
      rows: [
        { amount: 3.125, label: "A" },
        { amount: 7.333, label: "B" },
      ],
      schema,
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>ROUND(SUM(B2:B3),2)</f>");
  });

  it("supports formula columns through the public buffered api", () => {
    const schema = createExcelSchema<{ qty: number; unitPrice: number }>({ mode: "report" })
      .column("qty", {
        accessor: "qty",
      })
      .column("unitPrice", {
        accessor: "unitPrice",
      })
      .column("lineTotal", {
        formula: ({ row }) => row.ref("qty").mul(row.ref("unitPrice")),
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table("orders", {
      rows: [{ qty: 3, unitPrice: 7 }],
      schema,
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>(A2*B2)</f>");
  });

  it("supports the public validation builder api with integer and lazy messages", () => {
    type Row = {
      amount: number;
      status: "draft" | "active" | "archived";
    };

    const schema = createExcelSchema<Row>({ mode: "report" })
      .column("status", {
        header: () => "Status",
        accessor: "status",
        validation: (v) =>
          v
            .list(["draft", "active", "archived"])
            .prompt({ title: () => "Allowed values", message: () => "Choose a status" })
            .error({ title: () => "Invalid status", message: () => "Use a known status" }),
      })
      .column("amount", {
        header: () => "Amount",
        accessor: "amount",
        validation: (v) => v.integer().between(1, 10),
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table("orders", {
      rows: [{ amount: 3, status: "draft" }],
      schema,
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("<dataValidations");
    expect(content).toContain('type="whole"');
    expect(content).toContain('promptTitle="Allowed values"');
    expect(content).toContain('errorTitle="Invalid status"');
  });

  it("supports sheet protection and unlocked cell styles through the public buffered api", () => {
    const schema = createExcelSchema<{ input: number; formulaValue: number }>({ mode: "report" })
      .column("input", {
        accessor: "input",
        style: {
          protection: { locked: false },
        },
      })
      .column("formulaValue", {
        formula: ({ row }) => row.ref("input").mul(2),
        style: {
          protection: { hidden: true },
        },
      })
      .build();

    const workbook = createWorkbook();
    workbook
      .sheet("Protected", {
        protection: {
          selectUnlockedCells: true,
          selectLockedCells: false,
        },
      })
      .table("protected", {
        rows: [{ input: 5, formulaValue: 10 }],
        schema,
      });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("<sheetProtection");
    expect(content).toContain('applyProtection="1"');
    expect(content).toContain('<protection locked="0"/>');
    expect(content).toContain('<protection hidden="1"/>');
  });

  it("supports sheet passwords and workbook structure protection through the public buffered api", () => {
    const schema = createExcelSchema<{ input: number }>({ mode: "report" })
      .column("input", {
        accessor: "input",
        style: {
          protection: { locked: false },
        },
      })
      .build();

    const workbook = createWorkbook({
      protection: {
        password: "open-sesame",
        structure: true,
      },
    });
    workbook
      .sheet("Protected", {
        protection: {
          password: "sheet-secret",
          selectUnlockedCells: true,
        },
      })
      .table("protected", {
        rows: [{ input: 5 }],
        schema,
      });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("<workbookProtection");
    expect(content).toContain('lockStructure="1"');
    expect(content).toContain('workbookPassword="');
    expect(content).toContain("<sheetProtection");
    expect(content).toContain('password="');
  });

  it("supports independent hyperlinks through the public buffered api", () => {
    const schema = createExcelSchema<{
      customer: string;
      id: string;
      linked: boolean;
    }>({ mode: "report" })
      .column("customer", {
        accessor: "customer",
        hyperlink: (row) =>
          row.linked
            ? { target: `https://example.com/customers/${row.id}`, tooltip: "Open customer" }
            : null,
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table("orders", {
      rows: [
        { customer: "Acme", id: "c_1", linked: true },
        { customer: "No Link", id: "c_2", linked: false },
      ],
      schema,
    });

    const content = Buffer.from(workbook.toUint8Array()).toString("latin1");
    expect(content).toContain("<hyperlinks>");
    expect(content).toContain('Target="https://example.com/customers/c_1"');
    expect(content).not.toContain('Target="https://example.com/customers/c_2"');
  });
});
