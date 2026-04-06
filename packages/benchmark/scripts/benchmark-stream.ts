import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  benchmarkReportDirectory,
  createMarkdown,
  createSummary,
  STREAM_BENCHMARKS,
  type BenchmarkResult,
  toSerializableResult,
} from "../src/runners/stream";

async function main() {
  fs.mkdirSync(benchmarkReportDirectory, { recursive: true });

  const results: BenchmarkResult[] = [];
  const caseScriptPath = path.resolve(import.meta.dirname, "./benchmark-stream-case.ts");

  for (const benchmark of STREAM_BENCHMARKS) {
    const child = spawnSync(
      process.execPath,
      [
        "run",
        caseScriptPath,
        "--rows",
        benchmark.logicalRows.toString(),
        "--batchSize",
        benchmark.batchSize.toString(),
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    if (child.status !== 0) {
      throw new Error(
        child.stderr || child.stdout || `Benchmark failed for ${benchmark.logicalRows} rows`,
      );
    }

    results.push(JSON.parse(child.stdout) as BenchmarkResult);
  }

  const jsonPath = path.join(benchmarkReportDirectory, "stream-benchmark.json");
  const summaryPath = path.join(benchmarkReportDirectory, "summary.json");
  const markdownPath = path.join(benchmarkReportDirectory, "STREAM_BENCHMARK.md");

  fs.writeFileSync(jsonPath, JSON.stringify(results.map(toSerializableResult), null, 2));
  fs.writeFileSync(summaryPath, JSON.stringify(createSummary(results), null, 2));
  fs.writeFileSync(markdownPath, createMarkdown(results));

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${summaryPath}`);
  console.log(`Wrote ${markdownPath}`);
}

await main();
