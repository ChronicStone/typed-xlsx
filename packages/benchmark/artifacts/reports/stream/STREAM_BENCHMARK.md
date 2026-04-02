# Stream Benchmark

- Generated: 2026-04-02T11:55:57.314Z
- Runtime: Node v24.3.0

| Rows | Batch size | Commit ms | Finish ms | Total ms | Rows/sec | XLSX MB | Peak RSS MB | Peak heap MB | Peak external MB | Spool MB |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100,000 | 10,000 | 10567.04 | 9261.48 | 19828.53 | 5043 | 61.19 | 475.73 | 145.91 | 58.32 | 53.24 |
| 500,000 | 10,000 | 38108.90 | 34076.61 | 72185.53 | 6927 | 310.36 | 1981.34 | 715.64 | 291.98 | 271.62 |

## Checkpoints

### 100,000 rows

- start: rss 46.59 MB, heap 1.44 MB, external 0.44 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 124.41 MB, heap 14.79 MB, external 1.71 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 197.91 MB, heap 41.21 MB, external 3.54 MB, arrayBuffers 1.03 MB
- before finish: rss 197.91 MB, heap 41.21 MB, external 3.54 MB, arrayBuffers 1.03 MB
- after finish: rss 475.73 MB, heap 145.91 MB, external 58.32 MB, arrayBuffers 0.00 MB

### 500,000 rows

- start: rss 48.94 MB, heap 0.96 MB, external 0.31 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 132.75 MB, heap 14.52 MB, external 1.69 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 224.31 MB, heap 56.19 MB, external 5.30 MB, arrayBuffers 2.32 MB
- after batch 20 (200,000 rows): rss 249.95 MB, heap 69.73 MB, external 4.71 MB, arrayBuffers 0.99 MB
- after batch 30 (300,000 rows): rss 357.86 MB, heap 99.88 MB, external 7.63 MB, arrayBuffers 2.35 MB
- after batch 40 (400,000 rows): rss 434.14 MB, heap 116.93 MB, external 6.15 MB, arrayBuffers 0.33 MB
- after batch 50 (500,000 rows): rss 497.58 MB, heap 152.68 MB, external 9.18 MB, arrayBuffers 1.74 MB
- before finish: rss 497.58 MB, heap 152.68 MB, external 9.18 MB, arrayBuffers 1.74 MB
- after finish: rss 1981.34 MB, heap 715.64 MB, external 291.98 MB, arrayBuffers 0.00 MB
