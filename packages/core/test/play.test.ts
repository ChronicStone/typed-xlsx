import fs from "node:fs";
import path from "node:path";
import { faker } from "@faker-js/faker";
import { describe, it } from "vitest";
import { createExcelSchema, createWorkbook } from "../src";

describe("should generate the play excel file", () => {
  it("exported", { timeout: 30000 }, () => {
    interface User {
      id: string;
      name: string;
      birthDate: Date;
      balance: number;
    }
    const schema = createExcelSchema<User>()
      .column("id", { accessor: "id" })
      .column("name", {
        accessor: "name",
        style: { fill: { color: { rgb: "FFFF00" } } },
        headerStyle: { fill: { color: { rgb: "00FF00" } } },
      })
      .column("birthDate", { accessor: "birthDate", format: "d mmm yyyy" })
      .column("birthDate2", { accessor: "birthDate", format: "d mmm yyyy" })
      .column("balanceUsd", { accessor: "balance", style: { numFmt: "EUR#,##0.00" } })
      .column("balanceEur", { accessor: "balance", style: { numFmt: "USD#,##0.00" } })
      .build();

    const users: User[] = Array.from({ length: 100000 }, (_, i) => ({
      id: i.toString(),
      name: "John",
      balance: +faker.finance.amount({ min: 0, max: 1000000, dec: 2 }),
      birthDate: faker.date.past(),
    }));

    const workbook = createWorkbook();
    workbook.sheet("Sheet1", { tablesPerRow: 2 }).table("table-1", {
      rows: users,
      schema,
      title: "Table 1",
    });

    const file = workbook.toUint8Array();

    const outputPath = path.resolve(import.meta.dirname, "../examples/playground.xlsx");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, file);
  });
});
