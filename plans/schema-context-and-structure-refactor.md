# Schema Context And Structure Refactor

## Status

Draft for review.

## Goal

Refactor the schema API so that:

- column structure is described with explicit, stable terms
- runtime-generated columns are distinct from structural grouping
- a single typed table context is available everywhere
- formulas and summaries use a coherent selector vocabulary
- selection, conditions, and dynamic expansion have clear independent semantics
- docs and examples teach the same mental model the API encodes

This refactor intentionally drops backward compatibility. The target is a cleaner vNext surface, not a layered migration facade.

## Problems In The Current Model

### 1. `.group()` conflates structure and runtime expansion

The current `.group()` API is used for runtime-generated columns driven by context. The name implies a structural or visual column grouping, but the actual behavior is dynamic expansion. That creates confusion in both the schema DSL and the docs.

### 2. Context is modeled too narrowly

Today, context is attached to dynamic group callbacks and inferred selectively depending on which groups are included. This makes the API clever but hard to explain. It also prevents context from being used consistently in formulas, styles, conditions, headers, validation, and hyperlinks.

### 3. Formula vocabulary does not match schema vocabulary

The schema DSL talks about columns and groups, but formula scope uses a separate mental model. That disconnect gets worse if the current `.group()` is renamed to represent actual structure.

### 4. Selection and context are too tightly coupled

The current type story around "context required only if a selected group needs it" is precise but costly. It complicates the public model and the documentation for a relatively small ergonomic win.

### 5. Docs mix runtime-generated columns with grouped headers

The phrase "column groups" is currently doing too much work. It sometimes means dynamic expansion, sometimes structural grouping, and sometimes formula aggregation scope.

## Design Principles

- Prefer explicit nouns over overloaded abstractions.
- Keep structure, generation, and selection as separate concepts.
- Make context a schema-level concept, not a special case of dynamic expansion.
- Reuse the same vocabulary across schema, formulas, summaries, examples, and docs.
- Keep the model composable: dynamic nodes can exist at top level or inside groups.
- Keep structural conditions row-independent.

## Proposed Core Vocabulary

### Schema-definition vocabulary

- `column()` = one static leaf column definition
- `group()` = a structural group of columns
- `dynamic()` = runtime-generated columns expanded from global context
- `condition` = context-based structural visibility predicate
- `context` = typed table render context passed once when materializing a table

### Formula and summary vocabulary

- `refs.column(id)` = one leaf column reference
- `refs.group(id)` = selector for all eligible descendant leaf columns under a structural group
- `refs.dynamic(id)` = selector for all eligible descendant leaf columns under a dynamic node

`column`, `group`, and `dynamic` stay reserved for schema construction. `refs.*` is the selector namespace for formulas and summaries.

## Proposed Schema API

### Schema signature

```ts
createExcelSchema<Row, Context = never>(options?)
```

Semantics:

- `Row` is the data row type
- `Context` is the global typed table context
- if `Context = never`, `.table(..., { context })` is not required
- if `Context` is provided, `.table(..., { context })` is required

### Table materialization

```ts
workbook.sheet("Sheet").table("id", {
  schema,
  rows,
  context,
});
```

Context is passed once per table and made available to all callbacks that support it.

## Structural Nodes

### `column()`

```ts
column(id, options);
```

Represents one static leaf column in the schema tree.

Example:

```ts
.column("accountName", {
  header: "Account",
  accessor: "accountName",
  condition: ({ ctx }) => ctx.role !== "GUEST",
})
```

### `group()`

```ts
group(id, options, build);
```

Represents a structural subtree of columns.

Semantics:

- may contain `column()`, nested `group()`, and `dynamic()`
- may map to grouped header rendering in report mode
- may be targeted by selection
- may be targeted by formulas via `refs.group(id)`

Example:

```ts
.group("financials", { header: "Financials" }, (g) => {
  g.column("arr", { accessor: "arr", header: "ARR" })
  g.column("nrr", { accessor: "nrr", header: "NRR" })
})
```

