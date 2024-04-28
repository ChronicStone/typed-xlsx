import fs from 'node:fs'
import path from 'node:path'
import { transformerTwoslash } from '@shikijs/twoslash'
import { codeToHtml } from 'shiki'

function buildHtml(code: string, dark: boolean) {
  return codeToHtml(code, {
    lang: 'ts',
    theme: dark ? 'github-dark' : 'github-light',
    transformers: [
      transformerTwoslash(), // <-- here
    ],
  })
}

function buildTemplate(params: { file: string, schema: string, data: string }, target: 'file' | 'schema' | 'data') {
  return `${params.data}
// ---${target === 'data' ? 'cut-after' : 'cut'}---
${params.schema.replace('import type { FinancialReport } from \'./data\'\n', '')}
// ---${target === 'schema' ? 'cut-after' : target === 'file' ? 'cut' : ''}---
${params.file.replace('import { generateFinancialReportData } from \'./data\'\n', '').replace('import { financialReportSchema } from \'./schema\'\n', '')}

`
}

export default {
  async load() {
    const examplePath = path.join(__dirname, '../../../.examples')
    const exampleKeys = fs.readdirSync(examplePath)
      .filter(file => fs.statSync(path.join(examplePath, file)).isDirectory())

    return Promise.all(exampleKeys.map(async (key) => {
      const file = fs.readFileSync(path.join(examplePath, key, 'file.ts'), 'utf-8')
      const schema = fs.readFileSync(path.join(examplePath, key, 'schema.ts'), 'utf-8')
      const data = fs.readFileSync(path.join(examplePath, key, 'data.ts'), 'utf-8')

      const fileTemplate = buildTemplate({ file, schema, data }, 'file')
      const schemaTemplate = buildTemplate({ file, schema, data }, 'schema')
      const dataTemplate = buildTemplate({ file, schema, data }, 'data')

      return {
        key,
        data: !data ? null : { dark: await buildHtml(dataTemplate, true), light: await buildHtml(dataTemplate, false) },
        schema: !schema ? null : { dark: await buildHtml(schemaTemplate, true), light: await buildHtml(schemaTemplate, false) },
        file: !file ? null : { dark: await buildHtml(fileTemplate, true), light: await buildHtml(fileTemplate, false) },

      }
    }))
  },
}
