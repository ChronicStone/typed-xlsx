# Stream Benchmark

- Generated: 2026-04-02T01:41:59.450Z
- Runtime: Node v24.3.0

| Rows | Batch size | Commit ms | Finish ms | Total ms | Rows/sec | XLSX MB | Peak RSS MB | Peak heap MB | Peak external MB | Spool MB |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100,000 | 10,000 | 7009.32 | 6164.44 | 13173.76 | 7591 | 61.19 | 559.05 | 149.79 | 59.51 | 53.24 |
| 500,000 | 10,000 | 29185.70 | 27078.89 | 56264.60 | 8887 | 310.36 | 2124.73 | 946.19 | 28.04 | 271.62 |

## Checkpoints

### 100,000 rows

- start: rss 48.00 MB, heap 0.96 MB, external 0.31 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 127.92 MB, heap 14.52 MB, external 1.69 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 197.75 MB, heap 56.42 MB, external 5.32 MB, arrayBuffers 2.34 MB
- before finish: rss 197.75 MB, heap 56.42 MB, external 5.32 MB, arrayBuffers 2.34 MB
- after finish: rss 559.05 MB, heap 149.79 MB, external 59.51 MB, arrayBuffers 0.00 MB

### 500,000 rows

- start: rss 48.56 MB, heap 0.96 MB, external 0.31 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 133.25 MB, heap 14.53 MB, external 1.68 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 224.36 MB, heap 56.17 MB, external 5.30 MB, arrayBuffers 2.32 MB
- after batch 20 (200,000 rows): rss 304.03 MB, heap 63.73 MB, external 3.79 MB, arrayBuffers 0.24 MB
- after batch 30 (300,000 rows): rss 368.78 MB, heap 100.64 MB, external 7.48 MB, arrayBuffers 2.15 MB
- after batch 40 (400,000 rows): rss 464.13 MB, heap 171.99 MB, external 10.30 MB, arrayBuffers 3.52 MB
- after batch 50 (500,000 rows): rss 520.89 MB, heap 179.77 MB, external 12.74 MB, arrayBuffers 4.46 MB
- before finish: rss 520.89 MB, heap 179.77 MB, external 12.74 MB, arrayBuffers 4.46 MB
- after finish: rss 2124.73 MB, heap 946.19 MB, external 28.04 MB, arrayBuffers 0.00 MB
