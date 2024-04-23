
<!-- 
### PLAYFGROUND

---

::: code-sandbox {entry=/main.ts}
```ts /main.ts [hidden]
import { createApp } from 'vue'
import App from './Entry.vue'
createApp(App).mount('#app')
```

```vue /Entry.vue [hidden]
<script setup lang="ts">
import { onMounted } from 'vue'
import Spreadsheet from 'x-data-spreadsheet'
import * as XLSX from 'xlsx'
import { users } from './data'
import buildFile from './builder'

function stox(wb: any) {
  const out = []
  wb.SheetNames.forEach((name) => {
    const o = { name, rows: {} }
    const ws = wb.Sheets[name]
    if (!ws || !ws['!ref'])
      return
    const range = XLSX.utils.decode_range(ws['!ref'])
    // sheet_to_json will lost empty row and col at begin as default
    range.s = { r: 0, c: 0 }
    const aoa = XLSX.utils.sheet_to_json(ws, {
      raw: false,
      header: 1,
      range
    })

    aoa.forEach((r, i) => {
      const cells = {}
      r.forEach((c, j) => {
        cells[j] = { text: c || String(c) }

        const cellRef = XLSX.utils.encode_cell({ r: i, c: j })

        if (ws[cellRef] != null && ws[cellRef].f != null)
          cells[j].text = `=${ws[cellRef].f}`
      })
      o.rows[i] = { cells }
    })
    o.rows.len = aoa.length

    o.merges = [];
    (ws['!merges'] || []).forEach((merge, i) => {
      // Needed to support merged cells with empty content
      if (o.rows[merge.s.r] == null)
        o.rows[merge.s.r] = { cells: {} }

      if (o.rows[merge.s.r].cells[merge.s.c] == null)
        o.rows[merge.s.r].cells[merge.s.c] = {}

      o.rows[merge.s.r].cells[merge.s.c].merge = [
        merge.e.r - merge.s.r,
        merge.e.c - merge.s.c
      ]

      o.merges[i] = XLSX.utils.encode_range(merge)
    })

    out.push(o)
  })

  return out
}
function downloadXlsx(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const link = document.createElement('a')
  link.href = window.URL.createObjectURL(blob)
  link.download = filename
  link.click()
}

let spreadsheet: Spreadsheet | null = null

function loadSpreadsheet() {
  if (!spreadsheet)
    spreadsheet = new Spreadsheet('#previewTarget')
  spreadsheet.loadData(stox(buildFile('workbook')))
}
</script>

<template>
  <div>
    <button id="download-file" @click="loadSpreadsheet">
      LOAD FILE
    </button>
    <button id="download-file">
      DOWNLOAD FILE
    </button>
    <h3>Content preview (no styling on preview)</h3>
    <div id="previewTarget" />
  </div>
</template>
```

```ts /schema.ts [active]
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
import { Organization, User } from './data'

export default ExcelSchemaBuilder
  .create<User>()
  .withTransformers({
    boolean: (key: boolean) => key ? 'Yes' : 'No',
    list: (key: (string)[]) => key.join(', '),
    arrayLength: (key: any[] | string) => key.length,
    date: (key: Date) => key.toLocaleDateString(),

  })
  .column('id', {
    key: 'id',
    summary: [{ value: () => 'TOTAL BEFORE VAT' }, { value: () => 'TOTAL' }],
  })
  .column('lastName', { key: 'lastName', transform: (_, i) => i === 0 ? [] : i === 1 ? ['Cyp', 'THAO'] : ['OTHER'] })
  .column('email', { key: 'email' })
  .column('roles', {
    key: 'roles',
    transform: 'list',
    cellStyle: data => ({ font: { color: { rgb: data.roles.includes('admin') ? 'd10808' : undefined } } }),
  })
  .column('balance', {
    key: 'balance',
    format: '"$"#,##0.00_);\\("$"#,##0.00\\)',
    summary: [
      {
        value: data => data.reduce((acc, user) => acc + user.balance, 0),
        format: '"$"#,##0.00_);\\("$"#,##0.00\\)',
      },
      {
        value: data => data.reduce((acc, user) => acc + user.balance, 0) * 1.2,
        format: '"$"#,##0.00_);\\("$"#,##0.00\\)',
      },
    ],
  })
  .column('nbOrgs', { key: 'organizations', transform: 'arrayLength' })
  .column('orgs', { key: 'organizations', transform: org => org.map(org => org.name).join(', ') })
  .column('generalScore', {
    key: 'results.general.overall',
    format: '# / 10',
    summary: [{
      value: data => data.reduce((acc, user) => acc + user.results.general.overall, 0) / data.length,
      format: '# / 10',
    }],
  })
  .column('technicalScore', {
    key: 'results.technical.overall',
    summary: [{
      value: data => data.reduce((acc, user) => acc + user.results.technical.overall, 0) / data.length,
    }],
  })
  .column('interviewScore', { key: 'results.interview.overall', default: 'N/A' })
  .column('createdAt', { key: 'createdAt', format: 'd mmm yyyy' })
  .group('group:org', (builder, context: Organization[]) => {
    for (const org of context) {
      builder
        .column(`orga-${org.id}`, {
          label: `User in ${org.name}`,
          key: 'organizations',
          transform: orgs => orgs.some(o => o.id === org.id) ? 'YES' : 'NO',
          cellStyle: data => ({
            font: {
              color: { rgb: data.organizations.some(o => o.id === org.id) ? '61eb34' : 'd10808' },
            },
          }),
        })
    }
  })
  .build()
```

