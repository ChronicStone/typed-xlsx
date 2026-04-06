---
"xlsmith": major
"@chronicstone/typed-xlsx": patch
---

Rename the public package from `@chronicstone/typed-xlsx` to `xlsmith`.

The API stays the same. Consumers only need to update their package install command and import path.

Publish a compatibility release for `@chronicstone/typed-xlsx` that re-exports `xlsmith`, and deprecate the old package on npm.
