# Stream Benchmark

- Generated: 2026-04-06T15:32:34.660Z
- Runtime: Node v24.3.0

| Rows | Batch size | Commit ms | Finish ms | Total ms | Rows/sec | XLSX MB | Peak RSS MB | Peak heap MB | Peak external MB | Spool MB |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100,000 | 10,000 | 11363.40 | 7244.36 | 18607.76 | 5374 | 61.20 | 472.30 | 154.96 | 60.27 | 53.24 |
| 500,000 | 10,000 | 29622.33 | 32504.52 | 62126.86 | 8048 | 310.36 | 1911.03 | 708.88 | 290.67 | 271.62 |

## Checkpoints

### 100,000 rows

- start: rss 40.36 MB, heap 1.53 MB, external 0.47 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 122.36 MB, heap 14.81 MB, external 1.75 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 204.88 MB, heap 36.45 MB, external 2.96 MB, arrayBuffers 0.59 MB
- before finish: rss 204.88 MB, heap 36.45 MB, external 2.96 MB, arrayBuffers 0.59 MB
- after finish: rss 472.30 MB, heap 154.96 MB, external 60.27 MB, arrayBuffers 0.00 MB

### 500,000 rows

- start: rss 48.97 MB, heap 0.96 MB, external 0.31 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 133.50 MB, heap 14.65 MB, external 1.74 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 225.59 MB, heap 56.43 MB, external 5.36 MB, arrayBuffers 2.32 MB
- after batch 20 (200,000 rows): rss 293.36 MB, heap 69.97 MB, external 4.78 MB, arrayBuffers 1.02 MB
- after batch 30 (300,000 rows): rss 395.70 MB, heap 105.31 MB, external 7.73 MB, arrayBuffers 2.35 MB
- after batch 40 (400,000 rows): rss 466.48 MB, heap 129.97 MB, external 6.79 MB, arrayBuffers 0.74 MB
- after batch 50 (500,000 rows): rss 557.66 MB, heap 140.24 MB, external 7.49 MB, arrayBuffers 0.52 MB
- before finish: rss 557.66 MB, heap 140.24 MB, external 7.49 MB, arrayBuffers 0.52 MB
- after finish: rss 1911.03 MB, heap 708.88 MB, external 290.67 MB, arrayBuffers 0.00 MB
