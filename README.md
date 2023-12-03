# typed-xlsx

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]


> **Note**:
> Export any data into xls/xlsx files effortlessly, while benefiting from great type-safety & developper experience.


## INSTALLATION
```ts
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
import { ExcelSchemaBuilder } from "@chronicstone/typed-xlsx"

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
      .column('id', { value: 'id' }) // TYPE-SAFE OBJECT KEYS ACCESSOR
      .column('firstName', { value: 'firstName' })
      .column('lastName', { value: 'lastName' })
      .column('email', { value: 'email' })
      .column('roles', { value: 'roles', transform: 'list' }) // TRANSFORM TYPE-SAFE DEPENDING ON TYPE MATCHING 'value' PROP
      .column('nbOrgs', { value: 'organizations', transform: 'arrayLength' }) // IF VALUE KEY DOES MATCH ACCEPTED CELL VALUE, TRANSFORMATION WILL BE REQUIRED
      .column('orgs', { value: 'organizations', transform: value => value.map(org => org.name).join(', ') }) // TRANSFORM CAN BE EITHER SHARED TRANSFORMER OR FUNCTION (AUTO-TYPE-SAFE)
      .column('generalScore', { value: 'results.general.overall' })
      .column('technicalScore', { value: 'results.technical.overall' })
      .column('interviewScore', { value: 'results.interview.overall', default: 'N/A' }) // AUTO-HANDLES NULL / UNDEFINED VALUE, PROVIDE DEFAULT IF NEEDED
      .build()
```


#### 3. Safely compose excel file from schemas

```ts
import { ExcelBuilder } from "@chronicstone/typed-xlsx"

const arrayBuffer ExcelBuilder
      .create()
      .sheet('sheet1', { data: users, schema: assessmentExport })
      .sheet('sheet2', { data: users, schema: assessmentExport, select: ['firstName', 'lastName', 'email'] }) // OPTIONALLY SELECT COLUMNS YOU WANT
      .build()

fs.writeFileSync('test.xlsx', arrayBuffer)
```

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