### `dynamic()`

```ts
dynamic(id, options?, build)
```

Represents a runtime-expanded subtree whose children are generated from global context.

Semantics:

- does not imply a grouped header by itself
- may appear at top level or inside a group
- may be targeted by selection
- may be targeted by formulas via `refs.dynamic(id)`
- no local context typing; it only consumes global `ctx`

Example:

```ts
.dynamic("quarters", (d, { ctx }) => {
  for (const quarter of ctx.quarters) {
    d.column(`quarter-${quarter.id}`, {
      header: quarter.label,
      accessor: (row) => row.quarters[quarter.id] ?? 0,
    })
  }
})
```

Example inside a group:

```ts
.group("forecast", { header: "Forecast" }, (g) => {
  g.dynamic("quarters", (d, { ctx }) => {
    for (const quarter of ctx.quarters) {
      d.column(`forecast-${quarter.id}`, {
        header: quarter.label,
        accessor: (row) => row.forecast[quarter.id] ?? 0,
      })
    }
  })
})
```

### Recommended `dynamic()` signature

Use the same structural shape as `group()` and keep the builder as the first callback argument.

Recommended public signature:

```ts
dynamic(id, build);
dynamic(id, options, build);
```

Where:

```ts
type DynamicBuildContext<Context> = {
  ctx: Context;
};
```

Recommended callback shape:

```ts
dynamic("quarters", (d, { ctx }) => {
  for (const quarter of ctx.quarters) {
    d.column(`quarter-${quarter.id}`, {
      header: quarter.label,
      accessor: (row) => row.quarters[quarter.id] ?? 0,
    });
  }
});
```

Why this shape:

- matches the existing builder chaining style
- stays close to `group(id, options, build)`
- keeps the dynamic builder ergonomic for loops and local branching
- avoids introducing a second "builder object in payload" pattern

Recommended default:

- `dynamic(id, options?, build)` with `build(builder, { ctx })`

Rejected alternatives:

- `dynamic(id, ({ ctx, builder }) => {})`
- callback-first payload objects that make chaining less consistent with the rest of the schema builder

## Global Context Model

Context is a schema-level generic and is available everywhere the schema needs runtime knowledge.

Example:

```ts
type BoardContext = {
  role: "ADMIN" | "USER" | "GUEST";
  quarters: Array<{ id: string; label: string }>;
  currency: "USD" | "EUR";
};

const schema = createExcelSchema<Row, BoardContext>();
```

### Why this replaces dynamic-local context

- one context model for the entire schema
- no more selective context inference based on selected dynamic nodes
- no more dynamic-only teaching burden in docs
- formulas, styles, and conditions can all make context-aware decisions

## `condition`

`condition` is added to `column`, `group`, and `dynamic`.

Proposed shape:

```ts
condition?: ({ ctx }: { ctx: Context }) => boolean
```

Semantics:

- evaluated during schema materialization
- row-independent by design
- controls structural presence or absence of a node
- false removes the node and all its descendants from the final column tree

Examples:

```ts
.column("internalMargin", {
  header: "Margin",
  accessor: "internalMargin",
  condition: ({ ctx }) => ctx.role === "ADMIN",
})
```

```ts
.group("internal", {
  header: "Internal",
  condition: ({ ctx }) => ctx.role === "ADMIN",
}, (g) => {
  g.column("cost", { accessor: "cost" })
})
```

```ts
.dynamic("regionMetrics", {
  condition: ({ ctx }) => ctx.role !== "GUEST",
}, (d, { ctx }) => {
  for (const region of ctx.regions) {
    d.column(`region-${region.id}`, {
      header: region.label,
      accessor: (row) => row.metrics[region.id] ?? 0,
    })
  }
})
```

### Intentional constraint

`condition` is structural only. It must not depend on row values.

Rejected direction:

