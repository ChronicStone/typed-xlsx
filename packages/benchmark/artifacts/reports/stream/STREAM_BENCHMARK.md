# Stream Benchmark

- Generated: 2026-04-06T14:33:49.771Z
- Runtime: Node v24.3.0

| Rows | Batch size | Commit ms | Finish ms | Total ms | Rows/sec | XLSX MB | Peak RSS MB | Peak heap MB | Peak external MB | Spool MB |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100,000 | 10,000 | 11149.48 | 7195.52 | 18345.01 | 5451 | 61.20 | 574.80 | 158.45 | 59.98 | 53.24 |
| 500,000 | 10,000 | 30351.94 | 31555.10 | 61907.05 | 8077 | 310.36 | 1954.86 | 716.13 | 292.03 | 271.62 |

## Checkpoints

### 100,000 rows

- start: rss 45.42 MB, heap 1.53 MB, external 0.47 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 90.81 MB, heap 14.79 MB, external 1.74 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 198.67 MB, heap 40.27 MB, external 3.30 MB, arrayBuffers 0.72 MB
- before finish: rss 198.67 MB, heap 40.27 MB, external 3.30 MB, arrayBuffers 0.72 MB
- after finish: rss 574.80 MB, heap 158.45 MB, external 59.98 MB, arrayBuffers 0.00 MB

### 500,000 rows

- start: rss 49.72 MB, heap 1.53 MB, external 0.47 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 131.50 MB, heap 14.66 MB, external 1.73 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 226.61 MB, heap 56.57 MB, external 5.37 MB, arrayBuffers 2.34 MB
- after batch 20 (200,000 rows): rss 304.84 MB, heap 94.25 MB, external 7.14 MB, arrayBuffers 2.93 MB
- after batch 30 (300,000 rows): rss 386.50 MB, heap 91.39 MB, external 5.48 MB, arrayBuffers 0.61 MB
- after batch 40 (400,000 rows): rss 466.20 MB, heap 129.64 MB, external 7.83 MB, arrayBuffers 1.56 MB
- after batch 50 (500,000 rows): rss 502.88 MB, heap 168.34 MB, external 11.02 MB, arrayBuffers 3.07 MB
- before finish: rss 502.88 MB, heap 168.34 MB, external 11.02 MB, arrayBuffers 3.07 MB
- after finish: rss 1954.86 MB, heap 716.13 MB, external 292.03 MB, arrayBuffers 0.00 MB
