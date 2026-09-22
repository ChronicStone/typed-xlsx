import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { createWorkbookStream } from "typed-xlsx";
import { createStreamBenchmarkBatch, createStreamBenchmarkSchema } from "../src/cases/stream/data";

const { values } = parseArgs({
  options: {
    rows: { type: "string", default: "200000" },
    batchSize: { type: "string", default: "5000" },
    layout: { type: "string", default: "flat" },
    output: { type: "string" },
  },
});
const logicalRows = Number(values.rows);
const batchSize = Number(values.batchSize);
if (!Number.isSafeInteger(logicalRows) || logicalRows <= 0) {
  throw new Error("rows must be a positive safe integer");
}
if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
  throw new Error("batchSize must be a positive safe integer");
}
if (values.layout !== "flat" && values.layout !== "stacked") {
  throw new Error("layout must be flat or stacked");
}

const directory = values.output ?? (await fs.mkdtemp(path.join(os.tmpdir(), "xlsx-throughput-")));
await fs.mkdir(directory, { recursive: true });
const outputPath = path.join(directory, "export.xlsx");
const spoolDirectory = await fs.mkdtemp(path.join(directory, "spool-"));
const workbook = createWorkbookStream({ tempStorage: "file", tempDirectory: spoolDirectory });
const table = await workbook.sheet("Orders").table("orders", {
  schema: createStreamBenchmarkSchema(),
});
let peakHeapBytes = 0;
let peakExternalBytes = 0;
function sampleMemory() {
  const memory = process.memoryUsage();
  peakHeapBytes = Math.max(peakHeapBytes, memory.heapUsed);
  peakExternalBytes = Math.max(peakExternalBytes, memory.external);
}
sampleMemory();
const sampler = setInterval(sampleMemory, 20);
const cpuStart = process.cpuUsage();
const startedAt = performance.now();
let generateMs = 0;
let commitMs = 0;
try {
  for (let offset = 0; offset < logicalRows; offset += batchSize) {
    const generateStart = performance.now();
    const rows = createStreamBenchmarkBatch(offset, Math.min(batchSize, logicalRows - offset));
    for (const row of rows) {
      if (values.layout === "flat") {
        row.lineLabels.length = 1;
        row.lineAmounts.length = 1;
      }
      row.notes += ' — café & <review> "quoted" O\'Brien 🚀';
    }
    generateMs += performance.now() - generateStart;
    const commitStart = performance.now();
    await table.commit({ rows });
    commitMs += performance.now() - commitStart;
    sampleMemory();
  }
  const finishStart = performance.now();
  await workbook.writeToFile(outputPath);
  const finishMs = performance.now() - finishStart;
  const totalMs = performance.now() - startedAt;
  const cpu = process.cpuUsage(cpuStart);
  sampleMemory();
  clearInterval(sampler);
  const result = {
    runtime: process.version,
    layout: values.layout,
    logicalRows,
    batchSize,
    generateMs,
    commitMs,
    finishMs,
    totalMs,
    cpuMs: (cpu.user + cpu.system) / 1000,
    rowsPerSecond: (logicalRows * 1000) / totalMs,
    maxRssMb: process.resourceUsage().maxRSS / 1024,
    sampledPeakHeapMb: peakHeapBytes / 1024 / 1024,
    sampledPeakExternalMb: peakExternalBytes / 1024 / 1024,
    outputBytes: (await fs.stat(outputPath)).size,
    outputPath,
  };
  await fs.writeFile(path.join(directory, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  clearInterval(sampler);
  await workbook.dispose();
}
