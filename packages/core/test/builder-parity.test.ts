import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vite-plus/test";
import { createExcelSchema, createWorkbook, createWorkbookStream } from "../src";

/**
 * The buffered and the stream builder carry separate row writers. These cases build the same
 * tables with both and require the worksheet, table and shared string parts to be equal, so a
 * fix applied to one writer and not the other fails here.
 */

type TableCase = {
  id: string;
  schema: any;
  rows: any[];
  options?: Record<string, unknown>;
};

type ParityCase = {
  name: string;
  /** A difference between the builders that exists today. The case must fail until it is fixed. */
  knownDifference?: string;
  sheetOptions?: Record<string, unknown>;
  tables: TableCase[];
};

function buildBuffered(parity: ParityCase) {
  let sheet: any = createWorkbook().sheet("S", parity.sheetOptions as never);
  for (const table of parity.tables) {
    sheet = sheet.table(table.id, { schema: table.schema, rows: table.rows, ...table.options });
  }
  return sheet.toUint8Array() as Uint8Array;
}

async function buildStream(parity: ParityCase) {
  const workbook = createWorkbookStream({ tempStorage: "memory" });
  const sheet: any = workbook.sheet("S", parity.sheetOptions as never);
  for (const table of parity.tables) {
    const handle = await sheet.table(table.id, { schema: table.schema, ...table.options });
    await handle.commit({ rows: table.rows });
  }

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

function parts(bytes: Uint8Array) {
  const decoder = new TextDecoder();
  return new Map(
    Object.entries(unzipSync(bytes)).map(([path, content]) => [path, decoder.decode(content)]),
  );
}

function comparedPaths(entries: Map<string, string>) {
  return [...entries.keys()]
    .filter((path) => /^xl\/(worksheets\/sheet\d+\.xml|tables\/table\d+\.xml)$/.test(path))
    .sort();
}

function fingerprint(xml: string | undefined) {
  return createHash("sha1")
    .update(xml ?? "")
    .digest("hex")
    .slice(0, 8);
}

function listChildren(xml: string, container: string, child: string) {
  const inner = new RegExp(`<${container}[ >][\\s\\S]*?</${container}>`).exec(xml)?.[0] ?? "";
  return [
    ...inner.matchAll(new RegExp(`<${child}(?: [^>]*)?(?:/>|>[\\s\\S]*?</${child}>)`, "g")),
  ].map((match) => match[0]);
}

/**
 * The builders register styles and strings in a different order and the stream builder writes
 * headers, titles and summaries as inline strings. Style ids, dxf ids and string ids are replaced
 * by what they stand for, so two sheets are equal when their cells look the same to Excel.
 */
function createNormalizer(entries: Map<string, string>) {
  const styles = entries.get("xl/styles.xml") ?? "";
  const fonts = listChildren(styles, "fonts", "font");
  const fills = listChildren(styles, "fills", "fill");
  const borders = listChildren(styles, "borders", "border");
  const numberFormats = new Map(
    [...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)].map((match) => [
      match[1]!,
      match[2]!,
    ]),
  );
  const cellFormats = listChildren(styles, "cellXfs", "xf").map((xf) =>
    xf
      .replace(/ fontId="(\d+)"/, (_, id) => ` font=${fonts[Number(id)]}`)
      .replace(/ fillId="(\d+)"/, (_, id) => ` fill=${fills[Number(id)]}`)
      .replace(/ borderId="(\d+)"/, (_, id) => ` border=${borders[Number(id)]}`)
      .replace(/ numFmtId="(\d+)"/, (_, id) => ` numFmt=${numberFormats.get(id) ?? id}`),
  );
  const differentialFormats = listChildren(styles, "dxfs", "dxf");
  const sharedStrings = listChildren(entries.get("xl/sharedStrings.xml") ?? "", "sst", "si").map(
    (si) => /<t[^>]*>([\s\S]*?)<\/t>/.exec(si)?.[1] ?? "",
  );

  return (path: string, xml: string) => {
    if (!path.startsWith("xl/worksheets/")) return xml;

    return xml
      .replace(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (_, attributes: string, body = "") => {
        const get = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1];
        const type = get("t");
        let content = body;
        let kind = type ?? "n";
        if (type === "s") {
          content = `<text>${sharedStrings[Number(/<v>(\d+)<\/v>/.exec(body)?.[1])]}</text>`;
          kind = "text";
        } else if (type === "inlineStr") {
          const text = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? "";
          // An empty inline string is an empty cell to Excel.
          content = text === "" ? "" : `<text>${text}</text>`;
          kind = text === "" ? "n" : "text";
        }
        const style = get("s");
        return `<c r="${get("r")}" kind="${kind}" style="${
          style === undefined ? "" : fingerprint(cellFormats[Number(style)])
        }">${content}</c>`;
      })
      .replace(
        /dxfId="(\d+)"/g,
        (_, id) => `dxf="${fingerprint(differentialFormats[Number(id)])}"`,
      );
  };
}

