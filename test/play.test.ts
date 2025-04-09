import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { faker } from '@faker-js/faker'
import { ExcelSchemaBuilder } from '../src'

describe('excelStreamBuilder tests', () => {
  it('should stream 100k rows to a single sheet with memory tracking', async () => {

  }, { timeout: 300_000 }) // Increased timeout for the larger test
})
