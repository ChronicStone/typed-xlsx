# Design: an async output for browsers and Workers

Spike for plan 016. Written against `4e21a1f` (main). Design only: nothing here is implemented.

## Context

The buffered builder compresses ZIP entries with Node's zlib, found at runtime through
`process.getBuiltinModule("node:zlib")` (`packages/core/src/archive/zip.ts:49-72`). When that lookup
fails — browsers, Workers without `nodejs_compat` — `ZipBuilder.build()` writes every entry
**stored** (uncompressed) (`src/archive/zip.ts:204-218`). The stream builder compresses with the Web
`CompressionStream("deflate-raw")` (`src/archive/zip.ts:73-89`, used by `ZipStreamWriter.add` at
`:333-403`), which browsers and Workers have.

A "Download .xlsx" button in a web app is the natural browser use case, and today it gets a file
several times larger than the same export made in Node.

All paths below are relative to `packages/core/` unless they start with `apps/`, `.github/` or `plans/`.
Scratch prototypes are in `/private/tmp/claude-501/spikes-F/browser/` (not committed).

## Measured

All measurements on this machine (Apple Silicon, Node 26.12.1, Bun 1.4.4, Chrome headless
`--headless=new`), using the built package (`bun run build` in `packages/core`, which gives
`build/index.js` 365 kB).

**Sample A:** 20,000 rows × 4 columns (text, two numbers, one formula column), buffered builder.

| Runtime and path                                                                                                      | Output size                                |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Node, buffered `toUint8Array()` (zlib found)                                                                          | 521,929 bytes                              |
| Bun, buffered `toUint8Array()` (zlib found)                                                                           | 496,067 bytes                              |
| Chrome, buffered `toUint8Array()` (no `process`, no `Buffer`)                                                         | **3,903,909 bytes** (stored, 7.5×)         |
| Chrome, stream builder with `tempStorage: "memory"` → `new Response(toReadableStream()).blob()`                       | 521,961 bytes                              |
| Chrome, prototype: same buffered parts, each deflated with `CompressionStream` and laid out like `ZipBuilder.build()` | **521,929 bytes** (identical size to Node) |

The SHA-256 of the deflated `xl/worksheets/sheet1.xml` is the same from Node's
`zlib.deflateRawSync`, Node's `CompressionStream` and Chrome's `CompressionStream`
(`3d6cc2435aedde76…`). Bun's `deflateRawSync` (`448b8061…`) and Bun's `CompressionStream`
(`854a6793…`) each differ from Node and from each other.

**Compression cost** (Node, sample A, 7 entries, 3 runs): `deflateRawSync` 13–14 ms,
`CompressionStream` sequentially 15–28 ms, all entries in parallel 15 ms, for a whole buffered build
of about 210 ms. JS CRC32 over 3.9 MB: about 8 ms (Bun); every path already pays it
(`src/archive/zip.ts:214`, `:366`, `:384`). Chrome timings are not reported: `--virtual-time-budget`,
needed for `--dump-dom` to wait for async work, also makes `performance.now()` virtual.

**Memory** (Node, 200,000 rows × 6 columns, peak RSS from `/usr/bin/time -l`, two runs each):

| Path                                                                                            | Peak RSS     | Wall time | Output          |
| ----------------------------------------------------------------------------------------------- | ------------ | --------- | --------------- |
| Buffered `toUint8Array()` (rows array built up front)                                           | 1.17–1.20 GB | 3.2 s     | 6,533,304 bytes |
| Stream, `tempStorage: "memory"`, 40 commits of 5,000, `new Response(toReadableStream()).blob()` | 0.30 GB      | 1.7–1.9 s | 6,526,916 bytes |

The buffered run also holds the 200k-row input array, which the stream run generates per batch, so
part of the gap is the caller's data. The rest is the buffered planner keeping a planned cell for
every value until the file is written.

**Bundling:** a tiny app that imports `createWorkbook` and `createWorkbookStream` bundles for the
browser with no errors or warnings:

- esbuild 0.27.4, `--platform=browser --format=esm --minify`: 186.8 kB (58 kB gzip);
- rolldown 1.3.1, `platform: "browser"`, minified: 190.8 kB.

The package has no static Node import on its public entry:

- `src/archive/zip.ts:49-72` and `src/workbook/internal/stream-sinks.ts:3-48` look modules up via
  `process.getBuiltinModule` (and `globalThis.require` for `node:stream`) at call time;
