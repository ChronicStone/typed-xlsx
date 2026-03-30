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
