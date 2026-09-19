---
"typed-xlsx": minor
---

Compress workbook parts with deflate and stream worksheet rows with bounded memory.

- Streamed workbooks deflate every zip entry through the standard `CompressionStream("deflate-raw")` and fall back to stored entries where it is unavailable, so archives stay valid everywhere and shrink by an order of magnitude where compression is supported.
- Buffered workbooks deflate entries synchronously through `node:zlib` on Node.js, Bun and Deno, and keep stored entries in browsers.
- The streaming finalizer now emits vertically stacked tables straight from their spools instead of re-parsing every row into memory, which bounds finalize memory and removes the finalize-time regex pass for the common single-table sheet. Side-by-side layouts keep the shared-row path.
- CRC32 uses a lookup table, and `writeToFile()` keeps one file handle open instead of reopening the file for every chunk.
