import { createExcelSchema, type SchemaColumnValues } from "typed-xlsx";

type Row = {
  firstName: string;
  qty: number;
  price: number;
  status: "paid" | "due";
  active: boolean;
  createdAt: Date;
  tags: string[];
  customer: { name: string; country: string };
  photo?: Uint8Array;
};

// ── Valid columns keep compiling, with their value types ─────────────────────

const valid = createExcelSchema<Row>()
  .column("name", { header: "Name", accessor: "customer.name" })
  .column("qty", { accessor: "qty", transform: ({ value }) => value * 2 })
  .column("length", { accessor: (row) => row.firstName.length })
  .column("label", { accessor: (row) => row.qty, transform: ({ value }) => value.toFixed(2) })
  .column("customer", { accessor: "customer", transform: ({ value }) => value.name })
  .column("total", {
    formula: ({ refs }) => refs.column("qty").mul(refs.column("qty")),
    summary: (summary) => [summary.formula("sum")],
  })
  .column("status", { type: "badge", accessor: "status", variants: { paid: {}, due: {} } })
  .column("active", { type: "checkbox", accessor: "active" })
  .column("photo", { type: "image", accessor: "photo" })
  .column("link", {
    type: "hyperlink",
    target: "https://example.com",
    accessor: (row) => row.firstName,
    transform: ({ value }) => value.toUpperCase(),
  })
  .build();

createExcelSchema<Row>({ mode: "excel-table" }).column("link", {
  type: "hyperlink",
  target: "https://example.com",
  accessor: (row) => row.firstName,
  transform: ({ value }) => value.toUpperCase(),
});

export const values: {
  name: string;
  qty: number;
  length: number;
  label: string;
  customer: string;
  total: number;
  status: "paid" | "due";
  active: boolean;
  link: string;
} = null! as Omit<SchemaColumnValues<typeof valid>, "photo">;

const dynamicIds: string[] = ["a", "b"];
createExcelSchema<Row>().dynamic("months", (builder) => {
  for (const id of dynamicIds) builder.column(id, { accessor: (row) => row.qty });
});

// ── Accessors ────────────────────────────────────────────────────────────────

// @error accessor: Did you mean '"firstName"'?
createExcelSchema<Row>().column("a", { accessor: "firstNam" });

// @error accessor: Did you mean '"customer.name"'?
createExcelSchema<Row>().column("a", { accessor: "customer.nam" });

// @error accessor: 'customer' doesn't hold a cell value
createExcelSchema<Row>().column("a", { accessor: "customer" });

// @error accessor: The accessor function must return a cell value
createExcelSchema<Row>().column("a", { accessor: (row) => row.customer });

// @error accessor: The accessor function receives the row
createExcelSchema<Row>().column("a", { accessor: (row: number) => row.toFixed() });

// ── Options that don't exist, or don't fit the column kind ───────────────────

// @error hedaer: 'hedaer' is not an option of columns. Options:
createExcelSchema<Row>().column("a", { accessor: "qty", hedaer: "Qty" });

// @error format: 'format' is not an option of checkbox columns. Options:
createExcelSchema<Row>().column("a", { type: "checkbox", accessor: "active", format: "0" });

// @error formula: 'formula' is not an option of checkbox columns
createExcelSchema<Row>().column("a", { type: "checkbox", accessor: "active", formula: () => 1 });

// @error type: Did you mean '"badge"'?
createExcelSchema<Row>().column("a", { type: "bdge", accessor: "status" });

// ── Column kinds check what the accessor holds ───────────────────────────────

// @error accessor: 'qty' doesn't hold a boolean. Fields that do: active
createExcelSchema<Row>().column("a", { type: "checkbox", accessor: "qty" });

// @error accessor: Did you mean '"status"'?
createExcelSchema<Row>().column("a", { type: "badge", accessor: "statuss", variants: {} });

createExcelSchema<Row>().column("a", {
  type: "badge",
  accessor: "status",
  // @error payd: 'payd' does not exist
  variants: { paid: {}, payd: {} },
});

createExcelSchema<Row>().column("a", {
  type: "badge",
  accessor: "status",
  // @error rgb: Type 'number' is not assignable to type 'string'
  variants: { paid: { style: { fill: { color: { rgb: 1 } } } }, due: {} },
});

// ── Formula references ───────────────────────────────────────────────────────

createExcelSchema<Row>()
  .column("qty", { accessor: "qty" })
  // @error "qtyy": '"qtyy"' is not assignable to parameter of type '"qty"'
  .column("a", { formula: ({ refs }) => refs.column("qtyy").mul(2) });

// ── Excel table schemas ──────────────────────────────────────────────────────

// @error accessor: 'tags' doesn't hold a single cell value
createExcelSchema<Row>({ mode: "excel-table" }).column("a", { accessor: "tags" });

// @error summary: 'summary' is not an option of columns
createExcelSchema<Row>({ mode: "excel-table" }).column("a", { accessor: "qty", summary: [] });

// @error accessor: Did you mean '"firstName"'?
createExcelSchema<Row>({ mode: "excel-table" }).column("a", { accessor: "firstNam" });

type ImageRow = { link: string; bytes: Uint8Array };

createExcelSchema<ImageRow>({ mode: "excel-table" }).column("a", {
  type: "image",
  source: "url",
  accessor: "link",
  // @error padding: 'padding' is not an option of URL image columns
  padding: 4,
});

// ── Accessors the key check must still see ───────────────────────────────────

declare const someField: string;
// @error accessor: Type 'string' is not assignable to type '"active"'
createExcelSchema<Row>().column("a", { type: "checkbox", accessor: someField });

const linked = createExcelSchema<Row>()
  .column("link", {
    type: "hyperlink",
    target: "https://example.com",
    accessor: "qty",
    transform: ({ value }) => `#${value}`,
  })
  .build();
export const linkValue: string = null! as SchemaColumnValues<typeof linked>["link"];