- `condition: ({ row, ctx }) => ...`

Reason:

- columns must not appear for some rows and disappear for others
- row-aware structural visibility would break the sheet model and complicate formulas, styles, and widths

## Callback Context Unification

All relevant callbacks should receive typed `ctx`.

Examples of callback families that should receive context:

- `accessor`
- `transform`
- `formula`
- `style`
- `header`
- `validation`
- `hyperlink`
- `condition`
- `dynamic()` builder callback
- summary formula builders/selectors

### Recommended callback payload families

Prefer a small number of stable callback payload shapes.

#### Row-aware callbacks

Used by accessors, transforms, formulas, row-based styles, hyperlinks, and custom validation formulas.

Recommended shape:

```ts
type RowCallbackArgs<Row, Context> = {
  row: Row;
  ctx: Context;
};
```

Feature-specific helpers may extend this with additional properties such as `fx`, `refs`, `rowIndex`, or `subRowIndex`.

Examples:

```ts
accessor: ({ row, ctx }) => ctx.role === "ADMIN" ? row.internalName : row.publicName
formula: ({ refs, fx, ctx }) =>
  ctx.currency === "EUR"
    ? fx.round(refs.column("amount").mul(0.92), 2)
    : refs.column("amount")
style: ({ row, ctx, subRowIndex }) => ({ ... })
hyperlink: ({ row, ctx }) => ({ target: ... })
```

#### Structure-only callbacks

Used by `condition` and any future structure-gating APIs.

Recommended shape:

```ts
type StructureCallbackArgs<Context> = {
  ctx: Context;
};
```

#### Dynamic builder callbacks

Used by `dynamic()`.

Recommended shape:

```ts
type DynamicBuilderCallback<Builder, Context> = (builder: Builder, args: { ctx: Context }) => void;
```

#### Summary formula callbacks

Used by `summary.formula(...)`.

Recommended shape:

```ts
type SummaryFormulaArgs<Context> = {
  fx: FormulaDsl;
  refs: FormulaRefs;
  ctx: Context;
};
```

This keeps summary formulas conceptually aligned with row formulas while avoiding row-only helpers where they do not make sense.

Example:

```ts
.column("amount", {
  accessor: "amount",
  formula: ({ refs, fx, ctx }) =>
    ctx.currency === "EUR"
      ? fx.round(refs.column("amount").mul(0.92), 2)
      : refs.column("amount"),
})
```

The exact callback signatures may still vary by feature, but `ctx` should be present everywhere runtime context matters.

## Formula And Summary Selector API

### Problem to solve

The schema DSL should own `column`, `group`, and `dynamic` as definition verbs. Formulas and summaries need to reference already-defined nodes without overloading those verbs on unrelated objects.

### Proposed selector namespace

Use a dedicated namespace object in formula and summary callbacks:

- `refs.column(id)`
- `refs.group(id)`
- `refs.dynamic(id)`

This keeps definition and selection concepts distinct.

### Recommended `refs.*` contract

`refs.*` should return selector objects, not raw arrays and not plain formula expressions.

Recommended shape:

```ts
refs.column(id)   -> ColumnRef
refs.group(id)    -> ScopeRef
refs.dynamic(id)  -> ScopeRef
```

Where:

- `ColumnRef` behaves like the current single-column formula reference
- `ScopeRef` represents a resolved set of eligible leaf-column references under a node

Recommended DSL support:

```ts
fx.sum(refs.group("quarters"));
fx.average(refs.dynamic("regions"));
refs.column("amount").mul(2);
```

That means `fx.*` aggregate operators should explicitly accept `ScopeRef` values.

### Why selectors should not expose mandatory `.columns()`

Example under consideration:

```ts
fx.sum(refs.group("quarters").columns());
```

Recommended against this for the first version because:

- it adds ceremony without adding much clarity
- `refs.group("quarters")` already clearly denotes a multi-column scope
- the aggregate function itself makes the intended usage obvious
- it keeps the DSL concise in both formulas and summaries