/** One entry per tag, so a failure names the tags that differ instead of one long line. */
function splitTags(xml: string) {
  return xml.split(/(?<=>)(?=<)/);
}

type Line = { sku: string; qty: number; price: number };
type Order = {
  id: string;
  customer: string;
  region: string;
  amount: number;
  tax: number;
  lines: Line[];
  months: Record<string, number>;
  status: "open" | "closed";
};

const orders: Order[] = [
  {
    id: "A-1",
    customer: "Acme & Sons",
    region: "EMEA",
    amount: 120.5,
    tax: 24.1,
    status: "open",
    lines: [
      { sku: "X1", qty: 2, price: 10 },
      { sku: "X2", qty: 1, price: 100.5 },
    ],
    months: { jan: 10, feb: 20, mar: 30 },
  },
  {
    id: "B-2",
    customer: "Bolt <Ltd>",
    region: "APAC",
    amount: 80,
    tax: 16,
    status: "closed",
    lines: [{ sku: "Y1", qty: 4, price: 20 }],
    months: { jan: 6, feb: 0, mar: 15 },
  },
  {
    id: "C-3",
    customer: "Cirrus",
    region: "EMEA",
    amount: 45,
    tax: 9,
    status: "open",
    lines: [],
    months: { jan: 1, feb: 2, mar: 3 },
  },
];

const reportWithChrome = createExcelSchema<Order>()
  .column("id", { header: "Order", accessor: "id", summary: (s) => [s.label("Total")] })
  .group("money", { header: "Money" }, (group) =>
    group
      .column("amount", {
        header: "Amount",
        accessor: "amount",
        style: { numFmt: "0.00" },
        summary: (s) => [s.formula("sum")],
      })
      .column("tax", { header: "Tax", accessor: "tax", summary: (s) => [s.formula("sum")] }),
  )
  .column("sku", {
    header: "SKU",
    accessor: (row) => row.lines.map((line) => line.sku),
  })
  .column("qty", {
    header: "Qty",
    accessor: (row) => row.lines.map((line) => line.qty),
  })
  .column("total", {
    header: "Total",
    formula: ({ refs }) => refs.column("amount").add(refs.column("tax")),
    summary: (s) => [
      s.cell({
        init: () => 0,
        step: (acc: number, row) => acc + row.amount + row.tax,
        finalize: (acc: number) => acc,
      }),
    ],
  })
  .build();

const reportWithDynamicColumns = createExcelSchema<Order, { months: string[] }>()
  .column("id", { header: "Order", accessor: "id" })
  .column("customer", { header: "Customer", accessor: "customer" })
  .group("outer", (outer) => outer.column("region", { header: "Region", accessor: "region" }))
  .dynamic("months", (builder, { ctx }) => {
    for (const month of ctx.months) {
      builder.column(month, { header: month, accessor: (row) => row.months[month] ?? 0 });
    }
  })
  .column("monthTotal", {
    header: "Months",
    formula: ({ refs, fx }) => fx.sum(refs.dynamic("months")),
  })
  .build();

