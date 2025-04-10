import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { faker } from '@faker-js/faker'
import { ExcelSchemaBuilder, ExcelStreamBuilder } from '../src'

// Ensure test directory exists
const TEST_OUTPUT_DIR = path.join(process.cwd(), 'examples')

describe('excelStreamBuilder 100K Tests', () => {
  // Ensure test directory exists
  beforeEach(() => {
    if (!fs.existsSync(TEST_OUTPUT_DIR))
      fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true })
  })

  // it('should stream 100K rows to a file using filePath', async () => {
  //   // Define test interface
  //   interface User {
  //     id: number
  //     name: string
  //     email: string
  //     birthDate: Date
  //     salary: number
  //   }

  //   // Create schema with formatting
  //   const userSchema = ExcelSchemaBuilder.create<User>()
  //     .withFormatters({
  //       date: 'yyyy-mm-dd',
  //       currency: '$#,##0.00',
  //     })
  //     .column('id', { accessor: 'id' })
  //     .column('test', { accessor: () => [1, 2, 3] })
  //     .column('name', { accessor: 'name', width: 50 })
  //     .column('email', { accessor: 'email', width: 50 })
  //     .column('birthDate', {
  //       accessor: 'birthDate',
  //       format: { preset: 'date' },
  //       width: 15,
  //     })
  //     .column('salary', {
  //       accessor: 'salary',
  //       format: { preset: 'currency' },
  //       width: 15,
  //       cellStyle: row => ({
  //         font: {
  //           color: { argb: row.salary > 80000 ? '61eb34' : 'd10808' },
  //         },
  //       }),
  //       summary: [{ value: data => data.reduce((acc, cur) => acc + cur.salary, 0) / data.length }],
  //     })
  //     .build()

  //   // Create output file path
  //   const filePath = path.join(TEST_OUTPUT_DIR, 'stream-100k-filepath.xlsx')

  //   console.time('100K rows - filePath')

  //   // Create builder
  //   const builder = ExcelStreamBuilder.create({
  //     filePath,
  //     chunkMaxSize: 10000, // Process in chunks of 10K rows
  //     useStyles: true,
  //     useSharedStrings: true,
  //   })

  //   // Add sheet
  //   const userSheet = builder.sheet('Users', {
  //     schema: userSchema,
  //     // title: '100K User Report (filePath)',
  //     titleStyle: {
  //       font: { size: 16, bold: true },
  //     },
  //   })

  //   // Process 100K rows in chunks of 10K
  //   const TOTAL_ROWS = 150_000
  //   const CHUNK_SIZE = 10_000

  //   for (let chunkIndex = 0; chunkIndex < TOTAL_ROWS / CHUNK_SIZE; chunkIndex++) {
  //     // Generate a chunk of user data
  //     const userChunk: User[] = Array.from({ length: CHUNK_SIZE }, (_, i) => {
  //       const userId = chunkIndex * CHUNK_SIZE + i
  //       return {
  //         id: userId,
  //         name: faker.person.fullName(),
  //         email: faker.internet.email(),
  //         birthDate: faker.date.past(),
  //         salary: faker.number.float({ min: 30000, max: 150000, multipleOf: 0.01 }),
  //       }
  //     })

  //     // Add the chunk to the sheet
  //     await userSheet.addChunk(userChunk)

  //     // Log progress
  //     console.log(`FilePath test: Processed chunk ${chunkIndex + 1}/${TOTAL_ROWS / CHUNK_SIZE} (${(chunkIndex + 1) * CHUNK_SIZE} rows)`)
  //   }

  //   // Save the workbook
  //   await builder.save()

  //   console.timeEnd('100K rows - filePath')

  //   // Verify the file was created
  //   const fileExists = fs.existsSync(filePath)
  //   const fileSize = fileExists ? fs.statSync(filePath).size / (1024 * 1024) : 0

  //   console.log(`Excel file created at: ${filePath}`)
  //   console.log(`File size: ${fileSize.toFixed(2)} MB`)

  //   expect(fileExists).toBe(true)
  //   expect(fileSize).toBeGreaterThan(0)
  // }, { timeout: 200_000 })

  // it('should stream 100K rows to a file using a writable stream', async () => {
  //   // Define test interface
  //   interface Product {
  //     id: number
  //     name: string
  //     category: string
  //     price: number
  //     inStock: boolean
  //     lastUpdated: Date
  //   }

  //   // Create schema with formatting
  //   const productSchema = ExcelSchemaBuilder.create<Product>()
  //     .withFormatters({
  //       date: 'yyyy-mm-dd',
  //       currency: '$#,##0.00',
  //     })
  //     .column('id', { accessor: 'id' })
  //     .column('name', {
  //       accessor: 'name',
  //       width: 30,
  //     })
  //     .column('category', { accessor: 'category' })
  //     .column('price', {
  //       accessor: 'price',
  //       format: { preset: 'currency' },
  //       width: 15,
  //     })
  //     .column('inStock', {
  //       accessor: 'inStock',
  //       cellStyle: row => ({
  //         fill: {
  //           type: 'pattern',
  //           pattern: 'solid',
  //           fgColor: { argb: row.inStock ? 'FF90EE90' : 'FFFF6347' },
  //         },
  //       }),
  //     })
  //     .column('lastUpdated', {
  //       accessor: 'lastUpdated',
  //       format: { preset: 'date' },
  //       width: 15,
  //     })
  //     .build()

  //   // Create output file path and stream
  //   const filePath = path.join(TEST_OUTPUT_DIR, 'stream-100k-writableStream.xlsx')
  //   const fileStream = fs.createWriteStream(filePath)

  //   console.time('100K rows - writable stream')

  //   // Create builder with stream
  //   const builder = ExcelStreamBuilder.create({
  //     stream: fileStream,
  //     chunkMaxSize: 10000, // Process in chunks of 10K rows
  //     useStyles: true,
  //     useSharedStrings: true,
  //   })

  //   // Add sheet
  //   const productSheet = builder.sheet('Products', {
  //     schema: productSchema,
  //     // title: '100K Product Catalog (stream)',
  //     titleStyle: {
  //       font: { size: 16, bold: true },
  //     },
  //   })

  //   // Process 100K rows in chunks of 10K
  //   const TOTAL_ROWS = 100000
  //   const CHUNK_SIZE = 10000
  //   const categories = ['Electronics', 'Clothing', 'Home', 'Sports', 'Books', 'Toys', 'Food', 'Health', 'Automotive', 'Garden']

  //   for (let chunkIndex = 0; chunkIndex < TOTAL_ROWS / CHUNK_SIZE; chunkIndex++) {
  //     // Generate a chunk of product data
  //     const productChunk: Product[] = Array.from({ length: CHUNK_SIZE }, (_, i) => {
  //       const productId = chunkIndex * CHUNK_SIZE + i
  //       return {
  //         id: productId,
  //         name: faker.commerce.productName(),
  //         category: categories[Math.floor(Math.random() * categories.length)],
  //         price: Number.parseFloat(faker.commerce.price()),
  //         inStock: Math.random() > 0.2, // 80% chance of being in stock
  //         lastUpdated: faker.date.recent({ days: 90 }),
  //       }
  //     })

  //     // Add the chunk to the sheet
  //     await productSheet.addChunk(productChunk)

  //     // Log progress
  //     console.log(`Stream test: Processed chunk ${chunkIndex + 1}/${TOTAL_ROWS / CHUNK_SIZE} (${(chunkIndex + 1) * CHUNK_SIZE} rows)`)
  //   }

  //   // Save the workbook
  //   await builder.save()

  //   console.timeEnd('100K rows - writable stream')

  //   // Verify the file was created
  //   const fileExists = fs.existsSync(filePath)
  //   const fileSize = fileExists ? fs.statSync(filePath).size / (1024 * 1024) : 0

  //   console.log(`Excel file created at: ${filePath}`)
  //   console.log(`File size: ${fileSize.toFixed(2)} MB`)

  //   expect(fileExists).toBe(true)
  //   expect(fileSize).toBeGreaterThan(0)
  // }, { timeout: 100_000 })
})
