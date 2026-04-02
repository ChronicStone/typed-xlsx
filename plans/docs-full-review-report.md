# Docs Review Report

This report reviews the current rewritten docs across:

- section structure
- page placement
- section and subsection naming
- clarity and pacing
- technical accuracy
- redundancy and drift risk
- cross-linking and navigation

Scope reviewed:

- landing page
- all pages under `docs/content/1.getting-started`
- all pages under `docs/content/2.core-concepts`
- all pages under `docs/content/3.schema-builder`
- all pages under `docs/content/4.formulas`
- all pages under `docs/content/5.excel-table-mode`
- all pages under `docs/content/6.workbook-builder`
- all pages under `docs/content/7.streaming`
- all pages under `docs/content/8.performance`
- all pages under `docs/content/9.reference`
- all pages under `docs/content/10.migration`

## Executive summary

Overall, the rewritten structure is a real improvement over the old docs.

What is working well:

- the split into `Core Concepts`, `Schema Builder`, `Formulas`, `Excel Table Mode`, `Workbook Builder`, and `Streaming` is much clearer than the old mixed structure
- the docs now have a much better mental-model backbone than before
- formula columns, streaming, and excel-table mode now have visible homes in the information architecture
- the migration guide remains strong and the landing page is much more polished than before

What still needs work:

- there are several high-severity technical inaccuracies
- some pages still sit in the wrong section for the user mental model
- a few examples are invalid or misleading if copied literally
- some low-level details are duplicated across overview pages, reference pages, and tutorial pages, which is already causing drift

Bottom line:

- the structure is good enough to keep
- the main work now is correction, tightening, and de-duplication
- this is not a case where the docs need another architecture rewrite

## Overall structural assessment

### What is strong

1. `Core Concepts` is the right addition.
   It gives the docs a place to explain the two big mental models:
   - schema mode choice
   - buffered vs streaming builder choice

2. `Excel Table Mode` deserves its own section.
   Promoting it out of footnote status is correct.

3. Separating `Formulas` from `Schema Builder` mostly works.
   Formula columns are now discoverable instead of buried.

4. Merging the old schema-builder sprawl into `Defining Columns` was the right direction.

### What is still structurally awkward

1. `Selection` is under `Schema Builder`, but it is operationally a table-time concern, not a schema-definition concern.
2. `AutoFilter` sits under `Excel Table Mode`, but much of its content is really cross-mode behavior.
3. `Workbook Builder` is partly buffered-specific and partly shared, which weakens section identity.
4. `Comparison` is useful, but it reads more like product positioning than onboarding and may not belong in `Getting Started`.

## Critical issues

### 1. Broken landing-page navigation

- File: `docs/content/index.md`
- Issue: the landing page links to `/workbook-builder/overview`, but the current page is `buffered-workbook`.
- Why it matters: this is a broken route on the front door of the docs.
- Recommended fix: update the landing card to the real route or add a redirect/overview page.

### 2. Wrong `.table()` API shape in type/reference docs

- File: `docs/content/9.reference/2.types.md`
- Issue: the docs describe `TableInput` / `StreamTableInput` as if `id` belongs inside the input object.
- Actual API: `.table(id, input)`
- Why it matters: this is a core API shape and this page can actively mislead users.
- Recommended fix: remove `id` from the input-shape docs and document `.table(id, input)` consistently.

### 3. Invalid or misleading formula/address examples

- Files:
  - `docs/content/1.getting-started/3.quick-start-buffered.md`
  - `docs/content/2.core-concepts/1.schema-modes.md`
  - `docs/content/4.formulas/1.formula-columns.md`
  - `docs/content/4.formulas/4.scope-and-modes.md`
- Issue: several examples describe A1 formulas that do not match the shown column order.
- Why it matters: this undermines trust in the formula docs.
- Recommended fix: verify all displayed A1 and structured-reference examples against actual output.

### 4. Incorrect `headerStyle` API documentation

- File: `docs/content/3.schema-builder/5.cell-styling.md`
- Issue: `headerStyle` is documented as if it accepts a callback like `style`, but it is static only.
- Why it matters: users copying this will write unsupported code.
- Recommended fix: explicitly separate:
  - `style`: static or callback
  - `headerStyle`: static only

### 5. Incorrect `defaultValue` semantics

- File: `docs/content/3.schema-builder/1.defining-columns.md`
- Issue: docs say `defaultValue` applies to `null`, `undefined`, and empty string.
- Actual behavior: empty strings are preserved.
- Why it matters: this changes output semantics.
- Recommended fix: remove empty-string fallback from the docs unless implementation changes.

### 6. Summary `empty()` vs `spacer()` docs are wrong/internally inconsistent

