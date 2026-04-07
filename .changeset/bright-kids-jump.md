---
"typed-xlsx": major
"xlsmith": patch
---

Restore `typed-xlsx` as the canonical public package name.

The API stays the same. Consumers only need to update their package install command and import path.

Publish a compatibility release for `xlsmith` that re-exports `typed-xlsx`, and deprecate both transition package names on npm.
