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
  <h2 class="text-3xl font-bold sm:text-4xl">Everything from the original typed-xlsx landing, now inside Docus</h2>
</div>

:::div{class="typed-xlsx-feature-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"}
::::u-page-card{:spotlight="true" icon="i-lucide-file-type-2" title="Type-safe Schema Builder" description="Construct type-safe spreadsheet schemas with TypeScript."}
::::

::::u-page-card{:spotlight="true" icon="i-lucide-palette" title="Dynamic Cell Styling / Formatting" description="Tailor cell styles and formats dynamically with advanced per-row customization."}
::::

::::u-page-card{:spotlight="true" icon="i-lucide-files" title="Multi-sheet Support" description="Manage complex datasets with support for multiple sheets in one workbook."}
::::

::::u-page-card{:spotlight="true" icon="i-lucide-layout-list" title="Advanced Row Structures" description="Support sub-rows, merged layouts, and sophisticated table compositions."}
::::

::::u-page-card{:spotlight="true" icon="i-lucide-refresh-cw" title="Complex Data Serialization" description="Serialize arrays, booleans, and custom values in a fully type-safe way."}
::::

::::u-page-card{:spotlight="true" icon="i-lucide-target" title="Default Value Management" description="Apply simple fallback and default value strategies directly in your schema."}
::::

::::u-page-card{:spotlight="true" icon="i-lucide-table-properties" title="Multiple Tables Per Sheet" description="Compose several tables on one sheet with linear or grid-style placement."}
::::

::::u-page-card{:spotlight="true" icon="i-lucide-columns-3" title="Dynamic Column Mapping" description="Generate columns from typed context while keeping report definitions safe."}
::::

::::u-page-card{:spotlight="true" icon="i-lucide-calculator" title="Column Summaries" description="Automatically calculate summaries to make reports easier to read at a glance."}
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

::::u-button{color="primary" size="xl" to="/getting-started/key-benefits-and-why" trailing-icon="i-lucide-arrow-right"}
Open the docs
::::

::::u-button{color="neutral" size="xl" to="https://github.com/ChronicStone/typed-xlsx" target="\_blank" variant="outline"}
GitHub repository
::::

</div>
:::
::
