import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createExcelSchema,
  createWorkbookStream,
  type TableSelection,
  type WorkbookStreamResolvedTableOptions,
} from "../src";

describe("public stream api", () => {
  it("infers stream selection ids from the schema", async () => {
    const schema = createExcelSchema<{ amount: number; name: string }>()
      .column("name", {
        accessor: "name",
      })
      .column("amount", {
        accessor: "amount",
      })
      .build();

    type Selection = TableSelection<"name" | "amount">;

    expectTypeOf<Selection["exclude"]>().toEqualTypeOf<
      readonly ("name" | "amount")[] | undefined
    >();

    const workbook = createWorkbookStream({
      tempStorage: "memory",
    });

    await workbook.sheet("Orders").table("orders", {
      schema,
      select: {
        include: ["name"],
        exclude: ["amount"],
      },
    });

    await workbook.sheet("Orders").table("orders-invalid", {
      schema,
      select: {
        // @ts-expect-error invalid column id should be rejected
        include: ["email"],
      },
    });
  });

  it("supports typed stream selection for group ids and requires group context", async () => {
    type Row = { name: string; orgs: number[] };

    const schema = createExcelSchema<Row, { memberships: number[] }>()
      .column("name", { accessor: "name" })
      .dynamic("memberships", (builder, { ctx }) => {
        for (const id of ctx.memberships) {
          builder.column(`org-${id}`, {
            accessor: (row) => row.orgs.includes(id),
          });
        }
      })
      .build();

    const workbook = createWorkbookStream({
      tempStorage: "memory",
    });

    await workbook.sheet("Sheet").table("groups", {
      schema,
      context: { memberships: [] },
      select: { exclude: ["memberships"] },
    });

    await workbook.sheet("Sheet").table("groups-invalid", {
      schema,
      context: { memberships: [1, 2, 3] },
      select: {
        // @ts-expect-error generated child ids are not part of the public select API
        exclude: ["org-2"],
      },
    });

    // @ts-expect-error contextful schemas always require context
    const _missingContextInput: WorkbookStreamResolvedTableOptions<
      typeof schema,
      { include: ["memberships"] }
    > = {
      schema,
      select: { include: ["memberships"] },
    };
  });

  it("supports flat column groups in streamed native Excel table schemas", async () => {
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

    const workbook = createWorkbookStream({ tempStorage: "memory" });
    await expect(
      workbook.sheet("Sheet").table("groups", {
        schema,
        context: { memberships: [1, 2] },
      }),
    ).resolves.toBeDefined();
  });

  it("allows formulas inside groups to reference outer predecessor columns in stream report mode", async () => {
    const schema = createExcelSchema<{ amount: number }>()
      .column("amount", { accessor: "amount" })
      .group("derived", (builder) => {
        builder
          .column("doubleAmount", {
            formula: ({ refs }) => refs.column("amount").mul(2),
          })
          .column("tripleAmount", {
            formula: ({ refs }) => refs.column("doubleAmount").add(refs.column("amount")),
          });
      })
      .build();

    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook.sheet("Orders").table("orders", { schema });

    await table.commit({ rows: [{ amount: 3 }] });

    const stream = workbook.toNodeReadable();
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const content = Buffer.concat(chunks).toString("latin1");
    expect(content).toContain("<f>(A3*2)</f>");
    expect(content).toContain("<f>(B3+A3)</f>");
  });

  it("allows formulas inside groups to reference outer predecessor columns in stream excel-table mode", async () => {
    const schema = createExcelSchema<{ amount: number }>({ mode: "excel-table" })
      .column("amount", { accessor: "amount" })
      .group("derived", (builder) => {
        builder
          .column("doubleAmount", {
            formula: ({ refs }) => refs.column("amount").mul(2),
          })
          .column("tripleAmount", {
            formula: ({ refs }) => refs.column("doubleAmount").add(refs.column("amount")),
          });
      })
      .build();

    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook.sheet("Orders").table("orders", { schema });

    await table.commit({ rows: [{ amount: 3 }] });

    const stream = workbook.toNodeReadable();
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const content = Buffer.concat(chunks).toString("latin1");
    expect(content).toContain("<f>([@[Amount]]*2)</f>");
    expect(content).toContain("<f>([@[Double amount]]+[@[Amount]])</f>");
  });

  it("supports aggregating dynamic groups from later stream report formulas", async () => {
    const schema = createExcelSchema<{ amount: number }>()
      .column("amount", { accessor: "amount" })
      .group("derived", (builder) => {
        builder
          .column("doubleAmount", {
            formula: ({ refs }) => refs.column("amount").mul(2),
          })
          .column("tripleAmount", {
            formula: ({ refs }) => refs.column("amount").mul(3),
          });
      })
      .column("derivedTotal", {
        formula: ({ refs, fx }) => fx.sum(refs.group("derived")),
      })
      .column("derivedMin", {
        formula: ({ refs, fx }) => fx.min(refs.group("derived")),
      })
      .build();

    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook.sheet("Orders").table("orders", { schema });

    await table.commit({ rows: [{ amount: 3 }] });

    const stream = workbook.toNodeReadable();
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const content = Buffer.concat(chunks).toString("latin1");
    expect(content).toContain("<f>SUM(B3,C3)</f>");
    expect(content).toContain("<f>MIN(B3,C3)</f>");
  });

  it("supports aggregating dynamic groups from later stream excel-table formulas", async () => {
    const schema = createExcelSchema<{ amount: number }>({ mode: "excel-table" })
      .column("amount", { accessor: "amount" })
      .group("derived", (builder) => {
        builder
          .column("doubleAmount", {
            formula: ({ refs }) => refs.column("amount").mul(2),
          })
          .column("tripleAmount", {
            formula: ({ refs }) => refs.column("amount").mul(3),
          });
      })
      .column("derivedTotal", {
        formula: ({ refs, fx }) => fx.sum(refs.group("derived")),
      })
      .column("derivedCount", {
        formula: ({ refs, fx }) => fx.count(refs.group("derived")),
      })
      .build();

    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook.sheet("Orders").table("orders", { schema });

    await table.commit({ rows: [{ amount: 3 }] });

    const stream = workbook.toNodeReadable();
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const content = Buffer.concat(chunks).toString("latin1");
    expect(content).toContain("<f>SUM([@[Double amount]],[@[Triple amount]])</f>");
    expect(content).toContain("<f>COUNT([@[Double amount]],[@[Triple amount]])</f>");
  });

  it("does not require context for stream groups without a context parameter", async () => {
    const schema = createExcelSchema<{ name: string; tags: string[] }>()
      .column("name", { accessor: "name" })
      .group("derived", (builder) => {
        builder.column("tagCount", { accessor: (row) => row.tags.length });
      })
      .build();

    const workbook = createWorkbookStream({
      tempStorage: "memory",
    });

    const table = await workbook.sheet("Sheet").table("derived", {
      schema,
      select: { include: ["derived", "name"] },
    });

    await table.commit({
      rows: [{ name: "Ada", tags: ["a", "b"] }],
    });
  });

  it("can pipe a workbook to a node writable stream", async () => {
    const schema = createExcelSchema<{ amount: number; name: string }>()
      .column("name", {
        accessor: "name",
      })
      .column("amount", {
        accessor: "amount",
      })
      .build();

    const workbook = createWorkbookStream({
      tempStorage: "memory",
    });
    const table = await workbook.sheet("Orders").table("orders", {
      schema,
    });

    await table.commit({
      rows: [
        { amount: 3, name: "A" },
        { amount: 7, name: "B" },
      ],
    });

    const writable = new PassThrough();
    const chunks: Buffer[] = [];
    writable.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    await workbook.pipeToNode(writable);

    const bytes = Buffer.concat(chunks);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it("can write a workbook directly to a file path", async () => {
    const schema = createExcelSchema<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const workbook = createWorkbookStream();
    const table = await workbook.sheet("Logs").table("logs", {
      schema,
    });

    await table.commit({
      rows: [{ value: "line-1" }, { value: "line-2" }],
    });

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "xlsmith-public-stream-"));
    const filePath = path.join(directory, "report.xlsx");

    await workbook.writeToFile(filePath);

    const bytes = fs.readFileSync(filePath);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it("supports stream sheet view options and low-memory string mode", async () => {
    const schema = createExcelSchema<{ notes: string }>()
      .column("notes", {
        accessor: "notes",
      })
      .build();

    const workbook = createWorkbookStream({
      tempStorage: "memory",
      memoryProfile: "low-memory",
    });
    const table = await workbook
      .sheet("Audit", {
        freezePane: { rows: 1 },
        rightToLeft: true,
      })
      .table("audit", {
        schema,
      });

    await table.commit({
      rows: [{ notes: "one" }, { notes: "two" }],
    });

    const stream = workbook.toNodeReadable();
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const content = Buffer.concat(chunks).toString("latin1");
    expect(content).toContain('rightToLeft="1"');
    expect(content).toContain('state="frozen"');
    expect(content).toContain('t="inlineStr"');
    expect(content).not.toContain("sharedStrings.xml");
  });

  it("expands grouped columns from table context in stream mode", async () => {
    type User = {
      firstName: string;
      organizations: Array<{ id: number; name: string }>;
    };

    const schema = createExcelSchema<User, { orgs: Array<{ id: number; name: string }> }>()
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

    const workbook = createWorkbookStream({
      tempStorage: "memory",
    });
    const table = await workbook.sheet("Users").table("users", {
      schema,
      context: {
        orgs: [
          { id: 1, name: "Core" },
          { id: 2, name: "Finance" },
        ],
      },
    });

    await table.commit({
      rows: [
        {
          firstName: "Ada",
          organizations: [{ id: 2, name: "Finance" }],
        },
      ],
    });

    const stream = workbook.toNodeReadable();
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const content = Buffer.concat(chunks).toString("latin1");
    expect(content).toContain("Core");
    expect(content).toContain("Finance");
  });

  it("accepts stream autoFilter table options through the public api", async () => {
    const schema = createExcelSchema<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const workbook = createWorkbookStream({
      tempStorage: "memory",
    });
    const table = await workbook.sheet("Logs").table("logs", {
      autoFilter: true,
      schema,
    });

    await table.commit({
      rows: [{ value: "line-1" }],
    });

    const stream = workbook.toNodeReadable();
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const content = Buffer.concat(chunks).toString("latin1");
    expect(content).toContain('<autoFilter ref="A1:A2"/>');
  });

  it("accepts stream native Excel table options through the public api", async () => {
    const schema = createExcelSchema<{ amount: number; id: string }>({ mode: "excel-table" })
      .column("id", {
        accessor: "id",
      })
      .column("amount", {
        accessor: "amount",
      })
      .build();

    const workbook = createWorkbookStream({
      tempStorage: "memory",
    });
    const table = await workbook.sheet("Orders").table("orders", {
      autoFilter: true,
      name: "OrdersTable",
      schema,
      style: "TableStyleMedium2",
    });

    await table.commit({
      rows: [{ amount: 42, id: "A-1" }],
    });

    const stream = workbook.toNodeReadable();
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const content = Buffer.concat(chunks).toString("latin1");
    expect(content).toContain("xl/tables/table1.xml");
    expect(content).toContain("sheet1.xml.rels");
    expect(content).toContain('<tableParts count="1">');
    expect(content).toContain('Target="../tables/table1.xml"');
    expect(content).toContain('displayName="OrdersTable"');
  });

  it("supports the public stream validation builder api with integer and lazy messages", async () => {
    type Row = {
      amount: number;
      status: "draft" | "active" | "archived";
    };

    const schema = createExcelSchema<Row>()
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

    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook.sheet("Orders").table("orders", { schema });
    await table.commit({ rows: [{ amount: 3, status: "draft" }] });

    const stream = workbook.toNodeReadable();
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const content = Buffer.concat(chunks).toString("latin1");
    expect(content).toContain("<dataValidations");
    expect(content).toContain('type="whole"');
    expect(content).toContain('promptTitle="Allowed values"');
    expect(content).toContain('errorTitle="Invalid status"');
  });

  it("supports sheet protection and unlocked cell styles through the public stream api", async () => {
    const schema = createExcelSchema<{ input: number; formulaValue: number }>()
      .column("input", {
        accessor: "input",
        style: {
          protection: { locked: false },
        },
      })
      .column("formulaValue", {
        formula: ({ refs }) => refs.column("input").mul(2),
        style: {
          protection: { hidden: true },
        },
      })
      .build();

    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook
      .sheet("Protected", {
        protection: {
          selectUnlockedCells: true,
          selectLockedCells: false,
        },
      })
      .table("protected", { schema });
    await table.commit({ rows: [{ input: 5, formulaValue: 10 }] });

    const stream = workbook.toNodeReadable();
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const content = Buffer.concat(chunks).toString("latin1");
    expect(content).toContain("<sheetProtection");
    expect(content).toContain('applyProtection="1"');
    expect(content).toContain('<protection locked="0"/>');
    expect(content).toContain('<protection hidden="1"/>');
  });

  it("supports sheet passwords and workbook structure protection through the public stream api", async () => {
    const schema = createExcelSchema<{ input: number }>()
      .column("input", {
        accessor: "input",
        style: {
          protection: { locked: false },
        },
      })
      .build();

    const workbook = createWorkbookStream({
      protection: {
        password: "open-sesame",
        structure: true,
      },
      tempStorage: "memory",
    });
    const table = await workbook
      .sheet("Protected", {
        protection: {
          password: "sheet-secret",
          selectUnlockedCells: true,
        },
      })
      .table("protected", { schema });
    await table.commit({ rows: [{ input: 5 }] });

    const stream = workbook.toNodeReadable();
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const content = Buffer.concat(chunks).toString("latin1");
    expect(content).toContain("<workbookProtection");
    expect(content).toContain('lockStructure="1"');
    expect(content).toContain('workbookPassword="');
    expect(content).toContain("<sheetProtection");
    expect(content).toContain('password="');
  });

  it("supports independent hyperlinks through the public stream api", async () => {
    const schema = createExcelSchema<{
      customer: string;
      id: string;
      linked: boolean;
    }>()
      .column("customer", {
        accessor: "customer",
        hyperlink: (row) =>
          row.linked
            ? { target: `https://example.com/customers/${row.id}`, tooltip: "Open customer" }
            : null,
      })
      .build();

    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook.sheet("Orders").table("orders", { schema });
    await table.commit({
      rows: [
        { customer: "Acme", id: "c_1", linked: true },
        { customer: "No Link", id: "c_2", linked: false },
      ],
    });

    const stream = workbook.toNodeReadable();
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const content = Buffer.concat(chunks).toString("latin1");
    expect(content).toContain("<hyperlinks>");
    expect(content).toContain('Target="https://example.com/customers/c_1"');
    expect(content).not.toContain('Target="https://example.com/customers/c_2"');
  });
});
