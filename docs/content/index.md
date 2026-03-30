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

<div class="landing-badge mb-8">Type-safe Excel reporting</div>

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

::::u-button{color="primary" size="xl" to="/getting-started/key-benefits-and-why" trailing-icon="i-lucide-arrow-right"}
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

::div{class="landing-section-pad py-12"}

<div class="mb-8">
  <p class="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">Core features</p>
  <h2 class="text-3xl font-bold sm:text-4xl">Explore the full surface area of the package</h2>
</div>

:::div{class="typed-xlsx-feature-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"}
<a class="landing-card" href="/schema-builder/create-schema">

  <div class="landing-badge">Schema</div>
  <h3>Type-safe accessors and reusable schema definitions</h3>
  <p>Build spreadsheet schemas once, then reuse them across exports with typed dot paths, callback accessors, transforms, defaults, and stable column ids.</p>
</a>

<a class="landing-card" href="/schema-builder/groups">
  <div class="landing-badge">Dynamic columns</div>
  <h3>Context-driven groups and generated columns</h3>
  <p>Expand one schema into many columns from runtime context, keep grouped report definitions organized, and generate wide exports without giving up type safety.</p>
</a>

<a class="landing-card" href="/schema-builder/cell-styling">
  <div class="landing-badge">Presentation</div>
  <h3>Cell styling, formatting, and defaults owned by the library</h3>
  <p>Apply number formats, header styles, conditional styling, wrap behavior, and fallback values with a package-owned style model instead of backend-specific shapes.</p>
</a>

<a class="landing-card" href="/schema-builder/columns">
  <div class="landing-badge">Data shaping</div>
  <h3>Summaries, transforms, arrays, and sub-row expansion</h3>
  <p>Derive values from the row, expand arrays into physical sub-rows, and accumulate one or many summary rows with reducer-based logic that works in both builders.</p>
</a>

<a class="landing-card" href="/file-builder/define-sheets">
  <div class="landing-badge">Layout</div>
  <h3>Multi-table sheets, grid layouts, freeze panes, and RTL</h3>
  <p>Compose several tables on one worksheet, control placement with <code>tablesPerRow</code>, and add sheet-level view options like frozen headers and right-to-left rendering.</p>
</a>

<a class="landing-card" href="/file-builder/build-excel-file">
  <div class="landing-badge">Buffered builder</div>
  <h3>High-level workbook composition for normal-size exports</h3>
  <p>Use the buffered builder when your dataset fits in memory and you want the simplest API for creating sheets, adding tables, and writing a finished XLSX file.</p>
</a>

<a class="landing-card" href="/stream-workbook/overview">
  <div class="landing-badge">Streaming</div>
  <h3>Real streaming workbooks with commit-based ingestion</h3>
  <p>Commit row batches incrementally, keep memory bounded, and pipe the final workbook to files, Node streams, Web streams, or remote destinations like S3.</p>
</a>

<a class="landing-card" href="/performance/large-datasets">
  <div class="landing-badge">Scale</div>
  <h3>Performance tooling for 100k to 500k+ row workloads</h3>
  <p>Choose between buffered and stream builders deliberately, tune temp storage and string modes, and follow the benchmark-backed guidance for very large exports.</p>
</a>

<a class="landing-card" href="/migration/v0-to-v1">
  <div class="landing-badge">Upgrade</div>
  <h3>Migration guidance and reference for the new v1 surface</h3>
  <p>See how <code>key</code> became <code>accessor</code>, how summaries changed, what the new builders look like, and where to find the full API details.</p>
</a>
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

::::u-button{color="primary" size="xl" to="/getting-started/key-benefits-and-why" trailing-icon="i-lucide-arrow-right"}
Open the docs
::::

::::u-button{color="neutral" size="xl" to="https://github.com/ChronicStone/typed-xlsx" target="\_blank" variant="outline"}
GitHub repository
::::

</div>
:::
::