If additional introspection is needed later, selector helper methods can still be added without changing the core operand contract.

### Recommended selector method surface

For the first pass, keep selector objects intentionally minimal.

Recommended public capabilities:

- `ColumnRef` supports existing formula-expression chaining
- `ScopeRef` is accepted by aggregate functions on `fx`

Do not add selector instance methods like `.sum()`, `.average()`, or `.columns()` in the initial redesign.

Reason:

- keeps the main aggregate surface centralized in `fx`
- avoids duplicating formula verbs across `fx` and selector objects
- reduces type-system surface area during a large refactor

### Formula examples

Single leaf reference:

```ts
formula: ({ refs }) => refs.column("amount").mul(2);
```

Structural aggregate:

```ts
formula: ({ refs, fx }) => fx.sum(refs.group("quarters"));
```

Dynamic aggregate:

```ts
formula: ({ refs, fx }) => fx.average(refs.dynamic("regions"));
```

### Summary examples

```ts
summary: (summary) => [
  summary.formula(({ refs, fx }) => fx.sum(refs.group("quarters")), {
    style: { numFmt: "$#,##0.00" },
  }),
];
```

### Selector semantics

- `refs.column(id)` returns one eligible leaf reference
- `refs.group(id)` resolves to the eligible descendant leaf columns under that structural group
- `refs.dynamic(id)` resolves to the eligible descendant leaf columns under that dynamic node

"Eligible" means valid in the current scope according to the existing predecessor-based formula rules.

### Scope resolution rules

For `ScopeRef` resolution, use these rules:

1. resolve the target node in the materialized schema tree
2. collect descendant leaf columns under that node
3. filter to leaf columns that are valid predecessors from the current formula site
4. remove the current formula target if present
5. validate that the remaining scope is compatible with the aggregate being applied

Important implications:

- selectors must exclude the current formula target if it would create self-reference
- selectors should fail when the resolved node produces no eligible leaf columns
- selectors should not silently include incompatible leaf columns if the aggregation requires numeric operands

### Numeric compatibility rules

Recommended first-pass behavior:

- `refs.group()` and `refs.dynamic()` do not pre-filter by value kind
- numeric aggregate operators such as `fx.sum`, `fx.average`, `fx.min`, and `fx.max` validate compatibility when consuming a `ScopeRef`
- if a resolved scope contains incompatible leaf references for the target aggregate, fail with a build-time validation error

Reason:

- keeps selector semantics structural and predictable
- avoids hidden filtering that would make formula behavior harder to reason about
- lets the error message name both the selector target and the incompatible leaf columns

### Why not `row.group()` or `row.dynamic()`

That approach makes the formula DSL mirror the schema DSL too closely and creates naming pressure with summaries and other callback APIs. `refs.*` is clearer as a selector namespace.

### Recommended formula callback signature

Recommended row-formula payload:

```ts
type FormulaArgs<Row, Context> = {
  row: RowFormulaRuntime<Row>;
  refs: FormulaRefs;
  fx: FormulaDsl;
  ctx: Context;
};
```

Notes:

- keep `row` for row-aware helpers that are not just reference selection
- add `refs` as the dedicated selector namespace
- keep `fx` as the central formula operator surface
- include `ctx` everywhere

Recommended summary-formula payload:

```ts
type SummaryFormulaArgs<Context> = {
  refs: FormulaRefs;
  fx: FormulaDsl;
  ctx: Context;
};
```

This preserves a shared formula language while keeping row-only capabilities out of summary formulas.

## Selection Semantics

Selection continues to be explicit structural filtering and is no longer coupled to context requirement inference.

Selection targets may include:

- leaf column ids
- group ids
- dynamic ids

Example:

```ts
select: {
  include: ["accountName", "financials", "quarters"],
}
```

### Evaluation order

The materialization pipeline should use a deterministic order:

1. start from the schema tree
2. apply explicit selection include/exclude
3. evaluate `condition`
4. expand `dynamic()` nodes using `ctx`
5. resolve final leaf columns and formula scopes

Important behavior:

- explicit selection does not override a false `condition`
- context requirement is based only on the schema generic, not on selected nodes
- dynamic expansion happens after structural filtering

## Header Model

This refactor separates structure from rendering.

It also needs to resolve the current gap where table `title` exists in the API but is not rendered as an actual worksheet row.

### Structural truth

- `group()` creates a structural subtree
- `dynamic()` does not imply a grouped header band

### Rendering implication

Grouped header rows should be controlled by sheet/table rendering rules, not by dynamic generation itself.

Expected behavior:

- report mode may render grouped headers for `group()`
- a `dynamic()` node at top level remains flat unless wrapped in a `group()`
- `dynamic()` inside a `group()` contributes generated leaf columns under that group

### Title rendering

Table `title` should be treated as part of the rendered table chrome, above header rows.

Expected report-mode stack:

1. title row, if `title` is provided
2. zero or more grouped-header rows derived from structural `group()` depth
3. leaf header row
4. data rows
5. summary rows or totals row as applicable

Rules:

- `title` is independent from `group()` and `dynamic()`
- `title` does not participate in formula scopes or selection
- `title` contributes to table height and therefore affects sheet layout positioning
- `title` rendering must be reflected consistently in buffered and stream writers
- grouped-header depth and title presence must not implicitly change `freezePane`; freeze panes remain explicit sheet options

Styling direction:

- add table-level title defaults alongside header defaults
- title row styling should be distinct from grouped-header styling and leaf-header styling

This is part of the same rendering redesign and should ship with the grouped-header/table-chrome work, not as an unrelated follow-up.

### Recommended rendering API direction

Keep title and header rendering options inside existing table input/default concepts rather than introducing a separate rendering subsystem.

Recommended shape:

```ts
table("portfolio", {
  title: "Portfolio Snapshot",
  schema,
  rows,
  defaults: {
    title: { ... },
    groupHeader: { ... },
    header: { ... },
    summary: { ... },
    cells: { ... },
  },
  render: {
    groupHeaders: true,
  },
})
```

### Recommended public API

#### Table title

Keep the existing table-level title field:

```ts
title?: string
```

Do not move title into a nested object. It is already the right conceptual level.

#### Table render options

Add one table-level rendering option to control grouped-header rendering:

```ts
render?: {
  groupHeaders?: boolean
}
```

Semantics:

- `groupHeaders: true` or omitted = render structural group header rows when applicable in report mode
- `groupHeaders: false` = force a flat leaf header row even if the schema has structural groups

Why this shape:

- table rendering concerns stay at table scope rather than being confused with sheet layout
- `render` is a better container than `layout` for table chrome choices like grouped headers
- explicit and minimal while leaving room for future options without over-designing now

Rejected first-pass alternatives:

- `header: { mode: "flat" | "grouped" }`
- `layout: { groupHeaders: true }`
- inferring grouped headers automatically from schema structure

Reason for rejection:

- `header` is already heavily overloaded as a cell label concept
- table `layout` is too easily confused with sheet layout (`tablesPerRow`, gaps, freeze pane)
- automatic grouped-header rendering would make visual output harder to predict

Recommended default:

- `render` is optional
- `render.groupHeaders` is optional
- omitted behaves like `true` in report mode when structural groups are present

### Recommended defaults extension

Extend the existing `TableStyleDefaults` family with explicit table-chrome layers:

```ts
interface TableStyleDefaults {
  title?: CellStyle | TableStyleDefault;
  groupHeader?: CellStyle | TableStyleDefault;
  header?: CellStyle | TableStyleDefault;
  summary?: CellStyle | TableStyleDefault;
  cells?: {
    base?: CellStyle | TableStyleDefault;
    unlocked?: CellStyle | TableStyleDefault;
    locked?: CellStyle | TableStyleDefault;
    hidden?: CellStyle | TableStyleDefault;
  };
}
```