- File: `docs/content/3.schema-builder/2.summaries.md`
- Issue: the page contradicts itself and misstates which one suppresses summary-row styling.
- Why it matters: summary layout is subtle and users need exact semantics.
- Recommended fix: replace prose with a behavior table covering:
  - `label()`
  - `formula()`
  - `empty()`
  - `spacer()`

### 7. Manual S3 multipart example is technically broken

- File: `docs/content/7.streaming/5.examples.md`
- Issue: it uploads arbitrary stream chunks as multipart parts and ignores minimum part-size rules.
- Why it matters: users copying it may build broken uploads.
- Recommended fix: remove it or rewrite it to coalesce chunks properly. Prefer the AWS `Upload` helper path.

### 8. Benchmark page does not match actual tooling

- File: `docs/content/8.performance/2.benchmarks.md`
- Issue: script location, command names, CLI flags, and output directory do not match the actual benchmark scripts.
- Why it matters: this page is operational guidance and is currently inaccurate.
- Recommended fix: rewrite from the current benchmark scripts or generate from actual benchmark output.

## Important issues

### 1. Installation page is too thin and partly misplaced

- File: `docs/content/1.getting-started/2.installation.md`
- Issues:
  - says “package manager of choice” but only shows pnpm
  - mixes install basics with schema-mode explanation
  - includes advanced stream builder configuration too early
- Recommended fix: keep this page focused on install/import basics and move the rest to linked pages.

### 2. Introduction is overloaded

- File: `docs/content/1.getting-started/1.introduction.md`
- Issue: it already contains content that overlaps significantly with comparison, formulas, and builder choice.
- Recommended fix: trim it to:
  - what the library is
  - one schema example
  - one short “why type safety matters” section
  - next steps

### 3. `Comparison` may be in the wrong place

- File: `docs/content/1.getting-started/5.comparison.md`
- Issue: it is long, detailed, and positioning-heavy for a beginner flow.
- Recommended fix: either shorten it dramatically or move it out of `Getting Started` into a separate comparison/product-positioning area.

### 4. The docs still do not clearly express the two independent choices users make

- Files:
  - `docs/content/2.core-concepts/1.schema-modes.md`
  - `docs/content/2.core-concepts/2.buffered-vs-streaming.md`
  - `docs/content/5.excel-table-mode/1.overview.md`
  - `docs/content/6.workbook-builder/1.buffered-workbook.md`
  - `docs/content/7.streaming/1.overview.md`
- Issue: readers can still come away thinking buffered, streaming, and excel-table are competing modes.
- Recommended fix: add a short “Choose in two steps” box:
  1. choose schema mode: report vs excel-table
  2. choose builder: buffered vs streaming

### 5. `Selection` is likely in the wrong section

- File: `docs/content/3.schema-builder/4.selection.md`
- Issue: selection is applied at `.table(...)` time, not schema-definition time.
- Recommended fix: move it to workbook/table docs or explicitly frame it as table-time selection over a reusable schema.

### 6. `AutoFilter` is in the wrong section or needs reframing

- File: `docs/content/5.excel-table-mode/4.autofilter.md`
- Issue: much of the page documents report-table behavior.
- Recommended fix:
  - either move it to shared workbook/table options docs
  - or make the excel-table part primary and move report specifics to a shorter cross-link section

### 7. Workbook-builder section identity is fuzzy

- Files:
  - `docs/content/6.workbook-builder/1.buffered-workbook.md`
  - `docs/content/6.workbook-builder/2.sheets.md`
  - `docs/content/6.workbook-builder/3.output.md`
- Issue: one page is buffered-specific, one is shared, one mixes buffered and stream output.
- Recommended fix: either rename the section to `Workbook Builders` or keep section 6 buffered-only and move shared/stream finalization elsewhere.

### 8. Invalid stream output examples

- Files:
  - `docs/content/6.workbook-builder/3.output.md`
  - `docs/content/7.streaming/3.output-targets.md`
- Issue: examples imply multiple finalization methods can be used on the same stream workbook instance.
- Recommended fix: show separate examples and add a warning: choose exactly one finalization path per workbook instance.

### 9. Streaming memory guidance is overstated in places

- Files:
  - `docs/content/7.streaming/1.overview.md`
  - `docs/content/7.streaming/2.commit-api.md`
  - `docs/content/7.streaming/4.memory-tuning.md`
  - `docs/content/8.performance/3.patterns.md`
- Issue: phrases like “memory stays flat” or recommending `tempStorage: "memory"` for low-memory environments are too absolute or misleading.
- Recommended fix: qualify memory claims and distinguish:
  - no writable filesystem
  - truly low-memory with writable disk
  - shared-string growth

### 10. Formula docs need a stronger caveat about recalculation behavior

- Files:
  - `docs/content/4.formulas/1.formula-columns.md`
  - `docs/content/4.formulas/3.summary-formulas.md`
- Issue: “Excel evaluates it on open” is broadly true but too simple.
- Recommended fix: add a short note that some viewers/importers may not recalculate immediately.

