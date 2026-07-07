# Stream Benchmark

- Generated: 2026-05-19T09:03:01.457Z
- Runtime: Node v24.3.0

| Rows | Batch size | Commit ms | Finish ms | Total ms | Rows/sec | XLSX MB | Peak RSS MB | Peak heap MB | Peak external MB | Spool MB |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100,000 | 10,000 | 4992.67 | 7130.40 | 12123.08 | 8249 | 61.20 | 589.08 | 154.00 | 59.70 | 53.24 |
| 500,000 | 10,000 | 32219.08 | 31669.84 | 63888.93 | 7826 | 310.36 | 2123.67 | 714.03 | 291.46 | 271.62 |

## Checkpoints

### 100,000 rows

- start: rss 45.13 MB, heap 1.50 MB, external 0.47 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 133.81 MB, heap 14.66 MB, external 1.75 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 226.58 MB, heap 56.45 MB, external 5.40 MB, arrayBuffers 2.33 MB
- before finish: rss 226.58 MB, heap 56.45 MB, external 5.40 MB, arrayBuffers 2.33 MB
- after finish: rss 589.08 MB, heap 154.00 MB, external 59.70 MB, arrayBuffers 0.00 MB

### 500,000 rows

- start: rss 47.33 MB, heap 0.97 MB, external 0.31 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 136.70 MB, heap 14.62 MB, external 1.77 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 228.92 MB, heap 56.67 MB, external 5.43 MB, arrayBuffers 2.32 MB
- after batch 20 (200,000 rows): rss 306.19 MB, heap 100.02 MB, external 7.87 MB, arrayBuffers 3.38 MB
- after batch 30 (300,000 rows): rss 379.69 MB, heap 98.41 MB, external 6.46 MB, arrayBuffers 1.35 MB
- after batch 40 (400,000 rows): rss 450.95 MB, heap 165.03 MB, external 10.42 MB, arrayBuffers 3.54 MB
- after batch 50 (500,000 rows): rss 534.19 MB, heap 179.96 MB, external 12.30 MB, arrayBuffers 3.98 MB
- before finish: rss 534.19 MB, heap 179.96 MB, external 12.30 MB, arrayBuffers 3.98 MB
- after finish: rss 2123.67 MB, heap 714.03 MB, external 291.46 MB, arrayBuffers 0.00 MB
