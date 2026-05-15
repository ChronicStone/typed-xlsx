---
"typed-xlsx": patch
---

Avoid top-level Node.js built-in imports from the browser-facing package entry.

Node-only APIs such as `toNodeReadable()` and file-backed streaming still work in Node.js, while browser builds can import and bundle `typed-xlsx` without resolving `node:stream`.
