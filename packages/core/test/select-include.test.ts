import { unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { createExcelSchema, createWorkbook, createWorkbookStream } from "../src";

type Row = { id: string; net: number; tax: number; x: number; months: Record<string, number> };
type Selection = {
  include?: Array<"id" | "money" | "outer" | "months">;
  exclude?: Array<"id" | "money" | "outer" | "months">;
};

const rows: Row[] = [{ id: "a", net: 1, tax: 2, x: 3, months: { m1: 4, m2: 5 } }];
const context = { months: ["m1", "m2"] };

function buildSchema(idCondition?: () => boolean) {
  return createExcelSchema<Row, { months: string[] }>()
    .column("id", { header: "id", accessor: "id", condition: idCondition })
    .group("money", (group) =>
      group
        .column("net", { header: "net", accessor: "net" })
        .column("tax", { header: "tax", accessor: "tax" }),
    )
    .group("outer", (outer) =>
      outer.group("inner", (inner) => inner.column("x", { header: "x", accessor: "x" })),
    )
    .dynamic("months", (builder, { ctx }) => {
      for (const month of ctx.months) {
        builder.column(month, { header: month, accessor: (row) => row.months[month] ?? 0 });
      }
    })
    .build();
}

function headerLabels(bytes: Uint8Array) {
  const archive = unzipSync(bytes);
  const read = (path: string) => {
    const entry = archive[path];
    return entry ? new TextDecoder().decode(entry) : "";
  };
  const shared = [
    ...read("xl/sharedStrings.xml").matchAll(/<si>[\s\S]*?<t[^>]*>([^<]*)<\/t>/g),
  ].map((match) => match[1] as string);
  const sheetRows = [
    ...read("xl/worksheets/sheet1.xml").matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g),
  ].map((row) =>
    [...(row[1] as string).matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((cell) => {
      const attributes = cell[1] as string;
      const body = cell[2] ?? "";
      if (attributes.includes('t="s"')) return shared[Number(/<v>(\d+)<\/v>/.exec(body)?.[1])];
      if (attributes.includes('t="inlineStr"')) return /<t[^>]*>([^<]*)<\/t>/.exec(body)?.[1];
      const value = /<v>([^<]*)<\/v>/.exec(body)?.[1];
      return value === undefined ? undefined : Number(value);
    }),
  );
  // The header row is the last row of text before the first row that holds numbers (the data).
  const dataIndex = sheetRows.findIndex((row) => row.some((value) => typeof value === "number"));
  return sheetRows[dataIndex - 1];
}

async function streamBytes(workbook: ReturnType<typeof createWorkbookStream>) {
  const reader = workbook.toReadableStream().getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function buffered(select: Selection, schema = buildSchema()) {
  return headerLabels(
    createWorkbook().sheet("S").table("t", { schema, rows, context, select }).toUint8Array(),
  );
}

async function streamed(select: Selection, schema = buildSchema()) {
  const workbook = createWorkbookStream({ tempStorage: "memory" });
  const table = await workbook.sheet("S").table("t", { schema, context, select });
  await table.commit({ rows });
  return headerLabels(await streamBytes(workbook));
}

const cases: Array<[string, Selection, string[]]> = [
  ["a group id keeps every column of the group", { include: ["money"] }, ["net", "tax"]],
  ["a dynamic id keeps every generated column", { include: ["months"] }, ["m1", "m2"]],
  ["an outer group id keeps columns of nested groups", { include: ["outer"] }, ["x"]],
  ["column ids select columns inside a group", { include: ["id", "money"] }, ["id", "net", "tax"]],
  [
    "exclude still removes groups and dynamic blocks",
    { exclude: ["money"] },
    ["id", "x", "m1", "m2"],
  ],
  ["exclude removes an outer group", { exclude: ["outer", "months"] }, ["id", "net", "tax"]],
];

describe("select include with group and dynamic ids", () => {
  it.each(cases)("buffered: %s", (_name, select, expected) => {
    expect(buffered(select)).toEqual(expected);
  });

  it.each(cases)("stream: %s", async (_name, select, expected) => {
    expect(await streamed(select)).toEqual(expected);
  });

  it("does not run the condition of a column that include drops (buffered)", () => {
    const condition = vi.fn(() => true);
    expect(buffered({ include: ["money"] }, buildSchema(condition))).toEqual(["net", "tax"]);
    expect(condition).not.toHaveBeenCalled();
  });

  it("does not run the condition of a column that include drops (stream)", async () => {
    const condition = vi.fn(() => true);
    expect(await streamed({ include: ["money"] }, buildSchema(condition))).toEqual(["net", "tax"]);
    expect(condition).not.toHaveBeenCalled();
  });
});