```html /public/index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>codesandbox</title>
    <script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
    <script src="https://cdn.sheetjs.com/xspreadsheet/xlsxspread.js"></script>
  </head>
  <body>
    <noscript>
      <strong
        >We're sorry but codesandbox doesn't work properly without JavaScript
        enabled. Please enable it to continue.</strong
      >
    </noscript>
    <div id="app"></div>
    <!-- built files will be auto injected -->
  </body>
</html>
```

```ts /builder.ts
import { ExcelBuilder } from '@chronicstone/typed-xlsx'
import { type Organization, type User, organizations, users } from './data'
import schema from './schema'

export default function buildExcelFile(mode: 'workbook' | 'buffer') {
  return ExcelBuilder
    .create()
    .sheet('Users - full')
    .addTable({
      data: users.filter((_, i) => i < 5),
      schema,
      context: {
        'group:org': organizations,
      },
    })
    .sheet('Users - partial')
    .addTable({
      data: users,
      schema,
      select: {
        firstName: true,
        lastName: true,
        email: true,
      },
    })
    .sheet('User - neg partial')
    .addTable({
      data: users,
      schema,
      select: {
        firstName: false,
        lastName: false,
        email: false,
      },
      context: {
        'group:org': organizations,
      },
    })
    .sheet('Multi-tables-grid', { tablesPerRow: 2 })
    .addTable({
      title: 'Table 1',
      data: users.filter((_, i) => i < 5),
      schema,
      select: { firstName: true, lastName: true, email: true, createdAt: true },
    })
    .addTable({
      title: 'Table 2',
      data: users.filter((_, i) => i < 5),
      schema,
      select: { firstName: true, lastName: true, email: true, balance: true },
    })
    .addTable({
      title: 'Table 3',
      data: users.filter((_, i) => i < 5),
      schema,
      select: { firstName: true, lastName: true, email: true, balance: true },
    })
    .addTable({
      title: 'Table 4',
      data: users.filter((_, i) => i < 5),
      schema,
      select: { firstName: true, lastName: true, email: true, createdAt: true },
    })
    .build({ output: mode })
}
```

```ts /data.ts  [active]
import { faker } from '@faker-js/faker'

interface Organization {
  id: number
  name: string
}

interface User {
  id: number
  firstName: string
  lastName: string
  email: string
  roles: string[]
  organizations: Organization[]
  results: {
    general: { overall: number }
    technical: { overall: number }
    interview?: { overall: number }
  }
  createdAt: Date
  balance: number
}

const organizations: Organization[] = Array.from({ length: 10 }, (_, id) => ({
  id,
  name: faker.company.name(),
}))

const users: User[] = Array.from({ length: 100 }, (_, id) => ({
  id,
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email(),
  roles: ['admin', 'user', 'manager', 'guest'].filter(() => Math.random() > 0.5),
  organizations: organizations.filter(() => Math.random() > 0.5),
  results: {
    general: { overall: Math.floor(Math.random() * 10) },
    technical: { overall: Math.floor(Math.random() * 10) },
    ...(Math.random() > 0.5 ? { interview: { overall: Math.floor(Math.random() * 10) } } : {}),
  },
  balance: +faker.finance.amount(0, 1000000, 2),
  createdAt: faker.date.past(),
}))

export {
  users,
  organizations,
  User,
  Organization,
}
```
::: -->
