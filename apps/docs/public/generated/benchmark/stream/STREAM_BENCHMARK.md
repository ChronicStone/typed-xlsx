# Stream Benchmark

- Generated: 2026-04-01T16:15:59.509Z
- Runtime: Node v24.3.0

|    Rows | Batch size | Commit ms | Finish ms | Total ms | Rows/sec | XLSX MB | Peak RSS MB | Peak heap MB | Peak external MB | Spool MB |
| ------: | ---------: | --------: | --------: | -------: | -------: | ------: | ----------: | -----------: | ---------------: | -------: |
| 100,000 |     10,000 |   4869.25 |   5654.32 | 10523.57 |     9502 |   61.19 |      616.16 |       140.19 |            58.74 |    53.24 |
| 500,000 |     10,000 |  28791.71 |  27727.24 | 56518.95 |     8847 |  310.36 |     2086.83 |       686.77 |           293.29 |   271.62 |

## Checkpoints

### 100,000 rows

- start: rss 47.23 MB, heap 1.42 MB, external 0.43 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 129.94 MB, heap 13.98 MB, external 1.66 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 206.48 MB, heap 30.15 MB, external 2.97 MB, arrayBuffers 0.40 MB
- before finish: rss 206.48 MB, heap 30.15 MB, external 2.97 MB, arrayBuffers 0.40 MB
- after finish: rss 616.16 MB, heap 140.19 MB, external 58.74 MB, arrayBuffers 0.00 MB

### 500,000 rows

- start: rss 48.72 MB, heap 0.96 MB, external 0.31 MB, arrayBuffers 0.00 MB
- after batch 1 (10,000 rows): rss 131.34 MB, heap 13.96 MB, external 1.64 MB, arrayBuffers 0.54 MB
- after batch 10 (100,000 rows): rss 213.17 MB, heap 49.49 MB, external 4.98 MB, arrayBuffers 1.97 MB
- after batch 20 (200,000 rows): rss 273.55 MB, heap 63.23 MB, external 5.11 MB, arrayBuffers 1.25 MB
- after batch 30 (300,000 rows): rss 340.11 MB, heap 93.98 MB, external 8.89 MB, arrayBuffers 3.25 MB
- after batch 40 (400,000 rows): rss 463.03 MB, heap 107.52 MB, external 7.72 MB, arrayBuffers 1.57 MB
- after batch 50 (500,000 rows): rss 488.22 MB, heap 141.34 MB, external 11.14 MB, arrayBuffers 3.23 MB
- before finish: rss 488.22 MB, heap 141.34 MB, external 11.14 MB, arrayBuffers 3.23 MB
- after finish: rss 2086.83 MB, heap 686.77 MB, external 293.29 MB, arrayBuffers 0.00 MB