const stackedSchema = createExcelSchema<Order>()
  .column("id", { header: "Order", accessor: "id" })
  .column("amount", { header: "Amount", accessor: "amount" })
  .column("tax", { header: "Tax", accessor: "tax" })
  .column("gross", {
    header: "Gross",
    formula: ({ refs }) => refs.column("amount").add(refs.column("tax")),
  })
  .column("ratio", {
    header: "Ratio",
    formula: ({ refs, fx }) => fx.round(refs.column("tax").div(refs.column("amount")), 2),
  })
  .build();

const excelTableWithTotals = createExcelSchema<Order>({ mode: "excel-table" })
  .column("id", { header: "Order", accessor: "id", totalsRow: { label: "Total" } })
  .column("amount", { header: "Amount", accessor: "amount", totalsRow: { function: "sum" } })
  .column("tax", { header: "Tax", accessor: "tax", totalsRow: { function: "sum" } })
  .column("gross", {
    header: "Gross",
    formula: ({ refs }) => refs.column("amount").add(refs.column("tax")),
    totalsRow: { function: "sum" },
  })
  .build();

const excelTableWithGroup = createExcelSchema<Order, { months: string[] }>({ mode: "excel-table" })
  .column("id", { header: "Order", accessor: "id" })
  .group("figures", (group) =>
    group
      .column("amount", { header: "Amount", accessor: "amount" })
      .column("tax", { header: "Tax", accessor: "tax" }),
  )
  .dynamic("months", (builder, { ctx }) => {
    for (const month of ctx.months) {
      builder.column(month, { header: month, accessor: (row) => row.months[month] ?? 0 });
    }
  })
  .column("figuresTotal", {
    header: "Figures",
    formula: ({ refs, fx }) => fx.sum(refs.group("figures")),
  })
  .column("monthsTotal", {
    header: "Months total",
    formula: ({ refs, fx }) => fx.sum(refs.dynamic("months")),
  })
  .column("monthsAverage", {
    header: "Months average",
    formula: ({ refs, fx }) => fx.average(refs.dynamic("months")),
  })
  .build();

const decoratedSchema = createExcelSchema<Order>()
  .column("id", {
    header: "Order",
    accessor: "id",
    hyperlink: (row) =>
      row.status === "open"
        ? { target: `https://example.com/orders/${row.id}`, tooltip: "Open order" }
        : null,
  })
  .column("customer", {
    header: "Customer",
    accessor: "customer",
    hyperlink: (row) => `mailto:${row.id.toLowerCase()}@example.com`,
  })
  .column("status", {
    header: "Status",
    accessor: "status",
    validation: (v) => v.list(["open", "closed"]),
    style: ({ row }) => (row.status === "closed" ? { font: { bold: true } } : undefined),
  })
  .column("amount", {
    header: "Amount",
    accessor: "amount",
    validation: (v) => v.decimal().between(0, 1000).allowBlank(),
    conditionalStyle: (conditional) =>
      conditional.when(({ refs }) => refs.column("amount").gte(100), {
        fill: { color: { rgb: "DCFCE7" } },
      }),
  })
  .build();

