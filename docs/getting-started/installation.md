# Installation

To install `typed-xlsx` into your project, follow these straightforward steps:

## 1. Install the package 

Choose your preferred package manager and run the corresponding command to add `typed-xlsx` to your project:

::: code-group
```sh [npm]
npm install @chronicstone/typed-xlsx
```

```sh [yarn]
yarn add @chronicstone/typed-xlsx
```

```sh [pnpm]
pnpm add @chronicstone/typed-xlsx
```

```sh [bun]
bun add @chronicstone/typed-xlsx
```
:::

## 2. Import the library

With the package installed, you can now import `ExcelBuilder` and `ExcelSchemaBuilder` into your project:

```ts twoslash
// @errors: 2345
import { ExcelBuilder, ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'

interface User {
  id: number
  name: string
  email: string
  posts: Array<{
    id: number
    title: string
    likes: number
  }>
}

const schema = ExcelSchemaBuilder.create<User>()
  .column('ID', { key: 'id' })
  .column('Name', { key: 'name' })
  .column('Email', { key: 'email' })
  .column('Posts.ID', { key: 'posts', transform: row => row.map(post => post.id) })
  .column('Posts.Title', { key: 'posts', transform: row => row.map(post => post.title) })
  .column('Posts.Likes', { key: 'posts', transform: row => row.map(post => post.likes) })
  .build()

const users: User[] = []
const excelFile = ExcelBuilder.create()
  .sheet('Sheet1')
  .addTable({
    data: users,
    schema,
  })
  .build({ output: 'buffer' })
```

After completing these steps, `typed-xlsx` will be set up and ready to generate sophisticated Excel reports with ease.
