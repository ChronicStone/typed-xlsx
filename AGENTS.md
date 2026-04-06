# Agent Rules

## Commits

- Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
- Always use a scope: `type(scope): subject`
- Keep subjects short, imperative, and without a trailing period.
- Prefer narrow scopes such as `core`, `docs`, `landing`, `filters`, `twoslash`, `release`, `ci`, or `monorepo`.

## Docs

- Use Twoslash for code examples when setting up or updating docs examples.
- Make sure Twoslash examples actually compile and do not introduce dev server errors.
- Run docs validation commands sequentially, not in parallel. In particular, avoid running `check:content`, `generate:twoslash`, `nuxt prepare`, `nuxt build`, or other Nuxt content/Twoslash validation steps concurrently because the docs toolchain can hit SQLite/content cache locking and flaky failures.
- When docs UI or layout changes matter, use the browser agent to verify the rendered result.

## Examples

- `packages/xlsmith/examples/kitchen-sink-*` must reflect the current user-facing feature surface.
- Any new user-facing feature must be reflected in the kitchen-sink example unless there is a clear, documented reason not to.
- If a feature is intentionally omitted from kitchen sink, explain why in the PR or working notes.
- Prefer one focused kitchen-sink usage per feature rather than many redundant variations.
