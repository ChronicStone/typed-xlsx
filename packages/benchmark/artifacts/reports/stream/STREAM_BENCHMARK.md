# Stream Benchmark

- Generated: 2026-04-07T15:20:05.548Z
- Runtime: Node v24.3.0

| Rows | Batch size | Commit ms | Finish ms | Total ms | Rows/sec | XLSX MB | Peak RSS MB | Peak heap MB | Peak external MB | Spool MB |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100,000 | 10,000 | 7958.41 | 7327.52 | 15285.94 | 6542 | 61.20 | 594.27 | 147.90 | 59.05 | 53.24 |
| 500,000 | 10,000 | 36707.35 | 37619.12 | 74326.49 | 6727 | 310.36 | 1868.36 | 708.03 | 290.52 | 271.62 |

## Checkpoints

### 100,000 rows

- start: rss 49.86 MB, heap 1.52 MB, external 0.46 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 123.42 MB, heap 14.93 MB, external 1.74 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 206.19 MB, heap 46.03 MB, external 4.11 MB, arrayBuffers 1.27 MB
- before finish: rss 206.19 MB, heap 46.03 MB, external 4.11 MB, arrayBuffers 1.27 MB
- after finish: rss 594.27 MB, heap 147.90 MB, external 59.05 MB, arrayBuffers 0.00 MB

### 500,000 rows

- start: rss 48.80 MB, heap 1.53 MB, external 0.47 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 132.63 MB, heap 14.58 MB, external 1.71 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 224.84 MB, heap 56.72 MB, external 5.37 MB, arrayBuffers 2.32 MB
- after batch 20 (200,000 rows): rss 336.38 MB, heap 75.03 MB, external 5.33 MB, arrayBuffers 1.37 MB
- after batch 30 (300,000 rows): rss 371.23 MB, heap 119.95 MB, external 9.61 MB, arrayBuffers 3.60 MB
- after batch 40 (400,000 rows): rss 462.77 MB, heap 129.54 MB, external 7.81 MB, arrayBuffers 1.56 MB
- after batch 50 (500,000 rows): rss 521.44 MB, heap 156.26 MB, external 9.46 MB, arrayBuffers 1.90 MB
- before finish: rss 521.44 MB, heap 156.26 MB, external 9.46 MB, arrayBuffers 1.90 MB
- after finish: rss 1868.36 MB, heap 708.03 MB, external 290.52 MB, arrayBuffers 0.00 MB