- `src/api.ts:415-431` builds `node:` specifiers from a string (``import(`${nodeProtocol}fs`)``),
  so bundlers leave them as runtime dynamic imports;
- the only static `node:` import, `src/workbook/internal/file-sink.ts:1-2`, is exported from
  `src/index-internal.ts:141` only, not from `src/index.ts`.

Webpack was not tried (not installed). It may print "Critical dependency: the request of a
dependency is an expression" for the template-string imports; that is a warning, not an error
(inferred, not measured).

The plan's STOP condition (the package cannot be bundled for the browser) does not apply.

## How Node-only features fail in a browser today

Measured in headless Chrome with the bundled package:

| Call                                                                            | What the user sees                                                                                                                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workbook.toBuffer()`                                                           | `ReferenceError: Buffer is not defined`                                                                                                                            |
| `workbook.writeToFile(path)` (buffered)                                         | `TypeError: Failed to fetch dynamically imported module: node:fs/promises`                                                                                         |
| `createWorkbookStream()` then `sheet().table()` (default `tempStorage: "file"`) | `TypeError: Failed to fetch dynamically imported module: node:path`                                                                                                |
| stream `toNodeReadable()`                                                       | `Error: toNodeReadable() requires a Node.js-compatible stream module. Use toReadableStream() in browser runtimes.` (`src/workbook/internal/stream-sinks.ts:46-48`) |
| stream `writeToFile(path)`                                                      | `TypeError: Failed to fetch dynamically imported module: node:fs/promises`                                                                                         |
| buffered `toUint8Array()`                                                       | works, but stored entries (7.5× larger in sample A), silently                                                                                                      |

Only `toNodeReadable()` explains itself. The default stream temp storage failing on the first
`table()` call with a message about `node:path` is the worst one: the fix (`tempStorage: "memory"`)
is documented (`apps/docs/content/01.getting-started/2.installation.md:60-70`), but nothing points
there. The installation page does not mention that `toUint8Array()` falls back to stored entries.

## Question 1: a new method, or document the stream route?

|                 | A. `await workbook.toBlob()` on the buffered workbook                                                                 | B. Document `createWorkbookStream({ tempStorage: "memory" })` → `toReadableStream()`                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| New code        | `ZipBuilder.buildAsync()` (~40 lines), `buildBufferedWorkbookXlsxAsync`, one method on `Workbook` and `WorkbookSheet` | none                                                                                                 |
| Output size     | same as Node (measured, sample A)                                                                                     | same as Node within 32 bytes (data descriptors)                                                      |
| Peak memory     | same as today's buffered build (~1.2 GB for 200k × 6)                                                                 | about 4× lower (~0.3 GB)                                                                             |
| Fits the caller | the data is already an array in the page (the usual dashboard case)                                                   | data arrives in pages, or exports large enough that memory matters                                   |
| Features        | everything the buffered builder does                                                                                  | stream rules apply: pivots declared before commits, charts without cached values, `await` per commit |
| Breaking        | no                                                                                                                    | no                                                                                                   |

**Recommendation: do both, in that order of value: A, plus the docs for B.** A dashboard has its rows
in memory already and its code uses `createWorkbook()`; switching builders to get compression is
the wrong price. B stays the answer for large exports in any runtime and needs only a recipe.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Order = { id: string; customer: string; total: number };

const orders = createExcelSchema<Order>()
  .column("id", { header: "Order", accessor: "id" })
  .column("customer", { header: "Customer", accessor: "customer" })
  .column("total", { header: "Total", accessor: "total", format: '"$"#,##0.00' })
  .build();

export async function downloadOrders(rows: Order[]) {
  const workbook = createWorkbook();
  workbook.sheet("Orders").table("orders", { schema: orders, rows });

  const blob = await workbook.toBlob(); // compressed in browsers and Workers; type is the xlsx MIME type
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: "orders.xlsx" });
  link.click();
  URL.revokeObjectURL(url);
}
```

In a Worker, `return new Response(await workbook.toBlob(), { headers: { "Content-Disposition": 'attachment; filename="orders.xlsx"' } })`
sets `Content-Type` from the Blob's type.

Proposed types (`src/api.ts:188-200` and `:202-267`):

```ts nocheck
export interface Workbook {
  // existing members unchanged
  /**
   * Builds the file and resolves with a Blob of type
   * application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.
   * Compresses with node:zlib when present, otherwise with the Web CompressionStream,
   * so the file is the same size in browsers and Workers as in Node.
   */
  toBlob(): Promise<Blob>;
}
```

