# Streaming and large exports

## Contents

- [When to stream](#when-to-stream)
- [The commit loop](#the-commit-loop)
- [Outputs: file, HTTP, S3](#outputs-file-http-s3)
- [Memory options](#memory-options)
- [Splitting across sheets](#splitting-across-sheets)
- [Several sheets from one source](#several-sheets-from-one-source)
- [Enriching each page](#enriching-each-page)
- [Progress](#progress)

## When to stream

`createWorkbook()` holds every row and builds the file at once: simplest, fine for most reports. Use `createWorkbookStream()` when rows come from a cursor or paginated API, when there are more than a few tens of thousands, or when memory is limited (serverless, workers). Schemas, sheets and table options are the same.

## The commit loop

```ts
import { createExcelSchema, createWorkbookStream } from "typed-xlsx";

type Order = { id: string; customer: string; amount: number };

const orders = createExcelSchema<Order>()
  .column("id", { header: "Order", accessor: "id" })
  .column("customer", { header: "Customer", accessor: "customer" })
  .column("amount", {
    header: "Amount",
    accessor: "amount",
    format: "#,##0.00",
    summary: (s) => [s.formula("sum")],
  })
  .build();

export async function exportOrders(pages: AsyncIterable<Order[]>, path: string) {
  const workbook = createWorkbookStream({ memoryProfile: "low-memory" });
  try {
    const table = await workbook
      .sheet("Orders", { freezePane: { rows: 1 } })
      .table("orders", { schema: orders });
    for await (const page of pages) {
      await table.commit({ rows: page });
    }
    await workbook.writeToFile(path);
  } catch (error) {
    await workbook.dispose();
    throw error;
  }
}
```

- `.table()` is awaited and returns a table handle; `select` and `context` go in its options as usual.
- Await each `commit()` before the next on the same table. Tables on different sheets can be filled concurrently.
- Commit the pages your source returns; 1,000 to 10,000 rows each is a good range.
- Summary rows, totals rows, charts and pivots are written at the end. `summary.cell()` reducers run across all commits.
- Call exactly one output method. `dispose()` cleans the temporary spool when you abandon a workbook.

## Outputs: file, HTTP, S3

| Method                    | Use                                                                      |
| ------------------------- | ------------------------------------------------------------------------ |
| `await writeToFile(path)` | a file (parent directory must exist)                                     |
| `await pipeToNode(res)`   | Node writable: Express or Node `http` responses                          |
| `toNodeReadable()`        | Node readable: Fastify `reply.send`, AWS SDK `Upload` body               |
| `await pipeTo(writable)`  | Web `WritableStream`                                                     |
| `toReadableStream()`      | Web `ReadableStream`: `new Response(stream)` in Hono, workers, Bun, Deno |

```ts
import { createExcelSchema, createWorkbookStream } from "typed-xlsx";

const rowsSchema = createExcelSchema<{ name: string }>()
  .column("name", { accessor: "name" })
  .build();

export async function handle(pages: AsyncIterable<Array<{ name: string }>>): Promise<Response> {
  const workbook = createWorkbookStream({ tempStorage: "memory" });
  const table = await workbook.sheet("Data").table("rows", { schema: rowsSchema });
  for await (const page of pages) await table.commit({ rows: page });

  return new Response(workbook.toReadableStream(), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="export.xlsx"',
    },
  });
}
```

Set response headers before streaming. If the export can fail midway, write to a file first and send it once complete, so the client never receives half a file.

## Memory options

| Option          | Values                                                   | Effect                                                                        |
| --------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `tempStorage`   | `"file"` (default), `"memory"`                           | where serialized rows wait; use `"memory"` only without a writable filesystem |
| `tempDirectory` | path                                                     | where the spool goes with `"file"`                                            |
| `memoryProfile` | `"balanced"` (default), `"low-memory"`, `"compact-file"` | `"low-memory"` writes strings inline: less memory, larger file                |
| `strings`       | `"shared"`, `"inline"`, `"auto"`                         | overrides `memoryProfile`                                                     |

Measured: 200k rows × 11 columns peak at 274 MiB with inline strings, 415 MiB with shared strings. Sub-row merges, hyperlinks, images and `column.rows()` summaries keep metadata for the whole export, so memory grows with them. On very wide schemas, set fixed `width`s so widths aren't measured from every cell.

## Splitting across sheets

Excel stops at 1,048,576 rows per sheet, and readers struggle long before. Cap rows per sheet and open a new sheet and table when the cap is reached:

```ts
import { createExcelSchema, createWorkbookStream } from "typed-xlsx";

type Event = { at: Date; user: string; action: string };

const events = createExcelSchema<Event>()
  .column("at", { header: "Time", accessor: "at", format: "yyyy-mm-dd hh:mm" })
  .column("user", { header: "User", accessor: "user" })
  .column("action", { header: "Action", accessor: "action" })
  .build();

export async function exportEvents(pages: AsyncIterable<Event[]>, maxRowsPerSheet = 500_000) {
  const workbook = createWorkbookStream({ memoryProfile: "low-memory" });
  // A function that opens a part gives the handle its exact type.
  const openPart = (part: number) =>
    workbook
      .sheet(part === 1 ? "Events" : `Events ${part}`, { freezePane: { rows: 1 } })
      .table(`events-${part}`, { schema: events });

  let table: Awaited<ReturnType<typeof openPart>> | undefined;
  let part = 0;
  let rowsInSheet = 0;

  for await (const page of pages) {
    let offset = 0;
    while (offset < page.length) {
      if (!table || rowsInSheet === maxRowsPerSheet) {
        part += 1;
        table = await openPart(part);
        rowsInSheet = 0;
      }
      const chunk = page.slice(offset, offset + maxRowsPerSheet - rowsInSheet);
      await table.commit({ rows: chunk });
      offset += chunk.length;
      rowsInSheet += chunk.length;
    }
  }
  if (!table) await openPart(1); // an empty export still gets its headers

  await workbook.writeToFile("./events.xlsx");
}
```

Each part gets its own header and summary rows. Remember that sub-rows multiply worksheet rows: count them when an accessor returns arrays.

## Several sheets from one source

A summary sheet plus one sheet per item (one tab per preset, per customer): read the first pass for the summary while collecting what each detail sheet needs, then query and stream each detail sheet.

```ts nocheck
const items: Array<{ id: string; label: string }> = [];
const summary = await workbook
  .sheet("Summary")
  .table("summary", { schema: summarySchema, context });
for await (const page of summaryPages) {
  items.push(...page.map(({ id, label }) => ({ id, label })));
  await summary.commit({ rows: page });
}
for (const item of items) {
  const detail = await workbook.sheet(item.label.slice(0, 31)).table(`detail-${item.id}`, {
    schema: detailSchema,
    context: { ...context, item },
  });
  for await (const page of detailPages(item.id)) await detail.commit({ rows: page });
}
```

## Enriching each page

The context is fixed when the table is created. When rows need data from another query (metrics, labels, permissions), fetch it per page and merge it into the rows before committing. Keep the schema's row type as the enriched shape.

```ts nocheck
for await (const page of pages) {
  const metrics = await loadMetrics(page.map((row) => row.id));
  await table.commit({
    rows: page.map((row) => ({ ...row, metrics: metrics.get(row.id) ?? null })),
  });
}
```

## Progress

Count rows as you commit and report them (job queue, server-sent events, logs). With a known total, report a percentage.
