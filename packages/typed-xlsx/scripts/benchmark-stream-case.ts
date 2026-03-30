import { runBenchmark } from "./lib/stream-benchmark";

const args = new Map<string, string>();

for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];

  if (key && value) {
    args.set(key, value);
  }
}

const logicalRows = Number(args.get("--rows"));
const batchSize = Number(args.get("--batchSize") ?? "10000");

if (!Number.isFinite(logicalRows) || logicalRows <= 0) {
  throw new Error("Missing or invalid --rows argument");
}

const result = await runBenchmark({
  logicalRows,
  batchSize,
});

process.stdout.write(JSON.stringify(result));
