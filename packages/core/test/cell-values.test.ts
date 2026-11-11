import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createExcelSchema, createWorkbook, createWorkbookStream } from "../src";
import { expectWorkbookXmlToBeWellFormed, unzipWorkbookEntries } from "./support/xlsx";

type Row = { value: unknown };

function valueSchema(options: { hyperlink?: (row: Row) => string } = {}) {
  return createExcelSchema<Row>()
    .column("value", {
      header: "Value",
      accessor: (row) => row.value as never,
      ...(options.hyperlink ? { hyperlink: options.hyperlink as never } : {}),
    })
    .build();
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

type Builder = "buffered" | "stream";

async function write(
  builder: Builder,
  value: unknown,
  schema = valueSchema(),
): Promise<Map<string, string>> {
  if (builder === "buffered") {
    const bytes = createWorkbook()
      .sheet("Data")
      .table("data", { schema, rows: [{ value }] });
    return unzipWorkbookEntries(bytes.toUint8Array());
  }

  const workbook = createWorkbookStream({ tempStorage: "memory" });
  const table = await workbook.sheet("Data").table("data", { schema });
  await table.commit({ rows: [{ value }] });
  return unzipWorkbookEntries(await streamBytes(workbook));
}

function sheetXml(entries: Map<string, string>) {
  return entries.get("xl/worksheets/sheet1.xml") ?? "";
}

describe.each<Builder>(["buffered", "stream"])("cell value safety (%s)", (builder) => {
  it("removes characters XML 1.0 forbids and keeps the file well-formed", async () => {
    const entries = await write(builder, "a\u0000b\u0008c\u001fd￾e\ud800f");

    expect(entries.get("xl/sharedStrings.xml")).toContain("<t>abcdef</t>");
    expectWorkbookXmlToBeWellFormed(entries);
  });

  it("keeps leading and trailing spaces with xml:space", async () => {
    const entries = await write(builder, "  padded  ");

    expect(entries.get("xl/sharedStrings.xml")).toContain('<t xml:space="preserve">  padded  </t>');
  });

  it("throws for NaN and Infinity, naming the cell", async () => {
    await expect(write(builder, Number.NaN)).rejects.toThrow(/Cell A2 has the number NaN/);
    await expect(write(builder, Number.POSITIVE_INFINITY)).rejects.toThrow(/Infinity/);
  });

  it("throws for invalid and out-of-range dates, naming the cell", async () => {
    await expect(write(builder, new Date("invalid"))).rejects.toThrow(
      /Cell A2 has an invalid Date/,
    );
    await expect(write(builder, new Date(Date.UTC(1850, 0, 1)))).rejects.toThrow(
      /Cell A2 has the date 1850-01-01.*outside Excel's range/,
    );
  });

  it("writes a bigint as a number when safe and as text otherwise", async () => {
    const small = await write(builder, 42n);
    expect(sheetXml(small)).toContain("<v>42</v>");

    const large = await write(builder, 12345678901234567890n);
    expect(large.get("xl/sharedStrings.xml")).toContain("<t>12345678901234567890</t>");
  });

  it("does not turn a formula-shaped row value into a formula", async () => {
    await expect(write(builder, { kind: "formula", formula: "1+1" } as never)).rejects.toThrow(
      /got a object value/,
    );
  });

  it("rejects script hyperlink targets and keeps normal ones", async () => {
    const schema = (target: string) => valueSchema({ hyperlink: () => target });

    await expect(write(builder, "x", schema("javascript:alert(1)"))).rejects.toThrow(
      /Column 'value' has a hyperlink with the 'javascript:' scheme/,
    );
    await expect(write(builder, "x", schema("  JaVa\tScript:alert(1)"))).rejects.toThrow(
      /'javascript:'/,
    );
    await expect(write(builder, "x", schema("data:text/html,hi"))).rejects.toThrow(/'data:'/);

    const entries = await write(builder, "x", schema("https://x.y"));
    expect(Array.from(entries.values()).join("\n")).toContain("https://x.y");
  });
});

describe("cell value safety (plain values)", () => {
  it("still writes finite numbers, booleans and valid dates", () => {
    const archive = unzipSync(
      createWorkbook()
        .sheet("Data")
        .table("data", { schema: valueSchema(), rows: [{ value: 1.5 }, { value: true }] })
        .toUint8Array(),
    );
    const sheet = new TextDecoder().decode(archive["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain("<v>1.5</v>");
    expect(sheet).toContain('t="b"');
  });
});
