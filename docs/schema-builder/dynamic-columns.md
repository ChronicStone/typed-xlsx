# Dynamic Columns

In `typed-xlsx`, dynamic columns allow for the creation of multiple columns based on runtime context, providing a powerful way to tailor your Excel reports to specific data sets. This feature is particularly useful when the structure of your output depends on data that isn't known until the time of file generation.

## How Dynamic Columns Work

Dynamic columns are defined using the `group` method of `ExcelSchemaBuilder`. This method takes a unique group identifier and a callback function. The callback function is called with an instance of `ExcelSchemaBuilder` and the context data, allowing you to dynamically generate columns based on this context.

### Defining Dynamic Columns

To define dynamic columns, you provide a context which is injected when building the actual file with `ExcelBuilder`. The context can be of any type you define, and it will be enforced when passing data to ensure type safety. Group column key must always be prefixed with `group:`.

```ts twoslash
// @errors: 2322
import { ExcelBuilder, ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
interface Organization { id: string, name: string }
interface User { id: string, name: string, organizations: Organization[] }

// Group definition within the schema
const schema = ExcelSchemaBuilder.create<User>()
  .column('id', { key: 'id' })
  .column('name', { key: 'name' })
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

const organizations: Organization[] = [{ id: '1', name: 'Org 1' }, { id: '2', name: 'Org 2' }, { id: '3', name: 'Org 3' }]
const users: User[] = [{ id: '1', name: 'John', organizations: [{ id: '1', name: 'Org 1' }] }, { id: '2', name: 'Jane', organizations: [{ id: '1', name: 'Org 1' }, { id: '2', name: 'Org 2' }] }, { id: '3', name: 'Bob', organizations: [{ id: '1', name: 'Org 1' }, { id: '2', name: 'Org 2' }, { id: '3', name: 'Org 3' }] }]

const file = ExcelBuilder.create()
  .sheet('Sheet1')
  .addTable({
    data: users,
    schema,
    context: {
      'group:org': organizations
    }
  })
  .build({ output: 'buffer' })
```

The example above will output :

![Dynamic columns](../public/images/examples/col-dynamic-1.png)
