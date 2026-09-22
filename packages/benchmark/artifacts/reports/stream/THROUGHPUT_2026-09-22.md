# Chunked export throughput

The optimized writer cuts the real 202,058-row consumption export from 40.3 seconds to 19.4 seconds. Writing its five million cells falls from 27.2 seconds to 6.9 seconds; fetching the hydrated records becomes the largest remaining phase. This is a local development measurement, not a production or concurrent-load guarantee.

## Controlled package benchmark

Baseline: version 4.2.0, commit `010981c`. Optimized engine: `382c792`. Both use the same harness, schema and deterministic data, running serially in alternating baseline/optimized processes on Node 24.13.0, Apple M5, 32 GiB RAM, macOS. Every batch contains 5,000 logical rows. The existing 11-column benchmark includes styles, dates, formats and summaries; every notes cell also contains reserved XML characters and Unicode.

The 200,000-row cases report medians of three runs per variant. The 500,000-row case is one run per variant, so it is a scaling check rather than a stable estimate. CPU is process CPU time, RSS is the process high-water mark, and heap is sampled every 20 ms and after batches; sampled heap can miss short-lived peaks. Raw measurements are in [throughput-2026-09-22.json](./throughput-2026-09-22.json).

| Workload | Total before → after | Row commit before → after | CPU before → after | Peak RSS before → after | Sampled heap before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| 200k flat, shared strings | 11.66 → 3.45 s | 10.53 → 2.34 s | 12.45 → 4.02 s | 424 → 415 MiB | 234 → 177 MiB |
| 200k flat, inline strings | 12.05 → 3.72 s | 10.92 → 2.61 s | 12.92 → 4.37 s | 317 → 274 MiB | 128 → 85 MiB |
| 200k stacked, inline strings | 14.09 → 4.46 s | 12.40 → 2.87 s | 15.10 → 5.22 s | 414 → 380 MiB | 185 → 176 MiB |
| 500k flat, inline strings | 30.38 → 9.30 s | 27.58 → 6.49 s | 31.69 → 10.47 s | 417 → 279 MiB | 236 → 88 MiB |

Finalization remains roughly unchanged: about one second for 200k flat rows and 2.4 seconds for 500k. The improvement is in row processing and spooling, not a weaker compression setting. Inline-string flat exports retain similar measured memory at 200k and 500k rows. Shared strings, merged rows, images, hyperlinks and row-aware summary formulas still retain their own metadata; this is not a constant-memory promise for every schema.

## Real application export

Exports were initiated with the actual consumption table UI: select all matching results, then Export. The report has 202,058 records, 25 columns and 41 batches, with file spooling and the low-memory profile. PostgreSQL and MinIO run locally in Docker. The optimized package was linked locally without changing the application's dependency manifest or lockfile.

Temporary timing probes measured the awaited page iterator, `table.commit`, progress persistence, workbook finalization and storage upload separately. The probes were removed after measurement; no application algorithm changed. Fetch time includes scan setup, SQL execution, hydration and delivery of the page, not only the ID scan. Commit time includes the application's schema accessors and style callbacks, not only XML serialization.

| Phase | 4.2.0 | Optimized |
| --- | ---: | ---: |
| Fetch fully hydrated pages | 11.080 s | 10.580 s |
| Commit XLSX rows | 27.212 s | 6.884 s |
| Persist and broadcast progress | 0.173 s | 0.161 s |
| Finalize XLSX | 1.662 s | 1.539 s |
| Upload to local MinIO | 0.103 s | 0.097 s |
| Whole worker job | 40.330 s | 19.364 s |

Whole-job timings exclude queue wait and browser file transfer. They include authorization, setup, completion and notification work, so the phase rows do not sum exactly to the whole job. Two subsequent UI-triggered optimized jobs completed in 19.157 and 19.395 seconds. One had waited in the queue while the local worker was paused for profiling; that queue wait is not part of the generation measurement. The worker was restarted and the UI was observed advancing through numeric progress to the completed download action.

For a 5,000-row batch, the first measured run averages approximately 674 ms of XLSX work plus 274 ms of fetching; after optimization that becomes 170 ms plus 262 ms. Progress persistence adds about 4 ms. There is no artificial one-second pause in the export loop. Networked production storage and database latency will differ from these local measurements.

## Changes and correctness

- Coalesce row XML into bounded 64 Ki-character spool chunks, await backpressure, and flush before each commit resolves. Complete partial file writes instead of assuming every write consumes its buffer.
- Resolve each streaming cell style once, reuse it for sizing and serialization, and cache the last resolved style per column by content. The cache remains bounded by the column count and notices mutable style values.
- Retain row bounds only for formula summaries and collect native totals statistics only for requested totals. Ordinary totals no longer retain every numeric value; variance and standard deviation keep their original arithmetic.
- Serialize primitive cells directly and skip XML replacement passes for strings without reserved characters. User-supplied strings and formulas remain escaped.

All 20 controlled benchmark workbooks are byte-identical between variants within each scenario. The two real application artifacts are also byte-identical: 21,832,191 bytes, SHA-256 `a53e3121679fd2ba6fa053b7447879123e062d70f5cb1f7d1d976ec668416121`. ZIP integrity and streaming XML parsing pass. This preserves the full workbook, including values, formatting, summaries and frozen headers, rather than checking only that a file exists.

The core readiness command passes typechecking, all 206 tests, build and package dry-run. Regression coverage includes chunk boundaries, Unicode, partial writes, failure propagation, mutable styles, hyperlinks, checkboxes, stacked rows and all native totals functions. No public API or dependency was added.

## Reproduce the controlled case

From the repository root, build the same harness against each engine revision and run each bundle in a fresh Node process. Use the same harness for both revisions; do not compare the older benchmark's workload or runtime to this one.

```sh
bun build packages/benchmark/scripts/benchmark-stream-throughput.ts --target=node --outfile=/tmp/typed-xlsx-throughput.mjs
node /tmp/typed-xlsx-throughput.mjs --rows=200000 --batchSize=5000 --layout=flat --strings=inline --output=/tmp/typed-xlsx-throughput-run
```

Use `--strings=shared` for the shared-string case and `--layout=stacked` for the original multi-row values. Repeat runs serially and alternate engine variants. Each run writes its workbook and machine-readable `result.json` to the chosen output directory.
