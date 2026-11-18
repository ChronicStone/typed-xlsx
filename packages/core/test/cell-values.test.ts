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

  it("writes dates before 1900-03-01 with Excel's 1900 serials (#89)", async () => {
    const serial = async (iso: string) =>
      /<c r="A2"[^>]*><v>([^<]+)<\/v>/.exec(sheetXml(await write(builder, new Date(iso))))?.[1];

    expect(await serial("1900-01-01T00:00:00Z")).toBe("1");
    expect(await serial("1900-02-28T12:00:00Z")).toBe("59.5");
    expect(await serial("1900-03-01T00:00:00Z")).toBe("61");
    expect(await serial("2024-05-17T00:00:00Z")).toBe("45429");
  });

  it("keeps literal _xHHHH_ text instead of letting readers decode it (#89)", async () => {
    const text = async (value: string) =>
      /<si><t>([^<]*)<\/t><\/si><\/sst>/.exec(
        (await write(builder, value)).get("xl/sharedStrings.xml")!,
      )?.[1];

    expect(await text("code _x0041_ here")).toBe("code _x005F_x0041_ here");
    expect(await text("id_xbeef_1")).toBe("id_x005F_xbeef_1");
    expect(await text("_x0041_x0042_")).toBe("_x005F_x0041_x005F_x0042_");
    expect(await text("_x005F_")).toBe("_x005F_x005F_");
    expect(await text("_X0041_ a_x00 _x00G1_")).toBe("_X0041_ a_x00 _x00G1_");
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

describe("_xHHHH_ text in table and pivot parts (#89)", () => {
  it("escapes table column names, formulas, totals labels and pivot items like the cells they mirror", () => {
    type Item = { cat: string; n: number };
    const schema = createExcelSchema<Item>({ mode: "excel-table" })
      .column("cat", { header: "H_x0041_", accessor: "cat", totalsRow: { label: "T_x0042_" } })
      .column("n", { header: "N", accessor: "n", totalsRow: { function: "sum" } })
      .column("double", { header: "Double", formula: ({ refs }) => refs.column("cat").mul(2) })
      .build();
    const archive = unzipSync(
      createWorkbook()
        .sheet("Data")
        .table("data", { schema, rows: [{ cat: "c_x0043_", n: 1 }], totalsRow: true })
        .sheet("Pivot")
        .pivot("p", ({ refs }) =>
          refs
            .sheet("Data")
            .table("data")
            .pivot({ rows: ["cat"], values: { n: "sum" } }),
        )
        .toUint8Array(),
    );
    const text = (path: string) => new TextDecoder().decode(archive[path]);

    expect(text("xl/tables/table1.xml")).toContain('name="H_x005F_x0041_"');
    expect(text("xl/tables/table1.xml")).toContain('totalsRowLabel="T_x005F_x0042_"');
    // Excel decodes formula text too, so a structured reference must be escaped like the column name.
    expect(text("xl/worksheets/sheet1.xml")).toContain("[[#This Row],[H_x005F_x0041_]]");
    expect(text("xl/worksheets/sheet1.xml")).not.toContain("[H_x0041_]");
    expect(text("xl/pivotCache/pivotCacheDefinition1.xml")).toContain(
      '<cacheField name="H_x005F_x0041_"',
    );
    expect(text("xl/pivotCache/pivotCacheDefinition1.xml")).toContain('<s v="c_x005F_x0043_"/>');
    expect(text("xl/worksheets/sheet2.xml")).toContain("<t>c_x005F_x0043_</t>");
    expect(text("xl/pivotTables/pivotTable1.xml")).toContain('rowHeaderCaption="H_x005F_x0041_"');
  });

  it("escapes sheet and table names with the formulas that use them, but not chart references", () => {
    type Point = { m: string; a: number };
    const schema = createExcelSchema<Point>({ mode: "excel-table" })
      .column("m", { header: "M", accessor: "m" })
      .column("a", { header: "A", accessor: "a" })
      .column("b", { header: "B", formula: ({ refs }) => refs.column("a").mul(2) })
      .build();
    const archive = unzipSync(
      createWorkbook()
        .sheet("S_x0041_")
        .table("t_x0041_", { schema, rows: [{ m: "x", a: 1 }] })
        .sheet("Dash")
        .chart("c", ({ refs }) => ({
          marks: [refs.sheet("S_x0041_").table("t_x0041_").bar({ x: "m", y: "a" })],
        }))
        .toUint8Array(),
    );
    const text = (path: string) => new TextDecoder().decode(archive[path]);

    expect(text("xl/workbook.xml")).toContain('<sheet name="S_x005F_x0041_"');
    expect(text("xl/tables/table1.xml")).toContain('displayName="t_x005F_x0041_"');
    expect(text("xl/worksheets/sheet1.xml")).toContain(
      "<f>(t_x005F_x0041_[[#This Row],[A]]*2)</f>",
    );
    // Excel reads chart references as written, so they keep the literal sheet name.
    expect(text("xl/charts/chart1.xml")).toContain("<c:f>&apos;S_x0041_&apos;!$B$2</c:f>");
  });
});
