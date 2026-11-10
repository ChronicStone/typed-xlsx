# Contributing

Thanks for helping. Bug reports with a small schema that shows the problem are the most useful contribution of all: [open an issue](https://github.com/ChronicStone/typed-xlsx/issues/new/choose).

## Set up

You need [Bun](https://bun.sh) 1.3 or later.

```bash
bun install
bun run check      # types, tests and package build for every workspace
bun run docs:dev   # docs site on http://localhost:3000
```

The library lives in `packages/core`, the docs in `apps/docs`, and the playground workbooks in `packages/examples`.

## Pull requests

- Add a test in `packages/core/test` for any behaviour change.
- A new user-facing feature also gets a section in the kitchen-sink example (`packages/core/test/fixtures/kitchen-sink`) and a docs page.
- Run `bun run changeset` and describe the change for the release notes.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) with a scope, such as `fix(core): keep column widths in streamed sheets`.

For anything large, open an issue first so we can agree on the API before you write it.