const parityCases: ParityCase[] = [
  {
    name: "report with title, grouped headers, sub-rows and summaries",
    tables: [
      {
        id: "orders",
        schema: reportWithChrome,
        rows: orders,
        options: { title: "Orders", render: { groupHeaders: true } },
      },
    ],
  },
  {
    name: "report with dynamic columns and a select",
    tables: [
      {
        id: "months",
        schema: reportWithDynamicColumns,
        rows: orders,
        options: {
          context: { months: ["jan", "feb", "mar"] },
          select: { exclude: ["outer"] },
        },
      },
    ],
  },
  {
    name: "two stacked tables with formulas",
    knownDifference:
      "the buffered builder writes a <col> element per table when tables are stacked, the stream builder writes one per column",
    sheetOptions: { tableRowGap: 2 },
    tables: [
      { id: "first", schema: stackedSchema, rows: orders, options: { title: "First" } },
      { id: "second", schema: stackedSchema, rows: orders.slice(0, 2) },
    ],
  },
  {
    name: "excel table with formulas and a totals row",
    tables: [
      {
        id: "totals",
        schema: excelTableWithTotals,
        rows: orders,
        options: { totalsRow: true },
      },
    ],
  },
  {
    name: "excel table with a dynamic group and scope aggregates",
    tables: [
      {
        id: "scoped",
        schema: excelTableWithGroup,
        rows: orders,
        options: { context: { months: ["jan", "feb", "mar"] } },
      },
    ],
  },
  {
    name: "table with validation, hyperlinks and conditional styles",
    tables: [{ id: "decorated", schema: decoratedSchema, rows: orders }],
  },
];

async function expectBuildersToAgree(parity: ParityCase) {
  const buffered = parts(buildBuffered(parity));
  const streamed = parts(await buildStream(parity));
  const paths = comparedPaths(buffered);
  const normalizeBuffered = createNormalizer(buffered);
  const normalizeStreamed = createNormalizer(streamed);

  expect(paths.some((path) => path.startsWith("xl/worksheets/"))).toBe(true);
  expect(comparedPaths(streamed)).toEqual(paths);
  for (const path of paths) {
    expect(splitTags(normalizeStreamed(path, streamed.get(path)!)), path).toEqual(
      splitTags(normalizeBuffered(path, buffered.get(path)!)),
    );
  }
}

describe("buffered and stream builders write the same parts", () => {
  it.each(parityCases.filter((parity) => !parity.knownDifference))("$name", expectBuildersToAgree);

  // Each of these fails today. When one starts passing, `it.fails` fails: delete its knownDifference.
  it.fails.each(parityCases.filter((parity) => parity.knownDifference))(
    "$name (known difference)",
    expectBuildersToAgree,
  );
});

/** Every calculated column formula of a table part must equal the formula of its body cells. */
function calculatedColumnMismatches(entries: Map<string, string>) {
  const sheet = entries.get("xl/worksheets/sheet1.xml") ?? "";
  const mismatches: string[] = [];

  for (const [path, table] of entries) {
    if (!/^xl\/tables\/table\d+\.xml$/.test(path)) continue;
    const ref = /<table [^>]*\bref="([A-Z]+)(\d+):[A-Z]+\d+"/.exec(table);
    if (!ref) continue;
    const firstColumn = ref[1]!.charCodeAt(0) - 65;
    const firstBodyRow = Number(ref[2]) + 1;

    [...table.matchAll(/<tableColumn ([^>]*?)(?:\/>|>(.*?)<\/tableColumn>)/g)].forEach(
      (column, index) => {
        const name = /name="([^"]*)"/.exec(column[1] ?? "")?.[1];
        const calculated = /<calculatedColumnFormula>(.*?)<\/calculatedColumnFormula>/.exec(
          column[2] ?? "",
        );
        if (!calculated) return;

        const cellRef = `${String.fromCharCode(65 + firstColumn + index)}${firstBodyRow}`;
        const cell = new RegExp(`<c r="${cellRef}"[^>]*>\\s*<f>(.*?)</f>`).exec(sheet);
        if (cell?.[1] !== calculated[1]) {
          mismatches.push(`${name}: table ${calculated[1]} / cell ${cell?.[1]}`);
        }
      },
    );
  }

  return mismatches;
}

describe("excel table calculated column formulas", () => {
  const scoped = parityCases[4]!;

  // These fail while the table part and the cells use two different formula serializers.
  it.fails("match the body cell formulas in the buffered builder", () => {
    expect(calculatedColumnMismatches(parts(buildBuffered(scoped)))).toEqual([]);
  });

  it.fails("match the body cell formulas in the stream builder", async () => {
    expect(calculatedColumnMismatches(parts(await buildStream(scoped)))).toEqual([]);
  });
});
