import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { createSchema, createWorkbookStream } from "../src";

describe("public stream api", () => {
  it("can pipe a workbook to a node writable stream", async () => {
    const schema = createSchema<{ amount: number; name: string }>()
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
    const schema = createSchema<{ value: string }>()
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
    const schema = createSchema<{ notes: string }>()
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
});