### 11. `.group()` mental model is still risky in places

- Files:
  - `docs/content/2.core-concepts/1.schema-modes.md`
  - `docs/content/3.schema-builder/3.column-groups.md`
  - `docs/content/5.excel-table-mode/1.overview.md`
- Issue: some wording suggests visual grouped headers or visible grouping semantics that do not reflect the real feature surface, especially in excel-table mode.
- Recommended fix: consistently describe groups as runtime-generated columns / grouped selection / grouped formula targets, not as a visual header-band feature.

### 12. Reference docs are already drifting because they overlap too much

- Files:
  - `docs/content/9.reference/1.api-reference.md`
  - `docs/content/9.reference/2.types.md`
- Issues:
  - overlapping coverage of runtime API and types
  - summary helpers missing in reference even though documented elsewhere
- Recommended fix:
  - make `api-reference.md` the canonical runtime API page
  - keep `types.md` narrower and more mechanical

## Nice-to-have issues

### 1. Some naming can be simpler or more user-oriented

- Examples:
  - `Predecessor-based scope` could be phrased more plainly as “Only reference earlier columns”
  - `Calling .build()` could be “When to build and reuse a schema”
  - `Basic syntax` could become “Your first formula column”

### 2. Some overview pages still repeat too many defaults/options

- Files:
  - `docs/content/5.excel-table-mode/1.overview.md`
  - `docs/content/5.excel-table-mode/4.autofilter.md`
  - `docs/content/6.workbook-builder/1.buffered-workbook.md`
- Recommendation: keep one canonical options table and cross-link from the others.

### 3. Landing page copy has some editorial/internal phrasing

- File: `docs/content/index.md`
- Example: “The original landing shipped…”
- Recommendation: rewrite from the reader’s perspective only.

### 4. Quick-start framing sometimes overpromises simplicity

- Files:
  - `docs/content/1.getting-started/1.introduction.md`
  - `docs/content/1.getting-started/3.quick-start-buffered.md`
- Recommendation: avoid claims like “in 30 lines” when the actual examples are more involved.

### 5. `Comparison` and migration pages should be more cross-linked

- File: `docs/content/10.migration/1.v0-to-v1.md`
- Recommendation: add direct “See also” links from each major migration block to the canonical rewritten pages.

## Section-by-section assessment

### 1. Getting Started

Assessment:

- strong examples and better onboarding than before
- still too heavy in `Introduction`
- `Comparison` likely not in the right place
- `Installation` needs to be more focused and more accurate

### 2. Core Concepts

Assessment:

- the right section to have
- conceptually strong
- still needs a stronger “two independent decisions” framing
- some formula/A1 examples need correction

### 3. Schema Builder

Assessment:

- structurally much better than the old version
- biggest problems are technical accuracy in `defaultValue`, `headerStyle`, and summary helper semantics
- `Selection` likely belongs elsewhere

### 4. Formulas

Assessment:

- huge improvement over the old docs gap
- needs more precise examples and some tightening between tutorial vs reference roles
- should explicitly keep “scope” and “reference” content distinct

### 5. Excel Table Mode

Assessment:

- correct promotion to a standalone section
- best remaining issue is page boundary/placement, especially `AutoFilter`
- wording should avoid implying visual grouped headers

### 6. Workbook Builder

Assessment:

- useful content, but section identity is currently muddy
- needs a more deliberate split between buffered-only and shared material

### 7. Streaming

Assessment:

- mostly good and useful
- strongest issues are around output finalization examples and memory guidance precision
- examples page has one serious broken sample

### 8. Performance

Assessment:

- conceptually strong section
- benchmark page needs urgent factual correction
- memory tuning advice should not conflict with streaming docs

### 9. Reference

Assessment:

- useful, but already drifting
- should be tightened to avoid overlap and contradictory API descriptions

### 10. Migration

Assessment:

- still one of the stronger sections
- mostly needs better linking into the new docs architecture

## Recommended fix order

1. Fix broken/incorrect routes and invalid code/output examples
2. Fix incorrect API/behavior docs:
   - `.table(id, input)`
   - `headerStyle`
   - `defaultValue`
   - `empty()` vs `spacer()`
3. Rewrite the broken manual S3 multipart example
4. Rewrite `benchmarks.md` from actual tooling
5. Add the “choose in two steps” framing across the relevant overview pages
6. Reduce reference-page overlap and clarify canonical ownership of API vs type docs
7. Revisit page placement for `Selection`, `AutoFilter`, and `Comparison`

## Final recommendation

Keep the overall structure.

Do not do another big doc re-architecture pass right now.

Instead:

- keep the section layout
- fix the concrete inaccuracies
- simplify a few page boundaries
- reduce duplication between overview/tutorial/reference pages

The current docs are close enough structurally that targeted corrections will produce a much better result than another round of reorganization.
