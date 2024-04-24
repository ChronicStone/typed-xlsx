---
title: Elysia - Ergonomic Framework for Humans
layout: page
sidebar: false
head:
    - - meta
      - property: 'og:title'
        content: Elysia - Ergonomic Framework for Humans

    - - meta
      - name: 'description'
        content: Elysia is an ergonomic framework for Humans. With end-to-end type safety and great developer experience. Elysia is familiar, fast, and first class TypeScript support with well-thought integration between services whether it's tRPC, Swagger or WebSocket. Elysia got you covered, start building next generation TypeScript web servers today.

    - - meta
      - property: 'og:description'
        content: Elysia is an ergonomic framework for Humans. With end-to-end type safety and great developer experience. Elysia is familiar, fast, and first class TypeScript support with well-thought integration between services whether it's tRPC, Swagger or WebSocket. Elysia got you covered, start building next generation TypeScript web servers today.
---

<script setup>
    import Landing from '../components/midori/index.vue'
</script>

<Landing>
  <template v-slot:justreturn>
  
```typescript twoslash
import { Elysia } from 'elysia'

new Elysia()
    .get('/', 'Hello World')
    .get('/json', {
        hello: 'world'
    })
    .get('/id/:id', ({ params: { id } }) => id)
    .listen(3000)

```

  </template>

  <template v-slot:typestrict>

```typescript twoslash
import { Elysia, t } from 'elysia'

new Elysia()
    .post(
        '/profile',
        // ↓ hover me ↓
        ({ body }) => body,
        {
            body: t.Object({
                username: t.String()
            })
        }
    )
    .listen(3000)

```
  </template>

  <template v-slot:openapi>

```ts twoslash
// @filename: controllers.ts
import { Elysia } from 'elysia'

export const users = new Elysia()
    .get('/users', 'Dreamy Euphony')

export const feed = new Elysia()
    .get('/feed', ['Hoshino', 'Griseo', 'Astro'])

// @filename: server.ts
// ---cut---
import { Elysia, t } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { users, feed } from './controllers'

new Elysia()
    .use(swagger())
    .use(users)
    .use(feed)
    .listen(3000)
```
  </template>

<template v-slot:server>

```typescript twoslash
// @filename: server.ts
// ---cut---
// server.ts
import { Elysia, t } from 'elysia'

const app = new Elysia()
    .patch(
        '/user/profile',
        ({ body, error }) => {
            if(body.age < 18) 
                return error(400, "Oh no")

            if(body.name === 'Nagisa')
                return error(418)

            return body
        },
        {
            body: t.Object({
                name: t.String(),
                age: t.Number()
            })
        }
    )
    .listen(80)
    
export type App = typeof app
```
  </template>

  <template v-slot:client>

```typescript twoslash
// @errors: 2322 1003
// @filename: server.ts
import { Elysia, t } from 'elysia'

const app = new Elysia()
    .patch(
        '/user/profile',
        ({ body, error }) => {
            if(body.age < 18) 
                return error(400, "Oh no")

            if(body.name === 'Nagisa')
                return error(418)

            return body
        },
        {
            body: t.Object({
                name: t.String(),
                age: t.Number()
            })
        }
    )
    .listen(80)

export type App = typeof app

// @filename: client.ts
// ---cut---
// client.ts
import { treaty } from '@elysiajs/eden'
import type { App } from './server'

const api = treaty<App>('localhost')

const { data, error } = await api.user.profile.patch({
    name: 'saltyaom',
    age: '21'
})

if(error)
    switch(error.status) {
        case 400:
            throw error.value
//                         ^?

        case 418:
            throw error.value
//                         ^?
}

data
// ^?
```
  </template>


</Landing>
 Save