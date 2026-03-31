# Agent Rules

## Commits

- Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
- Always use a scope: `type(scope): subject`
- Keep subjects short, imperative, and without a trailing period.
- Prefer narrow scopes such as `core`, `docs`, `landing`, `filters`, `twoslash`, `release`, `ci`, or `monorepo`.

## Docs

- Use Twoslash for code examples when setting up or updating docs examples.
- Make sure Twoslash examples actually compile and do not introduce dev server errors.
- When docs UI or layout changes matter, use the browser agent to verify the rendered result.

## Examples

- `packages/typed-xlsx/examples/kitchen-sink-*` must reflect the current user-facing feature surface.
- Any new user-facing feature should be added to the kitchen-sink example unless there is a clear reason not to.
- Prefer one focused kitchen-sink usage per feature rather than many redundant variations.
