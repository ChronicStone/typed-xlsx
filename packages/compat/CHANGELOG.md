# xlsmith

## 2.0.2

### Patch Changes

- [`1a39b5c`](https://github.com/ChronicStone/typed-xlsx/commit/1a39b5cac47165e97c39d19c0b08840f00de33ef) Thanks [@ChronicStone](https://github.com/ChronicStone)! - Restore `typed-xlsx` as the canonical public package name.

  The API stays the same. Consumers only need to update their package install command and import path.

  Publish a compatibility release for `xlsmith` that re-exports `typed-xlsx`, and deprecate both transition package names on npm.

- Updated dependencies [[`1a39b5c`](https://github.com/ChronicStone/typed-xlsx/commit/1a39b5cac47165e97c39d19c0b08840f00de33ef)]:
  - typed-xlsx@3.0.0