Why `toBlob()` and not `toUint8ArrayAsync()`:

- the two web uses (download link, `Response` body) both want a Blob, and the Blob carries the MIME
  type, so callers stop pasting the long content-type string;
- `Blob` exists in Node ≥ 18, Bun, Deno and Workers, so the method works everywhere;
- one new name instead of an `Async` twin of every sync method.

`toUint8Array()` stays synchronous and keeps its stored fallback; it cannot use `CompressionStream`,
which is async. See open question 1 about warning there.

## Question 2: compression, CRC32, determinism

- **Reuse the Web compressor, not the stream ZIP writer.** `writeXlsxPackageToSink` +
  `ZipStreamWriter` (`src/ooxml/package.ts:322-373`) could produce the buffered file into a memory
  sink, but it writes data descriptors (`FLAG_DATA_DESCRIPTOR`, `src/archive/zip.ts:266-278`) and never
  falls back to stored for entries that grow, so its bytes differ from the Node buffered path. A
  `ZipBuilder.buildAsync()` that only swaps the compressor keeps the exact layout of `build()`
  (`src/archive/zip.ts:204-263`).
- **Order of compressors in `buildAsync()`:** sync zlib if found (same bytes as `toUint8Array()` in
  Node), else `CompressionStream("deflate-raw")`, else stored. Entries are compressed in parallel
  (`Promise.all`), which measured the same as sync zlib in Node.
- **Keep the "stored when deflate grows it" rule** (`src/archive/zip.ts:206-208`).
- **CRC32** stays the existing JS implementation; ~8 ms per 3.9 MB, already paid by every path.
- **Determinism:** in Chrome, the async path produced the same deflated bytes as Node for the
  measured sheet and the same total size. That depends on both using zlib at the default level;
  Bun already produces different bytes from Node today. So the design promises **the same content**,
  not the same bytes, across runtimes, and tests compare unzipped parts, never ZIP bytes across
  runtimes.

## Question 3: bundling

No change needed for esbuild or rolldown (measured above). Two small hardening steps:

- Move `src/workbook/internal/file-sink.ts` off static `node:` imports (use the same
  `importNodeFsPromises` helper as `src/api.ts:421-423`). It is not reachable from the public entry
  today, but one stray re-export would break every browser bundle.
- Add a check in CI that bundles `build/index.js` for `platform: "browser"` and fails on any
  `node:` import that is not a runtime dynamic import (see test plan).

## Question 4: Node-only features in a browser

| Feature                              | Needs                             | First version                                                                                                                                                                                                                                        |
| ------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toBuffer()`                         | `Buffer`                          | Throw `"toBuffer() needs Node's Buffer. Use toUint8Array() or await toBlob() in browsers and Workers."` when `globalThis.Buffer` is missing.                                                                                                         |
| `writeToFile()` (both builders)      | `node:fs`                         | Catch the dynamic import failure and rethrow `"writeToFile() needs a filesystem (node:fs). In browsers and Workers use await toBlob() or toReadableStream()."` with `cause`.                                                                         |
| Stream default `tempStorage: "file"` | `node:fs`, `node:os`, `node:path` | Same wrapping in `LazyFileSpoolFactory.resolveDirectory()` (`src/api.ts:476-487`): `"The stream builder spools rows to temp files by default, which needs node:fs. Pass createWorkbookStream({ tempStorage: \"memory\" }) in browsers and Workers."` |
| `pipeToNode()`, `toNodeReadable()`   | Node streams                      | `toNodeReadable()` already explains itself; `pipeToNode()` needs a Node writable as input, so it cannot be called by mistake in a browser. No change.                                                                                                |

Auto-selecting `tempStorage: "memory"` when `node:fs` is missing is tempting but hides a memory cost
on runtimes that _should_ spool (open question 2). A clear error is the smaller first step.

## Implementation sketch

| File                                 | Change                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/archive/zip.ts`                 | `ZipBuilder.buildAsync(): Promise<Uint8Array>`; factor the layout part of `build()` into a helper that takes prepared entries, so both share it. `resolveAsyncDeflate()` returns sync zlib wrapped in a promise, or a `CompressionStream` one-shot (`new Response(new Blob([data]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()`), or `undefined`.               |
| `src/ooxml/package.ts`               | `buildXlsxPackageAsync` / `buildBufferedWorkbookXlsxAsync`, sharing the part list with the sync versions (`:235-320`).                                                                                                                                                                                                                                                                        |
| `src/workbook/buffered.ts`           | `buildXlsxAsync()` next to `buildXlsx()` (`:304-306`).                                                                                                                                                                                                                                                                                                                                        |
| `src/api.ts`                         | `toBlob()` on `Workbook` and `WorkbookSheet` (`PublicWorkbook`, `PublicWorkbookSheet`, `:551-624`); a shared `XLSX_CONTENT_TYPE` constant; clear errors for `toBuffer()`, `writeToFile()` and file spooling.                                                                                                                                                                                  |
| `src/workbook/internal/file-sink.ts` | Dynamic `node:` imports.                                                                                                                                                                                                                                                                                                                                                                      |
| Skill and docs                       | `skills/typed-xlsx/SKILL.md` "Output" table and `references/streaming.md`: `toBlob()`; a "Browsers and Workers" section with both recipes. `apps/docs/content/01.getting-started/2.installation.md` "Runtimes": add `toBlob()`, and say that `toUint8Array()` without `node:zlib` writes uncompressed entries. Kitchen-sink: one `toBlob()` call in `test/fixtures/kitchen-sink/buffered.ts`. |

