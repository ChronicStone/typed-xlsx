import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createWorkbookStream } from "@chronicstone/typed-xlsx";
import { createStreamBenchmarkBatch, createStreamBenchmarkSchema } from "../cases/stream/data";

export interface MemoryPoint {
  label: string;
  rssMb: number;
  heapUsedMb: number;
  externalMb: number;
  arrayBuffersMb: number;
}

export interface BenchmarkResult {
  logicalRows: number;
  batchSize: number;
  batchCount: number;
  outputPath: string;
  outputBytes: number;
  spoolDirectory: string;
  spoolBytes: number;
  commitMs: number;
  finishMs: number;
  totalMs: number;
  rowsPerSecond: number;
  peakRssMb: number;
  peakHeapUsedMb: number;
  peakExternalMb: number;
  peakArrayBuffersMb: number;
  checkpoints: MemoryPoint[];
}

export const STREAM_BENCHMARKS = [
  { logicalRows: 100_000, batchSize: 10_000 },
  { logicalRows: 500_000, batchSize: 10_000 },
] as const;

export const benchmarkArtifactsDirectory = path.resolve(import.meta.dirname, "../../artifacts");
export const benchmarkReportDirectory = path.join(benchmarkArtifactsDirectory, "reports/stream");
export const benchmarkFilesDirectory = path.join(benchmarkReportDirectory, "files");

export function toMb(value: number) {
  return Number((value / 1024 / 1024).toFixed(2));
}

export function sampleMemory(label: string): MemoryPoint {
  const usage = process.memoryUsage();
  return {
    label,
    rssMb: toMb(usage.rss),
    heapUsedMb: toMb(usage.heapUsed),
    externalMb: toMb(usage.external),
    arrayBuffersMb: toMb(usage.arrayBuffers),
  };
}

export function directorySizeBytes(directory: string) {
  if (!fs.existsSync(directory)) return 0;

  return fs.readdirSync(directory).reduce((sum, entry) => {
    const filePath = path.join(directory, entry);
    const stats = fs.statSync(filePath);
    return sum + (stats.isFile() ? stats.size : 0);
  }, 0);
}

export function createMarkdown(results: BenchmarkResult[]) {
  const lines = [
    "# Stream Benchmark",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Runtime: Node ${process.version}`,
    "",
    "| Rows | Batch size | Commit ms | Finish ms | Total ms | Rows/sec | XLSX MB | Peak RSS MB | Peak heap MB | Peak external MB | Spool MB |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const result of results) {
    lines.push(
      `| ${result.logicalRows.toLocaleString()} | ${result.batchSize.toLocaleString()} | ${result.commitMs.toFixed(2)} | ${result.finishMs.toFixed(2)} | ${result.totalMs.toFixed(2)} | ${result.rowsPerSecond.toFixed(0)} | ${toMb(result.outputBytes).toFixed(2)} | ${result.peakRssMb.toFixed(2)} | ${result.peakHeapUsedMb.toFixed(2)} | ${result.peakExternalMb.toFixed(2)} | ${toMb(result.spoolBytes).toFixed(2)} |`,
    );
  }

  lines.push("", "## Checkpoints", "");

  for (const result of results) {
    lines.push(`### ${result.logicalRows.toLocaleString()} rows`, "");
    for (const checkpoint of result.checkpoints) {
      lines.push(
        `- ${checkpoint.label}: rss ${checkpoint.rssMb.toFixed(2)} MB, heap ${checkpoint.heapUsedMb.toFixed(2)} MB, external ${checkpoint.externalMb.toFixed(2)} MB, arrayBuffers ${checkpoint.arrayBuffersMb.toFixed(2)} MB`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function createSummary(results: BenchmarkResult[]) {
  return {
    generatedAt: new Date().toISOString(),
    cases: results.map((result) => ({
      logicalRows: result.logicalRows,
      batchSize: result.batchSize,
      totalMs: Number(result.totalMs.toFixed(2)),
      rowsPerSecond: Number(result.rowsPerSecond.toFixed(0)),
      outputSizeMb: Number(toMb(result.outputBytes).toFixed(2)),
      peakRssMb: Number(result.peakRssMb.toFixed(2)),
      peakHeapUsedMb: Number(result.peakHeapUsedMb.toFixed(2)),
      spoolSizeMb: Number(toMb(result.spoolBytes).toFixed(2)),
      reportPath: path.relative(benchmarkArtifactsDirectory, result.outputPath),
    })),
  };
}

export async function runBenchmark(params: {
  logicalRows: number;
  batchSize: number;
}): Promise<BenchmarkResult> {
  const schema = createStreamBenchmarkSchema();
  const benchmarkSlug = `${params.logicalRows.toString()}-rows`;
  const outputPath = path.join(benchmarkFilesDirectory, `stream-${benchmarkSlug}.xlsx`);
  const spoolDirectory = path.join(benchmarkFilesDirectory, `${benchmarkSlug}-spool`);

  fs.rmSync(spoolDirectory, { recursive: true, force: true });
  fs.rmSync(outputPath, { force: true });
  fs.mkdirSync(spoolDirectory, { recursive: true });

  const workbook = createWorkbookStream({
    tempStorage: "file",
    tempDirectory: spoolDirectory,
  });
  const table = await workbook.sheet(`Benchmark ${params.logicalRows}`).table("orders", {
    schema,
  });

  const checkpoints: MemoryPoint[] = [];
  checkpoints.push(sampleMemory("start"));

  const totalStart = performance.now();
  const commitStart = performance.now();
  let generated = 0;
  let batchNumber = 0;

  while (generated < params.logicalRows) {
    const size = Math.min(params.batchSize, params.logicalRows - generated);
    const rows = createStreamBenchmarkBatch(generated, size);
    await table.commit({ rows });
    generated += size;
    batchNumber += 1;

    if (batchNumber === 1 || generated === params.logicalRows || batchNumber % 10 === 0) {
      checkpoints.push(
        sampleMemory(`after batch ${batchNumber} (${generated.toLocaleString()} rows)`),
      );
    }
  }

  const commitMs = performance.now() - commitStart;
  checkpoints.push(sampleMemory("before finish"));
  const finishStart = performance.now();
  await workbook.writeToFile(outputPath);
  const finishMs = performance.now() - finishStart;
  const totalMs = performance.now() - totalStart;
  checkpoints.push(sampleMemory("after finish"));

  const outputBytes = fs.statSync(outputPath).size;
  const spoolBytes = directorySizeBytes(spoolDirectory);

  return {
    logicalRows: params.logicalRows,
    batchSize: params.batchSize,
    batchCount: Math.ceil(params.logicalRows / params.batchSize),
    outputPath,
    outputBytes,
    spoolDirectory,
    spoolBytes,
    commitMs,
    finishMs,
    totalMs,
    rowsPerSecond: params.logicalRows / (totalMs / 1000),
    peakRssMb: Math.max(...checkpoints.map((point) => point.rssMb)),
    peakHeapUsedMb: Math.max(...checkpoints.map((point) => point.heapUsedMb)),
    peakExternalMb: Math.max(...checkpoints.map((point) => point.externalMb)),
    peakArrayBuffersMb: Math.max(...checkpoints.map((point) => point.arrayBuffersMb)),
    checkpoints,
  };
}
