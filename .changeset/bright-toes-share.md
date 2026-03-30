---
"@chronicstone/typed-xlsx": patch
---

Improve schema typing and inference across accessors, groups, and table selection.

- tighten accessor typing so path accessors, callback accessors, and derived transform values stay precisely inferred
- improve group typing so group ids and group context shapes are preserved from the group callback signature
- make table context requirements depend on the selected groups, including fine-grained `include` and `exclude` inference
- align runtime behavior and documentation with the updated grouped schema typing model
