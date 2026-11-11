# Contributing

Thanks for helping. Bug reports with a small schema that shows the problem are the most useful contribution of all: [open an issue](https://github.com/ChronicStone/typed-xlsx/issues/new/choose).

## Set up

You need [Bun](https://bun.sh) 1.3 or later.

```bash
bun install
bun run check      # types, tests and package build for every workspace
bun run lint && bun run format:check
bun run docs:dev   # docs site on http://localhost:3000
```

`bun install` also installs a pre-commit hook that runs lint and format on the files you commit. CI runs `bun run lint` and `bun run format:check` on every pull request too, so run `bun run format` if either fails. CI uses Node 24 for the workspace checks and tests the packed package on Node 20, 22 and 24.

To test the package the way it is published (packed, installed into a fresh project, type-checked against the bundled declarations and run), build it and then run the smoke test:

```bash
cd packages/core
bun run build
bun run smoke:packed              # TypeScript latest, run with Node
node scripts/smoke-packed.mjs 5.7 # a specific TypeScript version
node scripts/smoke-packed.mjs latest --runtime=bun # or --runtime=deno
```

The library lives in `packages/core`, the docs in `apps/docs`, and the playground workbooks in `packages/examples`.

## Pull requests

- Add a test in `packages/core/test` for any behaviour change.
- A new user-facing feature also gets a section in the kitchen-sink example (`packages/core/test/fixtures/kitchen-sink`) and a docs page.
- Run `bun run changeset` and describe the change for the release notes.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) with a scope, such as `fix(core): keep column widths in streamed sheets`.

For anything large, open an issue first so we can agree on the API before you write it.
