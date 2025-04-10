import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { faker } from '@faker-js/faker'
import { ExcelSchemaBuilder, ExcelStreamBuilder } from '../src/'

const TEST_OUTPUT_DIR = path.join(__dirname, 'output')

// Ensure output directory exists
if (!fs.existsSync(TEST_OUTPUT_DIR))
  fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true })

// Function to track memory usage
function getMemoryUsage() {
  const memoryUsage = process.memoryUsage()
  return {
    rss: memoryUsage.rss / (1024 * 1024), // Resident Set Size in MB
    heapTotal: memoryUsage.heapTotal / (1024 * 1024), // Total Size of the Heap in MB
    heapUsed: memoryUsage.heapUsed / (1024 * 1024), // Heap actually Used in MB
    external: memoryUsage.external / (1024 * 1024), // Memory used by C++ objects bound to JavaScript objects in MB
  }
}

// Log memory usage with timestamp
function logMemoryUsage(label: string) {
  const memory = getMemoryUsage()
  console.log(`[${new Date().toISOString()}] ${label} - Memory Usage:`)
  console.log(`  RSS: ${memory.rss.toFixed(2)} MB`)
  console.log(`  Heap Total: ${memory.heapTotal.toFixed(2)} MB`)
  console.log(`  Heap Used: ${memory.heapUsed.toFixed(2)} MB`)
  console.log(`  External: ${memory.external.toFixed(2)} MB`)
  return memory
}

// Save memory metrics to file
function saveMemoryMetrics(metrics: any[]) {
  const metricsPath = path.join(TEST_OUTPUT_DIR, 'memory-metrics.json')
  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2))
  console.log(`Memory metrics saved to ${metricsPath}`)
}
describe('perf tracking', () => {
  it('should stream 100K rows to a file using filePath with memory tracking', async () => {
    // Define test interface
    interface User {
      id: number
      name: string
      email: string
      birthDate: Date
      salary: number
    }

    // Create schema with formatting
    const userSchema = ExcelSchemaBuilder.create<User>()
      .withFormatters({
        date: 'yyyy-mm-dd',
        currency: '$#,##0.00',
      })
      .column('id', { accessor: 'id' })
      .column('test', { accessor: () => [1, 2, 3] })
      .column('name', { accessor: 'name', width: 50 })
      .column('email', { accessor: 'email', width: 50 })
      .column('birthDate', {
        accessor: 'birthDate',
        format: { preset: 'date' },
        width: 15,
      })
      .column('salary', {
        accessor: 'salary',
        format: { preset: 'currency' },
        width: 15,
        cellStyle: row => ({
          font: {
            color: { argb: row.salary > 80000 ? '61eb34' : 'd10808' },
          },
        }),
        summary: [{ value: data => data.reduce((acc, cur) => acc + cur.salary, 0) / data.length }],
      })
      .build()

    // Create output file path
    const filePath = path.join(TEST_OUTPUT_DIR, 'stream-perf-analysis.xlsx')

    // Array to store memory metrics
    const memoryMetrics: any[] = []

    // Start timing and memory tracking
    console.time('100K rows - filePath')
    const initialMemory = logMemoryUsage('Initial state')
    memoryMetrics.push({
      phase: 'initial',
      timestamp: new Date().toISOString(),
      ...initialMemory,
    })

    // Create builder with gc options
    const builder = ExcelStreamBuilder.create({
      filePath,
      chunkMaxSize: 10000, // Process in chunks of 10K rows
      useStyles: true,
      useSharedStrings: true,
    })

    // Track memory after builder creation
    const afterBuilderCreation = logMemoryUsage('After builder creation')
    memoryMetrics.push({
      phase: 'builder_creation',
      timestamp: new Date().toISOString(),
      ...afterBuilderCreation,
    })

    // Add sheet
    const userSheet = builder.sheet('Users', {
      schema: userSchema,
      title: '100K User Report (filePath)',
      titleStyle: {
        font: { size: 16, bold: true },
      },
    })

    // Process rows in chunks
    const TOTAL_ROWS = 150_000
    const CHUNK_SIZE = 10_000

    for (let chunkIndex = 0; chunkIndex < TOTAL_ROWS / CHUNK_SIZE; chunkIndex++) {
      // Generate a chunk of user data
      const userChunk: User[] = Array.from({ length: CHUNK_SIZE }, (_, i) => {
        const userId = chunkIndex * CHUNK_SIZE + i
        return {
          id: userId,
          name: faker.person.fullName(),
          email: faker.internet.email(),
          birthDate: faker.date.past(),
          salary: faker.number.float({ min: 30000, max: 150000, multipleOf: 0.01 }),
        }
      })

      // Track memory before adding chunk
      const beforeChunk = logMemoryUsage(`Before processing chunk ${chunkIndex + 1}`)

      // Add the chunk to the sheet
      await userSheet.addChunk(userChunk)

      // Track memory after adding chunk
      const afterChunk = logMemoryUsage(`After processing chunk ${chunkIndex + 1}`)

      // Store metrics
      memoryMetrics.push({
        phase: `chunk_${chunkIndex + 1}_before`,
        rows: (chunkIndex) * CHUNK_SIZE,
        timestamp: new Date().toISOString(),
        ...beforeChunk,
      })

      memoryMetrics.push({
        phase: `chunk_${chunkIndex + 1}_after`,
        rows: (chunkIndex + 1) * CHUNK_SIZE,
        timestamp: new Date().toISOString(),
        ...afterChunk,
      })

      // Log progress
      console.log(`FilePath test: Processed chunk ${chunkIndex + 1}/${TOTAL_ROWS / CHUNK_SIZE} (${(chunkIndex + 1) * CHUNK_SIZE} rows)`)

      // Force garbage collection if available
      if (globalThis.gc) {
        globalThis.gc()
        const afterGC = logMemoryUsage(`After GC - chunk ${chunkIndex + 1}`)
        memoryMetrics.push({
          phase: `chunk_${chunkIndex + 1}_after_gc`,
          rows: (chunkIndex + 1) * CHUNK_SIZE,
          timestamp: new Date().toISOString(),
          ...afterGC,
        })
      }
    }

    // Track memory before save
    const beforeSave = logMemoryUsage('Before save')
    memoryMetrics.push({
      phase: 'before_save',
      timestamp: new Date().toISOString(),
      ...beforeSave,
    })

    // Save the workbook
    await builder.save()

    // Track memory after save
    const afterSave = logMemoryUsage('After save')
    memoryMetrics.push({
      phase: 'after_save',
      timestamp: new Date().toISOString(),
      ...afterSave,
    })

    console.timeEnd('100K rows - filePath')

    // Save memory metrics
    saveMemoryMetrics(memoryMetrics)

    // Verify the file was created
    const fileExists = fs.existsSync(filePath)
    const fileSize = fileExists ? fs.statSync(filePath).size / (1024 * 1024) : 0

    console.log(`Excel file created at: ${filePath}`)
    console.log(`File size: ${fileSize.toFixed(2)} MB`)

    expect(fileExists).toBe(true)
    expect(fileSize).toBeGreaterThan(0)
  }, { timeout: 300_000 }) // Increase timeout to account for memory tracking overhead
})
