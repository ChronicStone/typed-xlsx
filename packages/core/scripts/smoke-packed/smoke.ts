// Compiled against the packed package's bundled declarations (build/index.d.ts).
// Uses only the public API. Each @ts-expect-error line must stay an error.
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Order = {
  id: string;
  customer: { name: string };
  qty: number;
  unitPrice: number;
};

type Context = { currency: string };

const orders = createExcelSchema<Order, Context>()
  .column("id", { header: "Order", accessor: "id" })
  .column("customer", { header: "Customer", accessor: "customer.name" })
  .column("qty", { header: "Qty", accessor: "qty" })
  .column("price", { header: "Price", accessor: "unitPrice" })
  .column("total", {
    header: ({ ctx }) => `Total (${ctx.currency})`,
    formula: ({ refs }) => refs.column("qty").mul(refs.column("price")),
    summary: (s) => [s.formula("sum")],
  })
  .build();

const rows: Order[] = [{ id: "A-1", customer: { name: "Acme" }, qty: 2, unitPrice: 9.5 }];

const workbook = createWorkbook();
workbook.sheet("S").table("orders", { rows, schema: orders, context: { currency: "EUR" } });
export const bytes: Uint8Array = workbook.toUint8Array();

// A misspelled accessor path is a type error.
createExcelSchema<Order>()
  // @ts-expect-error "customer.nam" is not a path of Order
  .column("bad", { accessor: "customer.nam" })
  .build();

// refs.column only accepts columns declared before the formula.
createExcelSchema<Order>()
  .column("qty", { accessor: "qty" })
  .column("bad", {
    // @ts-expect-error "missing" is not a declared column
    formula: ({ refs }) => refs.column("missing").mul(refs.column("qty")),
  })
  .build();

// A schema that declares a context needs it when the table is added.
createWorkbook()
  .sheet("S")
  // @ts-expect-error context is required by this schema
  .table("orders", { rows, schema: orders });
