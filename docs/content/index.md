---
seo:
  title: Typed-xlsx
  description: Feature-rich type-safe Excel reporting for TypeScript. Build schemas, sheets, tables, summaries, and formatting with a high-level API.
---

::div{class="landing-page relative"}
::div{class="landing-ambient pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-visible"}

<div class="absolute left-1/2 top-0 h-[400px] w-[70vw] max-w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500/20 blur-[110px] dark:bg-green-500/12 sm:h-[500px] lg:h-[620px]"></div>
<div class="dot-grid absolute inset-0 h-screen opacity-20"></div>

::

::div{class="mx-auto max-w-[80rem] px-4 sm:px-6 lg:px-8"}

::div{class="relative pb-12 pt-8"}
::landing-split{class="landing-two-col landing-two-col--hero relative py-10"}
:::landing-split-left{class="landing-hero-copy"}

<div class="landing-badge mb-10">Type-safe Excel reporting</div>

<h1 class="landing-hero-title mb-6">
  Feature-rich
  <br />
  <span class="text-primary">type-safe</span>
  <br />
  Excel reporting
</h1>

<p class="mb-10 max-w-xl text-lg leading-relaxed text-stone-600 dark:text-stone-400">
  <code class="rounded bg-stone-100 px-1.5 py-0.5 text-base text-stone-700 dark:bg-white/8 dark:text-stone-200">@chronicstone/typed-xlsx</code>
  helps you craft complex Excel reports with ease in TypeScript, with typed schemas, reusable
  formatting, multi-sheet workbooks, summaries, and advanced table layouts.
</p>

<div class="flex flex-wrap items-center gap-3">

::::u-button{color="primary" size="xl" to="/getting-started/introduction" trailing-icon="i-lucide-arrow-right"}
Get Started
::::

::::u-button{color="neutral" size="xl" to="https://github.com/ChronicStone/typed-xlsx" target="\_blank" variant="outline"}
View on GitHub
::::

</div>

:::

:::landing-split-right{class="landing-code-panel"}

```ts twoslash [report.ts]
import { createExcelSchema, createWorkbook } from "@chronicstone/typed-xlsx";

type User = {
  firstName: string;
  lastName: string;
  countries: string[];
};

const schema = createExcelSchema<User>()
  .column("firstName", { header: "First name", accessor: "firstName" })
  .column("lastName", { header: "Last name", accessor: "lastName" })
  .column("countries", {
    header: "Countries",
    accessor: (row) => row.countries.join(", "),
  })
  .build();

const workbook = createWorkbook();

workbook.sheet("Users").table({
  rows: [{ firstName: "Ada", lastName: "Lovelace", countries: ["UK"] }],
  schema,
});

const bytes = workbook.toUint8Array();
```

:::

::
::

::div{class="landing-section-pad py-6"}

<div class="mb-8">
  <p class="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">Core features</p>
  <h2 class="text-3xl font-bold sm:text-4xl">Explore the full surface area of the package</h2>
</div>

:::div{class="typed-xlsx-feature-grid grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"}
::::u-page-card{:spotlight="true" to="/schema-builder/create-schema" class="landing-card"}

<div class="landing-card-content">
  <span class="landing-badge">Schema</span>
  <h3>Typed accessors and reusable schemas</h3>
  <p>Define columns once with typed paths, callback accessors, transforms, defaults, and stable ids.</p>
</div>
::::

::::u-page-card{:spotlight="true" to="/schema-builder/column-groups" class="landing-card"}

<div class="landing-card-content">
  <span class="landing-badge">Dynamic columns</span>
  <h3>Context-driven groups</h3>
  <p>Expand one schema into many columns from runtime context without giving up a typed API.</p>
</div>
::::

::::u-page-card{:spotlight="true" to="/schema-builder/cell-styling" class="landing-card"}

<div class="landing-card-content">
  <span class="landing-badge">Presentation</span>
  <h3>Styling, formatting, and smart defaults</h3>
  <p>Apply number formats, header styles, wrap behavior, and fallback values with a library-owned style model.</p>
</div>
::::

::::u-page-card{:spotlight="true" to="/schema-builder/summaries" class="landing-card"}

<div class="landing-card-content">
  <span class="landing-badge">Data shaping</span>
  <h3>Transforms, summaries, and sub-rows</h3>
  <p>Derive values, expand arrays into physical sub-rows, and accumulate one or many summary rows.</p>
</div>
::::

::::u-page-card{:spotlight="true" to="/workbook-builder/sheets" class="landing-card"}

<div class="landing-card-content">
  <span class="landing-badge">Layout</span>
  <h3>Grid layouts, freeze panes, and RTL</h3>
  <p>Compose several tables on one sheet, control placement with tablesPerRow, and tune the view.</p>
</div>
::::

::::u-page-card{:spotlight="true" to="/workbook-builder/overview" class="landing-card"}

<div class="landing-card-content">
  <span class="landing-badge">Buffered builder</span>
  <h3>Simple workbook composition in memory</h3>
  <p>Use the buffered builder when your dataset fits in memory and you want the smallest API surface.</p>
</div>
::::

::::u-page-card{:spotlight="true" to="/streaming/overview" class="landing-card"}

<div class="landing-card-content">
  <span class="landing-badge">Streaming</span>
  <h3>Commit-based exports for large datasets</h3>
  <p>Commit row batches incrementally, keep memory bounded, and pipe the final workbook to files or streams.</p>
</div>
::::

::::u-page-card{:spotlight="true" to="/performance/patterns" class="landing-card"}

<div class="landing-card-content">
  <span class="landing-badge">Scale</span>
  <h3>Benchmark-backed guidance for big exports</h3>
  <p>Tune temp storage and string modes, and choose the right builder for 100k to 500k+ row workloads.</p>
</div>
::::

::::u-page-card{:spotlight="true" to="/migration/v0-to-v1" class="landing-card"}

<div class="landing-card-content">
  <span class="landing-badge">Upgrade</span>
  <h3>Migration notes for the v1 API</h3>
  <p>See how key became accessor, how summaries changed, and where to find the new builders.</p>
</div>
::::
:::
::

::div{class="landing-section-pad py-12"}

<div class="mb-8 max-w-3xl">
  <p class="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">Live example</p>
  <h2 class="mb-4 text-3xl font-bold sm:text-4xl">Explore a real financial report source side by side with the generated workbook</h2>
  <p class="text-lg leading-relaxed text-stone-600 dark:text-stone-400">
    The original landing shipped with a live example. This version keeps that idea, but inside the
    Docus experience, with the same schema, data, and file builder source available in a resizable split view.
  </p>
</div>

::typed-xlsx-example
::

::div{class="landing-section-pad pb-28 pt-8"}

:::u-page-card{:spotlight="true" class="landing-cta"}

<h2 class="mb-3 text-3xl font-bold text-stone-900 dark:text-white sm:text-4xl">
  Ready to build your first
  <br />
  typed Excel report?
</h2>
<p class="mb-8 text-base text-stone-600 dark:text-stone-400">
  Start with the benefits, install the package, then move through schema builder and file builder step by step.
</p>

<div class="flex flex-wrap justify-center gap-3">

::::u-button{color="primary" size="xl" to="/getting-started/introduction" trailing-icon="i-lucide-arrow-right"}
Open the docs
::::

::::u-button{color="neutral" size="xl" to="https://github.com/ChronicStone/typed-xlsx" target="\_blank" variant="outline"}
GitHub repository
::::

</div>
:::
::