## Test plan

1. **Unit, browser-like** (extend `test/zip.test.ts`, which already stubs
   `process.getBuiltinModule` at `:187-197`): with the stub, `buildAsync()` deflates every entry that
   shrinks (method 8), `unzipSync` returns the original parts, and sizes match `build()` without the
   stub (same Node zlib underneath). With `CompressionStream` also stubbed away, it falls back to
   stored.
2. **API**: `toBlob()` has the xlsx MIME type and unzips to the same parts as `toUint8Array()`, for the
   kitchen-sink buffered fixture.
3. **Errors**: with `Buffer`, `process.getBuiltinModule` and dynamic `node:` imports stubbed to fail,
   `toBuffer()`, `writeToFile()` and a default `createWorkbookStream()` table throw the messages above.
4. **Bundle check** (a script in `packages/core`, run by `check`): bundle `build/index.js` with
   rolldown or esbuild for `platform: "browser"`; fail on errors or on a static `node:` import.
   Takes well under a second (13–34 ms measured).
5. **Real browser smoke in CI**: GitHub's `ubuntu-latest` image lists Google Chrome as preinstalled (from the runner image docs, not checked in this spike), so no
   Playwright is needed for one smoke test. Bundle a page like
   `/private/tmp/claude-501/spikes-F/browser/run.ts` (buffered `toBlob()` and stream `toReadableStream()`,
   check the `PK` signature, the size ratio against stored, and `process`/`Buffer` absent), then run
   `google-chrome --headless=new --virtual-time-budget=30000 --dump-dom file://…/run.html` and grep the
   output. One extra CI step, no new dependency, a few seconds.

   Playwright (`@playwright/test` plus `playwright install chromium`, about 150 MB download per cold
   CI cache) is only worth it if browser tests grow beyond a smoke test, for example Firefox and
   WebKit `CompressionStream` coverage.

## Open questions for the maintainer

1. **Warn in `toUint8Array()` without zlib?** It silently writes a file 7.5× larger in sample A. A
   one-time `console.warn` pointing to `toBlob()` would surface it, but a library that logs is
   unusual. Alternative: say it in the JSDoc and the docs only. My pick: docs and JSDoc, no warning.
2. **Auto memory spool?** Should `createWorkbookStream()` pick `tempStorage: "memory"` when `node:fs`
   is missing, instead of throwing a clear error? Easier first run in browsers; but a Worker with a
   large export would silently hold everything in memory.
3. **Name.** `toBlob()` (recommended) or `toUint8ArrayAsync()`? A Blob suits the browser and
   `Response`; bytes suit code that post-processes.
4. **Browser coverage.** Is a Chrome-only smoke test enough, or do you want Firefox/Safari covered
   (`CompressionStream("deflate-raw")` reached Firefox and Safari later than Chrome, around Firefox 113 and Safari 16.4, from memory, not checked)?

## Effort

S–M, about 1.5–2 days: `buildAsync` and `toBlob()` half a day, clearer errors and the `file-sink`
change half a day, tests including the bundle check and the Chrome smoke half a day, docs, skill and
kitchen-sink half a day.