Semantics:

- `title` applies to rendered title rows
- `groupHeader` applies to structural group header bands
- `header` remains the leaf-column header style
- `summary` remains summary-row styling

Why this is the right place:

- the repo already has a `defaults` concept at table level
- it keeps style layering aligned with the rendered table stack
- it avoids introducing a parallel title/group header style API

### Mode-specific behavior

#### Report mode

Supports:

- rendered title row
- grouped header rows by default when structural groups are present
- `render.groupHeaders: false` to opt out and flatten the header stack
- leaf header row

#### Excel-table mode

First-pass recommendation:

- do not support grouped header rows
- reject `render.groupHeaders: true` with a validation error
- title row support remains an explicit product decision

Recommended first-pass decision for title in excel-table mode:

- keep title rendering report-only for now

Reason:

- native Excel tables own a flat table header row
- rendering a title row above an excel-table object is possible, but it is a different physical contract and should be designed deliberately
- keeping title/group header table chrome report-only for the first pass reduces ambiguity and implementation complexity

### Height calculation rules

For report tables, total rendered header height becomes:

```ts
headerHeight = (title ? 1 : 0) + (render.groupHeaders !== false ? groupDepth : 0) + 1;
```

Where:

- `groupDepth` is the number of structural group rows needed above leaf headers
- the final `1` is the leaf header row

Then total table height becomes:

```ts
tableHeight = headerHeight + dataRowCount + summaryRowCount + totalsRowCount;
```

This rule should be used consistently in:

- buffered sheet layout
- stream sheet layout
- merge range placement
- auto-filter range calculation
- title/group/header row writing

### Merging rules for rendered chrome

Recommended first-pass behavior in report mode:

- title row spans the full rendered table width with one merge range
- group header cells merge horizontally across their descendant leaf columns
- nested groups create one row per depth level
- leaf header cells remain unmerged except for any existing logical merge behavior that already applies elsewhere

### Freeze pane interaction

Freeze panes remain sheet-level and explicit.

Guidance:

- users who want title + grouped headers frozen must set `freezePane.rows` explicitly to the rendered header height they want frozen
- workbook code must not auto-adjust freeze panes based on title or grouped-header rendering

### Recommended examples in docs

Report mode with grouped headers:

```ts
workbook.sheet("Board Overview", { freezePane: { rows: 3, columns: 1 } }).table("portfolio", {
  title: "Portfolio Snapshot",
  schema,
  rows,
  render: { groupHeaders: true },
  defaults: {
    title: { preset: "header.inverse" },
    groupHeader: { preset: "header.accent" },
    header: { preset: "header.accent" },
  },
});
```

Flat report header:

```ts
workbook.sheet("Board Overview").table("portfolio", {
  title: "Portfolio Snapshot",
  schema,
  rows,
  render: { groupHeaders: false },
});
```

This plan does not finalize the grouped-header rendering API, but it establishes the data model needed for it.

## Schema Example

```ts
type BoardRow = {
  accountName: string;
  arr: number;
  nrr: number;
  forecast: Record<string, number>;
  internalMargin: number;
};

type BoardContext = {
  role: "ADMIN" | "USER" | "GUEST";
  quarters: Array<{ id: string; label: string }>;
};

const schema = createExcelSchema<BoardRow, BoardContext>()
  .column("accountName", {
    header: "Account",
    accessor: "accountName",
  })
  .group("financials", { header: "Financials" }, (g) => {
    g.column("arr", {
      header: "ARR",
      accessor: "arr",
    });
    g.column("nrr", {
      header: "NRR",
      accessor: "nrr",
    });
    g.column("internalMargin", {
      header: "Margin",
      accessor: "internalMargin",
      condition: ({ ctx }) => ctx.role === "ADMIN",
    });
  })
  .group("forecast", { header: "Forecast" }, (g) => {
    g.dynamic("quarters", (d, { ctx }) => {
      for (const quarter of ctx.quarters) {
        d.column(`forecast-${quarter.id}`, {
          header: quarter.label,
          accessor: (row) => row.forecast[quarter.id] ?? 0,
        });
      }
    });
    g.column("forecastAverage", {
      header: "Avg",
      formula: ({ refs, fx }) => fx.average(refs.dynamic("quarters")),
    });
  })
  .build();
```

