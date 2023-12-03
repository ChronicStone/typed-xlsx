import fs from 'node:fs'
import { describe, it } from 'vitest'
import { faker } from '@faker-js/faker'
import type { TransformersMap } from '../src/types'
import { ExcelBuilder, ExcelSchemaBuilder } from '../src'

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

const transformers = {
  boolean: (value: boolean) => value ? 'Yes' : 'No',
  list: (value: (string)[]) => value.join(', '),
  arrayLength: (value: any[]) => value.length,
} satisfies TransformersMap
// Usage example

describe('should', () => {
  it('exported', () => {
    const users: User[] = Array.from({ length: 100 }, (_, id) => ({
      id,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      roles: ['admin', 'user', 'manager', 'guest'].filter(() => Math.random() > 0.5),
      // RANDOM NUMBER OF ORGANIZATIONS
      organizations: Array.from({ length: Math.floor(Math.random() * 5) }, (_, id) => ({
        id,
        name: faker.company.name(),
      })),
      results: {
        general: { overall: Math.floor(Math.random() * 10) },
        technical: { overall: Math.floor(Math.random() * 10) },
        ...(Math.random() > 0.5 ? { interview: { overall: Math.floor(Math.random() * 10) } } : {}),
      },
    }))
    const assessmentExport = ExcelSchemaBuilder
      .create<User>()
      .withTransformers(transformers)
      .column('id', { value: 'id' })
      .column('firstName', { value: 'firstName' })
      .column('lastName', { value: 'lastName' })
      .column('email', { value: 'email' })
      .column('roles', { value: 'roles', transform: 'list' })
      .column('nbOrgs', { value: 'organizations', transform: 'arrayLength' })
      .column('orgs', { value: 'organizations', transform: value => value.map(org => org.name).join(', ') })
      .column('generalScore', { value: 'results.general.overall' })
      .column('technicalScore', { value: 'results.technical.overall' })
      .column('interviewScore', { value: 'results.interview.overall', default: 'N/A' })
      .build()

    const buffer = ExcelBuilder
      .create()
      .sheet('sheet1', { data: users, schema: assessmentExport })
      .sheet('sheet2', { data: users, schema: assessmentExport, select: ['firstName', 'lastName', 'email'] })
      .build()

    fs.writeFileSync('test.xlsx', buffer)
  })
})
