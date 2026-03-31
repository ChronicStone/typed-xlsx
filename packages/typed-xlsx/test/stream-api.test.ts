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

    await workbook.sheet("Orders").table({
      id: "orders",
      schema,
      select: {
        include: ["name"],
        exclude: ["amount"],
      },
    });

    await workbook.sheet("Orders").table({
      id: "orders-invalid",
      schema,
      select: {
        // @ts-expect-error invalid column id should be rejected
        include: ["email"],
      },
    });
  });

  it("supports typed stream selection for group ids and requires group context", async () => {
    type Row = { name: string; orgs: number[] };

    const schema = createExcelSchema<Row>()
      .column("name", { accessor: "name" })
      .group("memberships", (builder, orgIds: number[]) => {
        for (const id of orgIds) {
          builder.column(`org-${id}`, {
            accessor: (row) => row.orgs.includes(id),
          });
        }
      })
      .build();

    const workbook = createWorkbookStream({
      tempStorage: "memory",
    });

    await workbook.sheet("Sheet").table({
      id: "groups",
      schema,
      select: { exclude: ["memberships"] },
    });

    await workbook.sheet("Sheet").table({
      id: "groups-invalid",
      schema,
      context: { memberships: [1, 2, 3] },
      select: {
        // @ts-expect-error generated child ids are not part of the public select API
        exclude: ["org-2"],
      },
    });

    // @ts-expect-error grouped schemas require context when the group is selected
    const _missingContextInput: WorkbookStreamResolvedTableOptions<
      typeof schema,
      { include: ["memberships"] }
    > = {
      id: "groups-missing-context",
      schema,
      select: { include: ["memberships"] },
    };
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

    const table = await workbook.sheet("Sheet").table({
      id: "derived",
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
    const table = await workbook.sheet("Orders").table({
      id: "orders",
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
    const table = await workbook.sheet("Logs").table({
      id: "logs",
      schema,
    });

    await table.commit({
      rows: [{ value: "line-1" }, { value: "line-2" }],
    });

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "typed-xlsx-public-stream-"));
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
      .table({
        id: "audit",
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

    const schema = createExcelSchema<User>()
      .column("firstName", {
        accessor: "firstName",
      })
      .group("orgs", (builder, orgs: Array<{ id: number; name: string }>) => {
        for (const org of orgs) {
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
    const table = await workbook.sheet("Users").table({
      id: "users",
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
    const table = await workbook.sheet("Logs").table({
      id: "logs",
      autoFilter: { enabled: true },
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
});
