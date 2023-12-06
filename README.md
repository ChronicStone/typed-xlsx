# typed-xlsx

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]


> **Note**:
> Export any data into xls/xlsx files effortlessly, while benefiting from great type-safety & developper experience.


## INSTALLATION
```bash
pnpm add @chronicstone/typed-xlsx
```

## USAGE EXAMPLE

#### 1. Define the type of exported data (Or infer it from a function / a db query, or wherever you want) :
```ts
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
}
```

#### 2. Build a sheet schema :
```ts
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'

// OPTIONAL : DEFINE SHARED TRANSFORMERS THAT CAN BE USE TO TRANSFORM VALUE INSERTED INTO A CELL
const transformers = {
  boolean: (value: boolean) => value ? 'Yes' : 'No',
  list: (value: (string)[]) => value.join(', '),
  arrayLength: (value: any[]) => value.length,
} satisfies TransformersMap

// Use the schema builder to define your sheet schema
const userExportSchema = ExcelSchemaBuilder
const assessmentExport = ExcelSchemaBuilder
  .create<User>()
  .withTransformers(transformers)
  .column('id', { key: 'id' })
  .column('firstName', { key: 'firstName' })
  .column('lastName', { key: 'lastName' })
  .column('email', { key: 'email' })
  .column('roles', {
    key: 'roles',
    transform: 'list',
    cellStyle: data => ({ font: { color: { rgb: data.roles.includes('admin') ? 'd10808' : undefined } } }),
  })
  .column('balance', { key: 'balance', format: '"$"#,##0.00_);\\("$"#,##0.00\\)' })
  .column('nbOrgs', { key: 'organizations', transform: 'arrayLength' })
  .column('orgs', { key: 'organizations', transform: org => org.map(org => org.name).join(', ') })
  .column('generalScore', { key: 'results.general.overall', format: '# / 10' })
  .column('technicalScore', { key: 'results.technical.overall' })
  .column('interviewScore', { key: 'results.interview.overall', default: 'N/A' })
  .column('createdAt', { key: 'createdAt', format: 'd mmm yyyy' })
  .group('group:org', (builder, context: Organization[]) => {
    for (const org of context) {
      builder
        .column(org.id.toString(), {
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
  .summary({
    id: { value: () => 'TOTAL' },
    balance: { value: data => data.reduce((acc, user) => acc + user.balance, 0), format: '"$"#,##0.00_);\\("$"#,##0.00\\)' },
    generalScore: { value: data => data.reduce((acc, user) => acc + user.results.general.overall, 0) / data.length },
    technicalScore: { value: data => data.reduce((acc, user) => acc + user.results.technical.overall, 0) / data.length },
    interviewScore: { value: data => data.reduce((acc, user) => acc + (user.results.interview?.overall ?? 0), 0) / data.length },
  })
  .build()
```

#### 3. Safely compose excel file from schemas

```ts
import { ExcelBuilder } from '@chronicstone/typed-xlsx'

const buffer = ExcelBuilder
  .create()
  .sheet('Users - full')
  .addTable({
    data: users,
    schema: assessmentExport,
    context: {
      'group:org': organizations,
    },

  })

  .sheet('Users - partial')
  .addTable({
    data: users,
    schema: assessmentExport,
    select: {
      firstName: true,
      lastName: true,
      email: true,
    },
  })
  .sheet('User - neg partial')
  .addTable({
    data: users,
    schema: assessmentExport,
    select: {
      firstName: false,
      lastName: false,
      email: false,
    },
    context: {
      'group:org': organizations,
    },
  })
  .sheet('User - Multiple tables')
  .sheet('Multi-tables-grid', { tablesPerRow: 3 })
  .addTable({
    data: users.filter((_, i) => i < 5),
    schema: assessmentExport,
    select: { firstName: true, lastName: true, email: true, createdAt: true },
  })
  .addTable({
    data: users.filter((_, i) => i < 5),
    schema: assessmentExport,
    select: { firstName: true, lastName: true, email: true, balance: true },
  })
  .addTable({
    data: users.filter((_, i) => i < 5),
    schema: assessmentExport,
    select: { firstName: true, lastName: true, email: true, balance: true },
  })
  .addTable({
    data: users.filter((_, i) => i < 5),
    schema: assessmentExport,
    select: { firstName: true, lastName: true, email: true, createdAt: true },
  })
  .build({ output: 'buffer' })

fs.writeFileSync('test.xlsx', arrayBuffer)
```

#### 4. Have fun

Here's the generated file for the example from above

![DEMO_GENERATED_FILE](image.png)

[DOWNLOAD GENERATED EXAMPLE](https://github.com/ChronicStone/typed-xlsx/blob/main/example.xlsx)

[OPEN EXAMPLE IN STACKBLITZ](https://stackblitz.com/edit/typescript-cvt29j?file=index.ts)


## License

[MIT](./LICENSE) License © 2023-PRESENT [Cyprien THAO](https://github.com/ChronicStone)


<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/@chronicstone/typed-xlsx?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/@chronicstone/typed-xlsx
[npm-downloads-src]: https://img.shields.io/npm/dm/@chronicstone/typed-xlsx?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/@chronicstone/typed-xlsx
[bundle-src]: https://img.shields.io/bundlephobia/minzip/@chronicstone/typed-xlsx?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=@chronicstone/typed-xlsx
[license-src]: https://img.shields.io/github/ChronicStone/typed-xlsx.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/ChronicStone/typed-xlsx/blob/main/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/@chronicstone/typed-xlsx
