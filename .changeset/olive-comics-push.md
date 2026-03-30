---
"@chronicstone/typed-xlsx": patch
---

Tighten grouped schema typing so `select.include` and `select.exclude` accept group ids as first-class entries, and require matching `context` when grouped schemas are used. This also updates the groups and reference docs to reflect the V1-style group selection model.
