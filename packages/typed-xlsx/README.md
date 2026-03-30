# typed-xlsx

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

Type-safe Excel reporting for TypeScript, with one clean schema API and two workbook modes:

- `createWorkbook()` for polished buffered exports
- `createWorkbookStream()` for large commit-based exports

## What you get

- Typed path accessors and accessor callbacks
- Column transforms, defaults, styling, and formatting
- Multi-row summaries with reducer-based APIs
- Multi-sheet workbooks and multi-table buffered layouts
- Freeze panes, RTL sheets, row expansion, merges, and auto sizing
- Streamed XLSX generation for very large exports

## Installation

```bash
pnpm add @chronicstone/typed-xlsx
```

## Buffered example

```ts
import { createSchema, createWorkbook } from "@chronicstone/typed-xlsx";

type Order = {
  id: string;
  customer: {
    name: string;
    email: string;
  };
  items: Array<{
    sku: string;
    quantity: number;
    unitPrice: number;
  }>;
};

const schema = createSchema<Order>()
  .column("orderId", {
    header: "Order",
    accessor: "id",
  })
  .column("customerName", {
    header: "Customer",
    accessor: "customer.name",
  })
  .column("sku", {
    header: "SKU",
    accessor: (row) => row.items.map((item) => item.sku),
  })
  .column("lineTotal", {
    header: "Line Total",
    accessor: (row) => row.items.map((item) => item.quantity * item.unitPrice),
    style: {
      numFmt: "$#,##0.00",
    },
    summary: [
      {
        init: () => 0,
        step: (acc, row) =>
          acc + row.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        finalize: () => "TOTAL",
      },
      {
        init: () => 0,
        step: (acc, row) =>
          acc + row.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        finalize: (acc) => acc,
        style: {
          numFmt: "$#,##0.00",
        },
      },
    ],
  })
  .build();

const workbook = createWorkbook();

workbook
  .sheet("Orders", {
    freezePane: { rows: 1 },
  })
  .table({
    id: "orders",
    rows,
    schema,
  });

const bytes = workbook.toUint8Array();
```

## Stream example

```ts
import { createSchema, createWorkbookStream } from "@chronicstone/typed-xlsx";

const schema = createSchema<{ amount: number; id: string }>()
  .column("id", {
    header: "ID",
    accessor: "id",
  })
  .column("amount", {
    header: "Amount",
    accessor: "amount",
    summary: {
      init: () => 0,
      step: (acc, row) => acc + row.amount,
      finalize: (acc) => acc,
      style: { numFmt: "$#,##0.00" },
    },
  })
  .build();

const workbook = createWorkbookStream({
  tempStorage: "file",
  memoryProfile: "low-memory",
});

const table = await workbook
  .sheet("Transactions", {
    freezePane: { rows: 1 },
  })
  .table({
    id: "transactions",
    schema,
  });

for await (const batch of getTransactionBatches()) {
  await table.commit({ rows: batch });
}

await workbook.writeToFile("./transactions.xlsx");
```

## Notes on migration

This release promotes the new API as the main package surface.

- `key` becomes `accessor`
- summaries use reducer functions: `init`, `step`, `finalize`
- selection uses `include` / `exclude`
- styles use the library's own normalized `CellStyle`
- stream workbooks support `memoryProfile` / `strings` to tune memory usage and file size

## License

[MIT](./LICENSE) License © 2023-PRESENT [Cyprien THAO](https://github.com/ChronicStone)

[npm-version-src]: https://img.shields.io/npm/v/@chronicstone/typed-xlsx?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/@chronicstone/typed-xlsx
[npm-downloads-src]: https://img.shields.io/npm/dm/@chronicstone/typed-xlsx?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/@chronicstone/typed-xlsx
[bundle-src]: https://img.shields.io/bundlephobia/minzip/@chronicstone/typed-xlsx?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=@chronicstone/typed-xlsx
[license-src]: https://img.shields.io/github/license/ChronicStone/typed-xlsx.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/ChronicStone/typed-xlsx/blob/main/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/@chronicstone/typed-xlsx