## Type-System Target

The type-system goals for the refactor are:

- `Context` is carried from `createExcelSchema<Row, Context>()` into all callback signatures
- `.table(..., { context })` requires `context` iff `Context` is not `never`
- `condition` is typed on `column`, `group`, and `dynamic`
- `refs.column(id)` accepts only visible selectable leaf ids in scope
- `refs.group(id)` accepts only structural group ids visible in scope
- `refs.dynamic(id)` accepts only dynamic node ids visible in scope
- formula predecessor constraints continue to apply across nested groups and dynamic branches

The final exact types may need iteration, but these are the product-level guarantees.

## Implementation Workstreams

### 1. Core schema tree refactor

- introduce distinct internal node kinds: `column`, `group`, `dynamic`
- rename current runtime `.group()` implementation to `dynamic`
- add structural `group()` node support
- update planner traversal to preserve structural ancestry and dynamic ancestry distinctly

### 2. Global context propagation

- add schema-level `Context` generic
- plumb `context` through table planning in buffered and stream builders
- update callback runtime payloads to include `ctx`
- remove dynamic-local context inference machinery

### 3. `condition` support

- add `condition` to node definitions
- evaluate it during schema materialization before dynamic expansion
- ensure planner, widths, summaries, and formulas only see surviving nodes

### 4. Formula and summary selector redesign

- add selector namespace `refs.*`
- remove old group-based scope terminology from formula internals and public API
- make selector resolution tree-aware across `group` and `dynamic`
- preserve predecessor-based validation rules

### 5. Selection redesign

- confirm include/exclude support for group and dynamic node ids
- remove context-required-by-selection behavior
- update build-time validation after selection and conditions

### 6. Header/layout follow-up

- adapt grouped-header planning to structural `group()` nodes
- add actual rendered title-row support for table `title`
- update table height/layout calculations to account for title rows and grouped-header depth
- add title/group/header style layering in rendered table chrome
- keep this as a separate rendering pass if needed
- ensure sheet-level freeze panes remain explicit rather than inferred from header depth

### 7. Tests

- add schema API tests for `group`, `dynamic`, global `Context`, and `condition`
- add type-safety tests for selector ids and context propagation
- add buffered and stream coverage for conditions and dynamic expansion
- update kitchen sink fixtures to exercise the full new surface

## Example And Kitchen Sink Rollout

This refactor changes the user-facing feature surface enough that examples must be refreshed comprehensively, not piecemeal.

### Kitchen sink requirements

`packages/typed-xlsx/examples/kitchen-sink-*` must explicitly demonstrate:

- static leaf columns via `column()`
- structural groups via `group()`
- nested `group()` usage
- `dynamic()` expansion at top level
- `dynamic()` nested inside a group
- global schema context passed at table time
- `condition` on columns
- `condition` on groups
- `condition` on dynamic nodes
- formulas using `refs.column()`
- formulas using `refs.group()`
- formulas using `refs.dynamic()`
- summaries using the same selector vocabulary
- at least one example where context changes both visible structure and formula behavior

### Showcase examples to refresh

All existing showcase examples should be updated to the new API. In addition, add or expand examples to cover the newly explicit concepts.

Recommended example updates:

- `executive-board-pack`
  - use `group()` for actual grouped sections such as financials / forecast
  - use global context for role-based visibility and quarter generation
  - include formulas referencing a dynamic forecast scope
  - render visible table titles above headers on the board overview sheet
