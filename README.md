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
  .build()
```

#### 3. Safely compose excel file from schemas

```ts
import { ExcelBuilder } from '@chronicstone/typed-xlsx'

const arrayBuffer = ExcelBuilder
  .create()
  .sheet('sheet1', { data: users, schema: assessmentExport })
  .sheet('sheet2', { data: users, schema: assessmentExport, select: ['firstName', 'lastName', 'email'] }) // OPTIONALLY SELECT COLUMNS YOU WANT
  .build()

fs.writeFileSync('test.xlsx', arrayBuffer)
```

#### 4. Have fun

Here's the generated file for the example from above

![DEMO_GENERATED_FILE](image.png)

[DOWNLOAD GENERATED EXAMPLE](https://github.com/ChronicStone/typed-xlsx/blob/main/example.xlsx)


## License

[MIT](./LICENSE) License © 2023-PRESENT [Cyprien THAO](https://github.com/ChronicStone)


<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/pkg-placeholder?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/pkg-placeholder
[npm-downloads-src]: https://img.shields.io/npm/dm/pkg-placeholder?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/pkg-placeholder
[bundle-src]: https://img.shields.io/bundlephobia/minzip/pkg-placeholder?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=pkg-placeholder
[license-src]: https://img.shields.io/github/license/antfu/pkg-placeholder.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/antfu/pkg-placeholder/blob/main/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/pkg-placeholder
