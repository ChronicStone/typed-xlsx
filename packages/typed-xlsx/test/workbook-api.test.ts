import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createExcelSchema, createWorkbook } from "../src";

describe("public buffered api", () => {
  it("builds a workbook as a Uint8Array", () => {
    const schema = createExcelSchema<{ amount: number; name: string }>()
      .column("name", {
        accessor: "name",
      })
      .column("amount", {
        accessor: "amount",
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Orders").table({
      id: "orders",
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
    const schema = createExcelSchema<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Logs").table({
      id: "logs",
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

    const schema = createExcelSchema<User>()
      .column("firstName", {
        accessor: "firstName",
      })
      .group<Array<{ id: number; name: string }>>("orgs", (builder, orgs) => {
        for (const org of orgs) {
          builder.column(`org-${org.id}`, {
            header: org.name,
            accessor: (row) => row.organizations.some((entry) => entry.id === org.id),
          });
        }
      })
      .build();

    const workbook = createWorkbook();
    workbook.sheet("Users").table({
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
});