- `territory-performance-matrix`
  - convert runtime regional expansion to `dynamic()`
  - consider a structural `group()` around region metric families
- `kitchen-sink`
  - become the canonical demo of the new vocabulary, selector model, and rendered title/group header stack

Recommended new or expanded showcase examples:

- role-based board view
  - same schema rendered with `ADMIN` vs `USER` context
- grouped forecast workbook
  - grouped headers plus dynamic quarter expansion
- context-aware pricing workbook
  - formulas/styling altered by `ctx.currency` or similar global setting

## Docs Rewrite Impact

This refactor requires a docs rewrite across both conceptual and API-reference pages.

### Terminology changes required everywhere

Replace the current blurred language with these distinct concepts:

- static columns
- structural groups
- dynamic columns
- global context
- structural conditions
- selector references in formulas and summaries

### Pages that need substantive rewriting

- `content/1.getting-started/1.introduction.md`
- `content/1.getting-started/3.quick-start.md`
- `content/1.getting-started/4.comparison.md`
- `content/2.core-concepts/1.schema-modes.md`
- `content/2.core-concepts/2.buffered-vs-streaming.md`
- all schema-builder docs
- workbook builder docs where table `context` is shown
- API reference and types reference
- migration docs if versioned release notes are maintained

### New or heavily revised docs topics

#### Core Concepts

- schema tree mental model: leaf vs structural vs dynamic
- global context mental model
- conditions and selection as separate filters
- formula selector mental model

#### Schema Builder

- defining static columns
- structural groups
- dynamic columns
- conditions
- formulas with `refs.*`
- summaries with `refs.*`

#### Workbook Builder

- table-time context passing
- how one schema can render differently under different contexts
- how title rows, grouped headers, and leaf headers stack in report mode

#### Examples and landing content

- the landing hero and feature framing should reflect the refined product model
- docs examples should show context-aware structure, not only flat columns

### Comparison page follow-up

The comparison page should be refined to reflect the new concepts explicitly.

Potential refinements:

- distinguish structural groups from dynamic runtime-generated columns
- mention global typed context as part of the programming model advantage
- mention conditional structural visibility if it remains user-facing enough to advertise

## Rollout Plan

### Phase 1. Spec and vocabulary lock

- confirm `group`, `dynamic`, `condition`, and `refs.*` naming
- confirm global `Context` generic shape
- confirm selection + condition evaluation order

### Phase 2. Internal API refactor

- implement core schema tree and context changes
- update planner and formula resolver internals
- land tests before docs/examples churn

### Phase 3. Kitchen sink and showcase refresh

- update kitchen sink first as the canonical feature specimen
- refresh all showcase examples to the new API
- add at least one example that demonstrates context-dependent structure

### Phase 4. Docs rewrite

- rewrite concept pages first
- then update all code examples to compile under the new API
- then refresh landing and comparison messaging
- run full Twoslash verification and docs checks

## Open Decisions

These points still need explicit product decisions before implementation starts:

1. Grouped-header rendering API

This spec defines the structure needed for grouped headers and title rows but does not finalize the rendering options.

2. Summary-level `condition`

Decision:

- do not add `condition` to summary definitions in the first pass
- node-level `condition` on `column`, `group`, and `dynamic` already affects which summaries materialize because summaries are attached to surviving columns

Reason:

- keeps the first redesign smaller and easier to explain
- avoids introducing another conditional surface before the core tree/context model settles
- covers the main practical need already: if a conditional column disappears, its summaries disappear with it

Follow-up only if a concrete product need appears:

- summary-level `condition` can be added later as a targeted extension

## Recommendation

Proceed with this refactor as one coherent redesign rather than a sequence of local aliases.

The main product benefit is not only better naming. It is a much clearer model:

- one schema tree vocabulary
- one global context model
- one selector vocabulary for formulas and summaries
- one simpler docs story

That clarity is worth the breaking change.
