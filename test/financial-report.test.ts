import fs from 'node:fs'
import { describe, it } from 'vitest'

import { financialReportExcel } from '../docs/.examples/financial-report/file'

describe('should generate the example excel', () => {
  it('exported', () => {
    fs.writeFileSync('./examples/financial-report.xlsx', financialReportExcel)
  })
})
