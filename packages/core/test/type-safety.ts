/**
 * Type-level safety tests for typed-xlsx.
 *
 * Not a runtime test file — these assertions are verified by `tsc --noEmit`
 * via `bun run typecheck`. Each `@ts-expect-error` directive must suppress
 * exactly one compiler error; tsc will report an error if the line it
 * annotates compiles cleanly (meaning a regression fixed the error).
 */

import type {
  BadgeVariantLabelContext,
  ImageUrlValue,
  ImageValue,
  Path,
  SchemaColumnId,
  SchemaColumnValues,
  SchemaGroupContext,
} from "../src";
import {
  createExcelSchema,
  createWorkbook,
  createWorkbookStream,
  defineSpreadsheetTheme,
  spreadsheetThemes,
} from "../src";

// ── Path<T> ──────────────────────────────────────────────────────────────────

type FlatRow = { name: string; age: number };
type NestedRow = { user: { name: string; address: { city: string } } };

// valid paths
const _validFlat1: Path<FlatRow> = "name";
const _validFlat2: Path<FlatRow> = "age";
const _validNested1: Path<NestedRow> = "user";
const _validNested2: Path<NestedRow> = "user.name";
const _validNested3: Path<NestedRow> = "user.address.city";

// invalid paths are rejected
// @ts-expect-error — "invalid" is not in Path<FlatRow>
const _badFlat: Path<FlatRow> = "invalid";
// @ts-expect-error — "user.nonexistent" is not in Path<NestedRow>
const _badNested: Path<NestedRow> = "user.nonexistent";

// ── accessor: valid string paths compile ─────────────────────────────────────

createExcelSchema<FlatRow>().column("name", { accessor: "name" }).build();
createExcelSchema<FlatRow>().column("age", { accessor: "age" }).build();
createExcelSchema<NestedRow>().column("city", { accessor: "user.address.city" }).build();

// accessor: function accessor compiles
createExcelSchema<FlatRow>()
  .column("full", { accessor: (row) => `${row.name} ${row.age}` })
  .build();

// accessor: invalid string is rejected directly at the accessor property
createExcelSchema<FlatRow>().column("x", {
  // @ts-expect-error — "invalid" is not assignable to Path<FlatRow> = "name" | "age"
  accessor: "invalid",
});

// accessor: another invalid path example (nested miss)
createExcelSchema<NestedRow>().column("x", {
  // @ts-expect-error — "user.missing" is not a valid path on NestedRow
  accessor: "user.missing",
});

// ── transform: value type is inferred from the accessor ──────────────────────

// string path → value is the field type
createExcelSchema<FlatRow>()
  .column("age", {
    accessor: "age",
    // value is inferred as number — no annotation needed
    transform: ({ value }) => value.toFixed(0),
  })
  .build();

// callback accessor → value matches callback return type
createExcelSchema<FlatRow>()
  .column("derived", {
    accessor: (row) => row.age * 2,
    // value is inferred as number
    transform: ({ value }) => `${value.toFixed(0)} years`,
  })
  .build();

// ── formula columns: predecessor refs are typed ───────────────────────────────

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("doubleAge", {
    formula: ({ refs }) => refs.column("age").mul(2),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("status", {
    formula: ({ refs, fx }) => fx.if(refs.column("age").gte(18), "adult", "minor"),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("remaining", {
    formula: ({ refs, fx }) => fx.literal(100).sub(refs.column("age")),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("quota", { accessor: "age" })
  .column("attainment", {
    formula: ({ refs, fx }) => fx.safeDiv(refs.column("quota"), 100, 0),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("quota", { accessor: "age" })
  .column("attainment", {
    formula: ({ refs, fx }) =>
      fx.safeDiv(refs.column("quota"), 100, { fallback: 0, when: refs.column("quota").gt(0) }),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("quota", { accessor: "age" })
  .column("attainment", {
    formula: ({ refs, fx }) =>
      fx.safeDiv(refs.column("quota"), 100, {
        fallback: 0,
        when: ({ denominator }) => denominator.gt(0),
      }),
  })
  .build();

createExcelSchema<{ lines: number[] }>()
  .column("line", { accessor: (row) => row.lines })
  .column("lineAverage", {
    formula: ({ row }) => row.series("line").average(),
    expansion: "single",
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("remaining", {
    formula: ({ refs, fx: _fx }) =>
      // @ts-expect-error literals are provided by fx, not refs
      refs.literal(100).sub(refs.column("age")),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("bucket", {
    formula: ({ refs, fx }) =>
      fx.if(refs.column("age").gt(65).or(refs.column("age").lt(18)), "edge", "core"),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("doubleAge", {
    formula: ({ refs }) => {
      const age = refs.column("age");
      return age.add(age.toExpr());
    },
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("doubleAge", {
    formula: ({ refs }) =>
      // @ts-expect-error formula columns can only reference previously declared column ids
      refs.column("future"),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .group("derived", (b) => {
    b.column("doubleAge", {
      formula: ({ refs }) => refs.column("age").mul(2),
    }).column("quadAge", {
      formula: ({ refs }) => refs.column("doubleAge").mul(refs.column("age")),
    });
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .group("derived", (b) => {
    b.column("doubleAge", {
      formula: ({ refs }) =>
        // @ts-expect-error group formulas cannot reference future group column ids
        refs.column("quadAge"),
    }).column("quadAge", {
      formula: ({ refs }) => refs.column("doubleAge").mul(2),
    });
  })
  .build();

createExcelSchema<FlatRow>({ mode: "excel-table" })
  .column("age", { accessor: "age" })
  .group("derived", (b) => {
    b.column("doubleAge", {
      formula: ({ refs }) => refs.column("age").mul(2),
    }).column("tripleAge", {
      formula: ({ refs }) => refs.column("doubleAge").add(refs.column("age")),
    });
  })
  .build();

createExcelSchema<FlatRow>()
  .group("ages", (b) => {
    b.column("constant", { accessor: () => 1 });
  })
  .column("age", { accessor: "age" })
  .column("totalAges", {
    formula: ({ refs, fx }) => fx.sum(refs.group("ages")),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("totalAges", {
    formula: ({ refs, fx }) =>
      // @ts-expect-error formulas can only reference previously declared group ids
      fx.sum(refs.group("ages")),
  })
  .group("ages", (b) => {
    b.column("constant", { accessor: () => 1 });
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .group("derived", (b) => {
    b.column("doubleAge", { formula: ({ refs }) => refs.column("age").mul(2) });
  })
  .column("derivedTotal", {
    formula: ({ refs, fx }) => fx.sum(refs.group("derived")),
  })
  .build();

createExcelSchema<FlatRow>({ mode: "excel-table" })
  .column("age", { accessor: "age" })
  .group("derived", (b) => {
    b.column("doubleAge", { formula: ({ refs }) => refs.column("age").mul(2) });
  })
  .column("derivedAverage", {
    formula: ({ refs, fx }) => fx.average(refs.group("derived")),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("totalAges", {
    formula: ({ refs, fx }) =>
      // @ts-expect-error unknown group ids are rejected
      fx.sum(refs.group("missing")),
  })
  .build();

// ── sparkline columns: source refs are typed like formula refs ───────────────

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("trend", {
    type: "sparkline",
    source: ["age"],
    style: {
      line: { color: "#2563EB", weight: 1.25 },
      dots: false,
      high: { color: "#22C55E" },
      low: { visible: true, color: "#EF4444" },
      axis: {
        visible: true,
        color: "#64748B",
        min: { value: 0 },
        max: "group",
      },
    },
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("trend", {
    type: "sparkline",
    // @ts-expect-error sparkline sources can only target previously declared column ids
    source: ["future"],
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("trend", {
    type: "sparkline",
    // @ts-expect-error sparkline sources cannot target the current column id
    source: ["trend"],
  })
  .build();

createExcelSchema<FlatRow>()
  .group("ages", (b) => {
    b.column("age", { accessor: "age" });
  })
  .column("trend", {
    type: "sparkline",
    source: { group: "ages" },
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("trend", {
    type: "sparkline",
    // @ts-expect-error sparkline group sources must reference declared groups
    source: { group: "ages" },
  })
  .build();

createExcelSchema<FlatRow, { months: string[] }>()
  .dynamic("months", (b, { ctx }) => {
    ctx.months.forEach((month) => {
      b.column(month, { accessor: "age" });
    });
  })
  .column("trend", {
    type: "sparkline",
    source: { dynamic: "months" },
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("trend", {
    type: "sparkline",
    source: ["age"],
    sparklineType: "line",
    style: {
      high: { color: "#22C55E" },
    },
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("trend", {
    type: "sparkline",
    // @ts-expect-error renderer sparkline sources can only target previously declared column ids
    source: ["future"],
  })
  .build();

createExcelSchema<{ name: string; thumbnail?: Uint8Array }>()
  .column("photo", {
    type: "image",
    accessor: "thumbnail",
    alt: "name",
    size: { width: 64, height: 64 },
  })
  .build();

createExcelSchema<{ name: string; thumbnail?: ImageValue }>()
  .column("photo", {
    type: "image",
    accessor: (row) => row.thumbnail,
    alt: (context: { name: string }) => context.name,
  })
  .build();

createExcelSchema<{ name: string; thumbnailUrl?: string }>()
  .column("photo", {
    type: "image",
    source: "url",
    accessor: "thumbnailUrl",
    alt: "name",
    size: { width: 64, height: 64 },
  })
  .build();

createExcelSchema<{ name: string; thumbnail?: ImageUrlValue }>()
  .column("photo", {
    type: "image",
    source: "url",
    accessor: (row) => row.thumbnail,
    alt: (context: { name: string }) => context.name,
  })
  .build();

createExcelSchema<{ thumbnailUrl?: string }>().column("photo", {
  type: "image",
  source: "url",
  accessor: "thumbnailUrl",
  // @ts-expect-error url image columns do not take embedded media types
  mediaType: "image/png",
});

createExcelSchema<{ thumbnail?: Uint8Array }>().column("photo", {
  type: "image",
  accessor: "thumbnail",
  // @ts-expect-error image renderer columns cannot also be formula columns
  formula: ({ refs }: any) => refs.column("photo"),
});

createExcelSchema<FlatRow>()
  .column("portal", {
    type: "hyperlink",
    accessor: "name",
    target: (context: { name: string }) => `https://example.com/${context.name}`,
  })
  .build();

createExcelSchema<{ approved: boolean; status: "active" | "blocked" }>()
  .column("status", {
    type: "badge",
    accessor: "status",
    variants: {
      active: {
        label: "Active",
        style: { fill: { color: { rgb: "DCFCE7" } } },
      },
      blocked: {
        style: { fill: { color: { rgb: "FEE2E2" } } },
      },
    },
  })
  .column("approved", {
    type: "checkbox",
    accessor: "approved",
  })
  .build();

createExcelSchema<{ status: "active" | "blocked" | "pending" }>()
  .column("status", {
    type: "badge",
    accessor: "status",
    variants: {
      active: { label: "Active" },
      blocked: { label: "Blocked" },
      pending: { label: "Pending" },
    },
  })
  .build();

type BadgeI18nRow = { account: string; status: "active" | "blocked" };
type BadgeI18nContext = {
  t: (value: BadgeI18nRow["status"], account: string) => string;
};
type BadgeI18nLabelContext = BadgeVariantLabelContext<
  BadgeI18nRow,
  BadgeI18nRow["status"],
  BadgeI18nContext
>;

createExcelSchema<BadgeI18nRow, BadgeI18nContext>()
  .column("status", {
    type: "badge",
    accessor: "status",
    variants: {
      active: {
        label: ({ ctx, row, value }: BadgeI18nLabelContext) => ctx.t(value, row.account),
      },
      blocked: {
        label: ({ ctx, row, value }: BadgeI18nLabelContext) => ctx.t(value, row.account),
      },
    },
  })
  .build();

createExcelSchema<{ status: "active" | "blocked" | "pending" }>()
  .column("status", {
    type: "badge",
    accessor: "status",
    variants: {
      active: { label: "Active" },
    },
    defaultVariant: { label: "Other" },
  })
  .build();

createExcelSchema<{ status: "active" | "blocked" | "pending" }>()
  // @ts-expect-error badge variants must cover every literal value when no defaultVariant is provided
  .column("status", {
    type: "badge",
    accessor: "status",
    variants: {
      active: { label: "Active" },
      blocked: { label: "Blocked" },
    },
  })
  .build();

createExcelSchema<{ status: "active" | "blocked" }>()
  .column("status", {
    type: "badge",
    accessor: "status",
    variants: {
      active: { label: "Active" },
      blocked: { label: "Blocked" },
      // @ts-expect-error badge variant keys must match the accessor literal values
      archived: { label: "Archived" },
    },
  })
  .build();

createExcelSchema<{ status: "active" | "blocked" }>()
  .column("status", {
    type: "badge",
    accessor: "status",
    variants: {
      active: { label: "Active" },
      // @ts-expect-error defaultVariant allows partial variants, but not unknown variant keys
      archived: { label: "Archived" },
    },
    defaultVariant: { label: "Other" },
  })
  .build();

createExcelSchema<{ checks: boolean[] }>()
  .column("checks", {
    type: "checkbox",
    accessor: "checks",
  })
  .build();

createExcelSchema<{ approved: boolean }>()
  .column("approved", {
    type: "checkbox",
    accessor: "approved",
  })
  .column("state", {
    formula: ({ refs, fx }) => fx.if(refs.column("approved").eq(true), "approved", "blocked"),
  })
  .build();

createExcelSchema<{ approved: boolean }>()
  .column("approved", {
    type: "checkbox",
    accessor: "approved",
  })
  .column("state", {
    formula: ({ refs, fx }) =>
      fx.if(
        // @ts-expect-error checkbox references compare against booleans, not numeric sentinels
        refs.column("approved").eq(1),
        "approved",
        "blocked",
      ),
  })
  .build();

createExcelSchema<{ approved: boolean }>().column("approved", {
  type: "checkbox",
  accessor: "approved",
  // @ts-expect-error checkbox renderer columns cannot also be formula columns
  formula: ({ refs }: any) => refs.column("approved"),
});

createExcelSchema<{ approved: boolean }>().column("approved", {
  type: "checkbox",
  accessor: "approved",
  // @ts-expect-error checkbox renderer columns do not take number formats
  format: "0",
});

// ── conditionalStyle: mirrors formula ref/group typing plus row paths ─────────

createExcelSchema<{
  amount: number;
  status: "open" | "won";
}>()
  .column("amount", {
    accessor: "amount",
    conditionalStyle: (conditional) =>
      conditional.when(({ refs }) => refs.column("amount").gt(0), {
        font: { bold: true },
      }),
  })
  .column("quota", {
    accessor: () => 42,
    conditionalStyle: (conditional) =>
      conditional
        .when(({ refs }) => refs.column("quota").gt(0), {
          fill: { color: { rgb: "DCFCE7" } },
        })
        .when(({ refs, fx }) => fx.and(refs.column("amount").gt(0), refs.column("quota").gt(0)), {
          font: { bold: true },
        }),
  })
  .group("performance", (b) => {
    b.column("status", {
      accessor: "status",
    });
  })
  .column("statusSummary", {
    formula: ({ refs, fx }) => fx.count(refs.group("performance")),
    conditionalStyle: (conditional) =>
      conditional.when(({ refs, fx }) => fx.count(refs.group("performance")).gte(1), {
        font: { italic: true },
      }),
  })
  .build();

createExcelSchema<{
  amount: number;
  status: "open" | "won";
}>()
  .column("amount", { accessor: "amount" })
  .column("status", {
    accessor: "status",
    conditionalStyle: (conditional) =>
      conditional.when(({ refs }) => refs.column("status").eq("won"), {
        font: { bold: true },
      }),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("doubleAge", {
    formula: ({ refs }) => refs.column("age").mul(2),
    conditionalStyle: (conditional) =>
      conditional.when(({ refs }) => refs.column("age").gt(18), {
        font: { bold: true },
      }),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("doubleAge", {
    formula: ({ refs }) => refs.column("age").mul(2),
    conditionalStyle: (conditional) =>
      conditional.when(
        ({ refs }) =>
          // @ts-expect-error conditionalStyle refs can only target current, previous, or row-path references
          refs.column("future").gt(0),
        {
          font: { bold: true },
        },
      ),
  })
  .build();

createExcelSchema<{ amount: number; metrics: { quota: number } }>()
  .column("amount", {
    accessor: "amount",
    conditionalStyle: (conditional) =>
      conditional.when(
        ({ refs }) =>
          // @ts-expect-error selector refs only accept declared column ids, not accessor paths
          refs.column("metrics.missing").gt(0),
        {
          font: { bold: true },
        },
      ),
  })
  .build();

createExcelSchema<{ amount: number; metrics: { quota: number } }>()
  .column("amount", { accessor: "amount" })
  .column("quota", { accessor: "metrics.quota" })
  .column("guard", {
    accessor: () => "ok",
    conditionalStyle: (conditional) =>
      conditional.when(
        ({ refs }) =>
          // @ts-expect-error selector refs only accept declared column ids, not accessor paths
          refs.column("metrics.quota").gt(0),
        {
          font: { bold: true },
        },
      ),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("guard", {
    accessor: () => "ok",
    conditionalStyle: (conditional) =>
      conditional.when(
        ({ refs, fx }) =>
          // @ts-expect-error unknown group ids are rejected in conditionalStyle refs
          fx.sum(refs.group("missing")).gt(0),
        {
          font: { bold: true },
        },
      ),
  })
  .build();

// ── SchemaColumnId: union grows with each .column() call ─────────────────────

const basicSchema = createExcelSchema<FlatRow>()
  .column("name", { accessor: "name" })
  .column("age", { accessor: "age" })
  .build();

const _cid1: SchemaColumnId<typeof basicSchema> = "name";
const _cid2: SchemaColumnId<typeof basicSchema> = "age";
// @ts-expect-error — "unknown" was never declared as a column id
const _cid3: SchemaColumnId<typeof basicSchema> = "unknown";

// ── selection: only declared IDs are accepted ────────────────────────────────

// valid include / exclude
createWorkbook()
  .sheet("S")
  .table("basic-include", { rows: [], schema: basicSchema, select: { include: ["name"] } });
createWorkbook()
  .sheet("S")
  .table("basic-exclude", { rows: [], schema: basicSchema, select: { exclude: ["age"] } });

// undeclared column id in include
createWorkbook()
  .sheet("S")
  .table("basic-invalid-include", {
    rows: [],
    schema: basicSchema,
    select: {
      // @ts-expect-error — "nonExistent" is not a declared column id
      include: ["nonExistent"],
    },
  });

// undeclared column id in exclude
createWorkbook()
  .sheet("S")
  .table("basic-invalid-exclude", {
    rows: [],
    schema: basicSchema,
    select: {
      // @ts-expect-error — "ghost" is not a declared column id
      exclude: ["ghost"],
    },
  });

createExcelSchema<{ amounts: number[] }>()
  .column("amount", {
    accessor: (row) => row.amounts,
    summary: (summary) => [
      summary.formula(({ column }) => column.rows().sum((row) => row.cells().average())),
    ],
  })
  .build();

// ── rows: array must match the schema's row type ──────────────────────────────

// valid rows compile
createWorkbook()
  .sheet("S")
  .table("basic-rows", { rows: [{ name: "Ada", age: 42 }], schema: basicSchema });

createWorkbook()
  .sheet("S")
  .table("basic-defaults", {
    rows: [{ name: "Ada", age: 42 }],
    schema: basicSchema,
    defaults: {
      header: { preset: "header.accent" },
      cells: {
        locked: { preset: "cell.locked" },
        unlocked: { style: { protection: { locked: false } } },
      },
    },
  });

// extra property in row is rejected (excess property check)
createWorkbook()
  .sheet("S")
  .table("basic-extra-row-field", {
    // @ts-expect-error — unknownField does not exist on FlatRow
    rows: [{ name: "Ada", age: 42, unknownField: true }],
    schema: basicSchema,
  });

// ── groups: context is required when groups exist ────────────────────────────

type GroupRow = { name: string; orgs: number[] };

const groupSchema = createExcelSchema<GroupRow, { orgIds: number[] }>()
  .column("name", { accessor: "name" })
  .dynamic("orgIds", (b, { ctx }) => {
    for (const id of ctx.orgIds) {
      b.column(`org-${id}`, { accessor: (r) => r.orgs.includes(id) });
    }
  })
  .build();

// context required — omitting it errors
createWorkbook()
  .sheet("S")
  // @ts-expect-error — context is required when the schema contains groups
  .table("group-missing-context", { rows: [], schema: groupSchema });

// context with wrong value type errors
createWorkbook()
  .sheet("S")
  .table("group-bad-context", {
    rows: [],
    schema: groupSchema,
    // @ts-expect-error — orgIds must be number[], not string
    context: { orgIds: "should-be-array" },
  });

// correct context compiles
createWorkbook()
  .sheet("S")
  .table("group-context", { rows: [], schema: groupSchema, context: { orgIds: [1, 2, 3] } });

// context stays required for any contextful schema, regardless of selection
createWorkbook()
  .sheet("S")
  // @ts-expect-error — schema-level context is required even when a dynamic scope is excluded
  .table("group-excluded", { rows: [], schema: groupSchema, select: { exclude: ["orgIds"] } });

createWorkbook()
  .sheet("S")
  .table("group-excluded-with-context", {
    rows: [],
    schema: groupSchema,
    select: { exclude: ["orgIds"] },
    context: { orgIds: [1, 2, 3] },
  });

type TextContext = {
  t(key: string): string;
};

const contextTextSchema = createExcelSchema<FlatRow, TextContext>({ mode: "excel-table" })
  .column("name", {
    accessor: "name",
    header: ({ ctx }) => ctx.t("columns.name"),
    totalsRow: { label: ({ ctx }) => ctx.t("totals.label") },
    validation: (v) =>
      v.textLength().error({
        title: ({ ctx }) => ctx.t("validation.title"),
        message: ({ ctx }) => ctx.t("validation.message"),
      }),
    hyperlink: ({ row }) => ({
      target: `https://example.com/${row.name}`,
      tooltip: ({ ctx }) => ctx.t("links.open"),
    }),
  })
  .build();

createWorkbook()
  .sheet("S")
  .table("context-text", {
    context: { t: (key) => key },
    rows: [],
    schema: contextTextSchema,
    title: ({ ctx }) => ctx.t("reports.title"),
  });

createExcelSchema<FlatRow, TextContext>().column("invalid-context-text", {
  accessor: "name",
  // @ts-expect-error — lazy schema text receives the declared schema context
  header: ({ ctx }) => ctx.missing("columns.name"),
});

// ── SchemaGroupContext: shape matches the group generic ──────────────────────

type GroupCtx = SchemaGroupContext<typeof groupSchema>;

const _gc1: GroupCtx = { orgIds: [1, 2, 3] };
// @ts-expect-error — string is not assignable to number[]
const _gc2: GroupCtx = { orgIds: "bad" };

const excelTableGroupSchema = createExcelSchema<GroupRow, { orgIds: number[] }>({
  mode: "excel-table",
})
  .column("name", { accessor: "name" })
  .dynamic("orgIds", (b, { ctx }) => {
    for (const id of ctx.orgIds) {
      b.column(`org-${id}`, { accessor: (r) => r.orgs.includes(id) });
    }
  })
  .build();

createWorkbook()
  .sheet("S")
  .table("excel-group-context", {
    rows: [],
    schema: excelTableGroupSchema,
    context: { orgIds: [1, 2, 3] },
  });

createWorkbook()
  .sheet("S")
  // @ts-expect-error — context is required when the excel-table schema group is selected
  .table("excel-group-missing-context", { rows: [], schema: excelTableGroupSchema });

type GroupItem = { id: number; name: string };
type DetailedGroupRow = {
  name: string;
  orgs: GroupItem[];
  tags: string[];
};

const detailedGroupSchema = createExcelSchema<
  DetailedGroupRow,
  {
    orgs: GroupItem[];
    tags: string[];
  }
>()
  .column("name", { accessor: "name" })
  .dynamic("orgs", (b, { ctx }) => {
    for (const item of ctx.orgs) {
      b.column(`org-${item.id}`, {
        header: item.name,
        accessor: (row) => (row.orgs.some((org) => org.id === item.id) ? "Yes" : "No"),
      });
    }
  })
  .dynamic("tags", (b, { ctx }) => {
    for (const tag of ctx.tags) {
      b.column(`tag-${tag}`, { accessor: (row) => (row.tags.includes(tag) ? "Yes" : "No") });
    }
  })
  .group("derived", (b) => {
    b.column("tagCount", { accessor: (row) => row.tags.length });
  })
  .build();

createExcelSchema<DetailedGroupRow>()
  .column("name", { accessor: "name" })
  // @ts-expect-error — passing a single generic argument to dynamic is not supported; type the schema context instead
  .dynamic<GroupItem[]>("orgs", () => {});

type DetailedGroupCtx = SchemaGroupContext<typeof detailedGroupSchema>;

const _dgc1: DetailedGroupCtx = {
  orgs: [{ id: 1, name: "Acme" }],
  tags: ["vip"],
};
const _dgc2: DetailedGroupCtx["orgs"] = [{ id: 1, name: "Acme" }];
const _dgc3: keyof DetailedGroupCtx = "orgs";
// @ts-expect-error — DetailedGroupCtx only exposes declared group ids
const _dgc4: keyof DetailedGroupCtx = "unknown";
// @ts-expect-error — orgs must be GroupItem[]
const _dgc5: DetailedGroupCtx = { orgs: [1], tags: ["vip"] };
// @ts-expect-error — structural groups without runtime context should not appear in the context shape
const _dgc6: keyof DetailedGroupCtx = "derived";

createWorkbook()
  .sheet("S")
  // @ts-expect-error — schema-level context is required even when selecting only top-level columns
  .table("detailed-name", { rows: [], schema: detailedGroupSchema, select: { include: ["name"] } });

createWorkbook()
  .sheet("S")
  .table("detailed-name-with-context", {
    rows: [],
    schema: detailedGroupSchema,
    select: { include: ["name"] },
    context: { orgs: [{ id: 1, name: "Acme" }], tags: [] },
  });

createWorkbook()
  .sheet("S")
  // @ts-expect-error — schema-level context is required even when only structural selections are used
  .table("detailed-derived", {
    rows: [],
    schema: detailedGroupSchema,
    select: { include: ["derived"] },
  });

createWorkbook()
  .sheet("S")
  .table("detailed-derived-with-context", {
    rows: [],
    schema: detailedGroupSchema,
    select: { include: ["derived"] },
    context: { orgs: [{ id: 1, name: "Acme" }], tags: [] },
  });

createWorkbook()
  .sheet("S")
  // @ts-expect-error — context is required when selecting the orgs group
  .table("detailed-missing-orgs-context", {
    rows: [],
    schema: detailedGroupSchema,
    select: { include: ["orgs"] },
  });

createWorkbook()
  .sheet("S")
  .table("detailed-orgs-context", {
    rows: [],
    schema: detailedGroupSchema,
    select: { include: ["orgs"] },
    context: { orgs: [{ id: 1, name: "Acme" }], tags: [] },
  });

createWorkbook()
  .sheet("S")
  .table("detailed-extra-context", {
    rows: [],
    schema: detailedGroupSchema,
    select: { include: ["orgs"] },
    context: { orgs: [{ id: 1, name: "Acme" }], tags: ["vip"] },
  });

createWorkbook()
  .sheet("S")
  // @ts-expect-error — excluding tags still leaves orgs selected, so context is required
  .table("detailed-missing-context-after-exclude", {
    rows: [],
    schema: detailedGroupSchema,
    select: { exclude: ["tags"] },
  });

createWorkbook()
  .sheet("S")
  .table("detailed-exclude-tags", {
    rows: [],
    schema: detailedGroupSchema,
    select: { exclude: ["tags"] },
    context: { orgs: [{ id: 1, name: "Acme" }], tags: [] },
  });

createWorkbook()
  .sheet("S")
  // @ts-expect-error — excluding all dynamic scopes does not remove the schema-level context requirement
  .table("detailed-exclude-all-context-groups", {
    rows: [],
    schema: detailedGroupSchema,
    select: { exclude: ["orgs", "tags"] },
  });

createWorkbook()
  .sheet("S")
  .table("detailed-exclude-all-context-groups-with-context", {
    rows: [],
    schema: detailedGroupSchema,
    select: { exclude: ["orgs", "tags"] },
    context: { orgs: [{ id: 1, name: "Acme" }], tags: [] },
  });

createWorkbook()
  .sheet("S")
  .table("detailed-include-exclude", {
    rows: [],
    schema: detailedGroupSchema,
    select: { include: ["orgs", "tags"], exclude: ["tags"] },
    context: { orgs: [{ id: 1, name: "Acme" }], tags: [] },
  });

createWorkbook()
  .sheet("S")
  // @ts-expect-error — schema-level context is required for all tables built from a contextful schema
  .table("detailed-derived-name", {
    rows: [],
    schema: detailedGroupSchema,
    select: { include: ["derived", "name"] },
  });

createWorkbook()
  .sheet("S")
  .table("detailed-derived-name-with-context", {
    rows: [],
    schema: detailedGroupSchema,
    select: { include: ["derived", "name"] },
    context: { orgs: [{ id: 1, name: "Acme" }], tags: [] },
  });

// ── SchemaColumnValues: the value type of each column ─────────────────────

type ValueRow = { month: string; revenue: number; cost: number | null };
const valueSchema = createExcelSchema<ValueRow>()
  .column("month", { accessor: "month" })
  .column("revenue", { accessor: "revenue" })
  .column("cost", { accessor: "cost" })
  .column("label", { accessor: "revenue", transform: ({ value }) => `${value} €` })
  .column("margin", { formula: ({ refs }) => refs.column("revenue").sub(refs.column("cost")) })
  .build();

type Values = SchemaColumnValues<typeof valueSchema>;
const _valueMonth: Values["month"] = "Jan";
const _valueRevenue: Values["revenue"] = 1;
const _valueCost: Values["cost"] = null;
const _valueLabel: Values["label"] = "12 €";
const _valueMargin: Values["margin"] = 1;
// @ts-expect-error - a transformed column keeps the transform's type
const _valueLabelNumber: Values["label"] = 1;
// @ts-expect-error - only declared columns have a value type
const _valueUnknown: Values["unknown"] = 1;

// ── Workbook charts ─────────────────────────────────────────────────────────

type ChartMonthRow = { month: string; day: Date; revenue: number; cost: number | null };
type ChartTargetRow = { month: string; target: number };
type ChartTerritoryRow = { territory: string; byMonth: Record<string, number> };

const chartMonthlySchema = createExcelSchema<ChartMonthRow>()
  .column("month", { accessor: "month" })
  .column("day", { accessor: "day" })
  .column("revenue", { accessor: "revenue" })
  .column("cost", { accessor: "cost" })
  .column("label", { accessor: "revenue", transform: ({ value }) => `${value} €` })
  .column("margin", { formula: ({ refs }) => refs.column("revenue").sub(refs.column("cost")) })
  .build();
const chartTargetSchema = createExcelSchema<ChartTargetRow>()
  .column("month", { accessor: "month" })
  .column("target", { accessor: "target" })
  .build();
const chartTerritorySchema = createExcelSchema<ChartTerritoryRow, { months: string[] }>()
  .column("territory", { accessor: "territory" })
  .dynamic("months", (builder, { ctx }) => {
    for (const month of ctx.months) {
      builder.column(month, { accessor: (row) => row.byMonth[month] ?? 0 });
    }
  })
  .build();

// valid: every mark kind, cross-table and cross-sheet marks, dynamic blocks, secondary axis
createWorkbook()
  .sheet("2026")
  .table("sales", { schema: chartMonthlySchema, rows: [] })
  .table("targets", { schema: chartTargetSchema, rows: [] })
  .chart("combo", ({ refs }) => ({
    title: "Revenue vs target",
    marks: [
      refs.table("sales").bar({ x: "month", y: ["revenue", { column: "cost", name: "Costs" }] }),
      refs.table("targets").line({ x: "month", y: "target", name: "Target", dashed: true }),
      refs.table("sales").line({ x: "month", y: "margin", axis: "y2" }),
    ],
    axes: { y: { min: 0 }, y2: { format: "#,##0" } },
  }))
  .chart("share", ({ refs }) => ({
    marks: [
      refs.table("sales").pie({ label: "month", value: "revenue", labels: { percent: true } }),
    ],
  }))
  .chart("timeline", ({ refs }) => ({
    marks: [refs.table("sales").area({ x: "day", y: ["revenue", "margin"], stack: "percent" })],
  }))
  .chart("scatter", ({ refs }) => ({
    marks: [refs.table("sales").scatter({ x: "revenue", y: "margin" })],
  }))
  .sheet("Territories")
  .table("territories", { schema: chartTerritorySchema, rows: [], context: { months: [] } })
  .chart("rows", ({ refs }) => ({
    marks: [refs.table("territories").line({ x: { dynamic: "months" }, series: "territory" })],
  }))
  .chart("columns", ({ refs }) => ({
    marks: [
      refs.table("territories").bar({ x: "territory", y: { dynamic: "months" }, stack: true }),
    ],
  }))
  .sheet("Dashboard")
  .chart("yearOverYear", ({ refs }) => ({
    marks: [
      refs.sheet("2026").table("sales").bar({ x: "month", y: "revenue" }),
      refs.sheet("2026").table("targets").bar({ x: "month", y: "target" }),
    ],
  }));

const chartRefsCheck = createWorkbook()
  .sheet("2026")
  .table("sales", { schema: chartMonthlySchema, rows: [] })
  .table("client", { schema: chartMonthlySchema, rows: [], select: { exclude: ["cost"] } })
  .table("targets", { schema: chartTargetSchema, rows: [] });

chartRefsCheck
  // @ts-expect-error - text columns cannot be plotted as values
  .chart("text", ({ refs }) => ({ marks: [refs.table("sales").bar({ x: "month", y: "month" })] }))
  .chart("transformed", ({ refs }) => ({
    // @ts-expect-error - a column transformed into text cannot be plotted as values
    marks: [refs.table("sales").bar({ x: "month", y: "label" })],
  }))
  .chart("excluded", ({ refs }) => ({
    // @ts-expect-error - "cost" is excluded by this table's select
    marks: [refs.table("client").bar({ x: "month", y: "cost" })],
  }))
  // @ts-expect-error - unknown column
  .chart("typo", ({ refs }) => ({ marks: [refs.table("sales").line({ x: "month", y: "revenu" })] }))
  .chart("scatterX", ({ refs }) => ({
    // @ts-expect-error - a scatter mark needs a numeric x column
    marks: [refs.table("sales").scatter({ x: "month", y: "revenue" })],
  }))
  .chart("pieValue", ({ refs }) => ({
    // @ts-expect-error - a pie value must be numeric
    marks: [refs.table("sales").pie({ label: "month", value: "month" })],
  }))
  .chart("names", ({ refs }) => ({
    // @ts-expect-error - name and color apply to a single y column
    marks: [refs.table("sales").bar({ x: "month", y: ["revenue", "cost"], name: "Both" })],
  }))
  .chart("series", ({ refs }) => ({
    // @ts-expect-error - series only applies with x: { dynamic }
    marks: [refs.table("sales").bar({ x: "month", y: "revenue", series: "month" })],
  }))
  // @ts-expect-error - a mark needs y
  .chart("noY", ({ refs }) => ({ marks: [refs.table("sales").line({ x: "month" })] }))
  // @ts-expect-error - a pie chart takes a single mark
  .chart("pieMix", ({ refs }) => ({
    marks: [
      refs.table("sales").pie({ label: "month", value: "revenue" }),
      refs.table("sales").bar({ x: "month", y: "revenue" }),
    ],
  }))
  // @ts-expect-error - scatter marks cannot share a chart with other marks
  .chart("scatterMix", ({ refs }) => ({
    marks: [
      refs.table("sales").scatter({ x: "revenue", y: "margin" }),
      refs.table("sales").line({ x: "month", y: "revenue" }),
    ],
  }))
  // @ts-expect-error - horizontal bars cannot share a chart with other marks
  .chart("horizontalMix", ({ refs }) => ({
    marks: [
      refs.table("sales").bar({ x: "month", y: "revenue", horizontal: true }),
      refs.table("sales").line({ x: "month", y: "revenue" }),
    ],
  }))
  // @ts-expect-error - marks disagree on the x axis: text and dates
  .chart("xKinds", ({ refs }) => ({
    marks: [
      refs.table("sales").bar({ x: "month", y: "revenue" }),
      refs.table("sales").line({ x: "day", y: "revenue" }),
    ],
  }))
  // @ts-expect-error - table ids are unique within a sheet
  .table("sales", { schema: chartTargetSchema, rows: [] })
  .sheet("Dashboard")
  .chart("otherSheet", ({ refs }) => ({
    // @ts-expect-error - a table id alone only looks on the current sheet
    marks: [refs.table("sales").bar({ x: "month", y: "revenue" })],
  }))
  .chart("laterSheet", ({ refs }) => ({
    // @ts-expect-error - sheets declared later in the chain are not visible yet
    marks: [refs.sheet("Budget").table("budget").bar({ x: "month", y: "target" })],
  }))
  // @ts-expect-error - sheet names are unique within the chain
  .sheet("2026")
  .sheet("Budget")
  .table("budget", { schema: chartTargetSchema, rows: [] });

createWorkbook()
  .sheet("Territories")
  .table("territories", { schema: chartTerritorySchema, rows: [], context: { months: [] } })
  .chart("noSeries", ({ refs }) => ({
    // @ts-expect-error - x: { dynamic } needs series
    marks: [refs.table("territories").line({ x: { dynamic: "months" } })],
  }))
  .chart("unknownBlock", ({ refs }) => ({
    // @ts-expect-error - unknown dynamic block
    marks: [refs.table("territories").line({ x: { dynamic: "weeks" }, series: "territory" })],
  }));

async function _streamCharts() {
  const workbook = createWorkbookStream();
  const sales = await workbook.sheet("Sales").table("sales", { schema: chartMonthlySchema });
  const targets = await workbook.sheet("Sales").table("targets", { schema: chartTargetSchema });
  workbook.sheet("Dashboard").chart("revenue", {
    marks: [sales.bar({ x: "month", y: "revenue" }), targets.line({ x: "month", y: "target" })],
  });
  // @ts-expect-error - streamed tables check their columns too
  sales.bar({ x: "month", y: "month" });
}

// ── Pivot tables and pivot charts ───────────────────────────────────────────

// valid: rows, columns, filters, several aggregations, pivot charts, a pie over a single value
createWorkbook()
  .sheet("Sales")
  .table("sales", { schema: chartMonthlySchema, rows: [] })
  .sheet("Analysis")
  .pivot("byMonth", ({ refs }) =>
    refs
      .sheet("Sales")
      .table("sales")
      .pivot({
        rows: ["month"],
        columns: ["label"],
        values: {
          revenue: "sum",
          month: "count",
          cost: ["sum", { aggregate: "average", name: "Avg cost", format: "0.0" }],
        },
        filters: ["day"],
        sort: "source",
        style: "PivotStyleMedium9",
      }),
  )
  .chart("byMonthChart", ({ refs }) => ({ marks: [refs.pivot("byMonth").bar({ stack: true })] }))
  .pivot("single", ({ refs }) =>
    refs
      .sheet("Sales")
      .table("sales")
      .pivot({ rows: ["month"], values: { revenue: "sum" } }),
  )
  .chart("share", ({ refs }) => ({ marks: [refs.pivot("single").pie()] }));

const pivotCheck = createWorkbook()
  .sheet("Sales")
  .table("sales", { schema: chartMonthlySchema, rows: [] })
  .table("client", { schema: chartMonthlySchema, rows: [], select: { exclude: ["cost"] } });

pivotCheck
  .pivot("unknownRow", ({ refs }) =>
    // @ts-expect-error - unknown row field
    refs.table("sales").pivot({ rows: ["region"], values: { revenue: "sum" } }),
  )
  .pivot("textSum", ({ refs }) =>
    // @ts-expect-error - only count works on a text column
    refs.table("sales").pivot({ rows: ["day"], values: { month: "sum" } }),
  )
  .pivot("twice", ({ refs }) =>
    // @ts-expect-error - a field is a row, a column or a filter, once
    refs.table("sales").pivot({ rows: ["month"], filters: ["month"], values: { revenue: "sum" } }),
  )
  .pivot("twoColumns", ({ refs }) =>
    refs
      .table("sales")
      // @ts-expect-error - a pivot takes at most one column field
      .pivot({ rows: ["month"], columns: ["day", "label"], values: { revenue: "sum" } }),
  )
  .pivot("noValues", ({ refs }) =>
    // @ts-expect-error - a pivot needs at least one value
    refs.table("sales").pivot({ rows: ["month"], values: {} }),
  )
  .pivot("excluded", ({ refs }) =>
    // @ts-expect-error - "cost" is excluded by this table's select
    refs.table("client").pivot({ rows: ["month"], values: { cost: "sum" } }),
  )
  .pivot("columns", ({ refs }) =>
    refs.table("sales").pivot({ rows: ["month"], columns: ["day"], values: { revenue: "sum" } }),
  )
  // @ts-expect-error - a pivot pie needs a pivot without columns and with a single value
  .chart("pieWithColumns", ({ refs }) => ({ marks: [refs.pivot("columns").pie()] }))
  // @ts-expect-error - a pivot chart takes a single mark
  .chart("mixed", ({ refs }) => ({
    marks: [refs.pivot("columns").bar(), refs.table("sales").line({ x: "month", y: "revenue" })],
  }))
  .chart("unknownPivot", ({ refs }) => ({
    // @ts-expect-error - unknown pivot
    marks: [refs.pivot("nope").bar()],
  }))
  // @ts-expect-error - pivot ids are unique within a sheet
  .pivot("columns", ({ refs }) =>
    refs.table("sales").pivot({ rows: ["month"], values: { revenue: "sum" } }),
  );

type DatedSaleRow = { orderedAt: Date; shippedAt: Date | null; region: string; revenue: number };
const datedSaleSchema = createExcelSchema<DatedSaleRow>()
  .column("orderedAt", { accessor: "orderedAt" })
  .column("shippedAt", { accessor: "shippedAt" })
  .column("region", { accessor: "region" })
  .column("revenue", { accessor: "revenue" })
  .build();

// valid: dates grouped by calendar units, values shown as percentages
createWorkbook()
  .sheet("Sales")
  .table("sales", { schema: datedSaleSchema, rows: [] })
  .pivot("byMonth", ({ refs }) =>
    refs.table("sales").pivot({
      rows: [{ field: "orderedAt", by: ["year", "quarter", "month"] }],
      columns: ["region"],
      values: { revenue: ["sum", { aggregate: "sum", show: "percentOfRow" }] },
    }),
  )
  .pivot("byYear", ({ refs }) =>
    refs.table("sales").pivot({
      rows: ["region"],
      columns: [{ field: "orderedAt", by: "year" }],
      values: { revenue: { aggregate: "sum", show: "percentOfColumn", format: "0%" } },
    }),
  )
  .chart("byYearChart", ({ refs }) => ({ marks: [refs.pivot("byYear").bar({ stack: true })] }))
  .pivot("share", ({ refs }) =>
    refs.table("sales").pivot({
      rows: [{ field: "orderedAt", by: "month" }],
      values: { revenue: { aggregate: "sum", show: "percentOfTotal" } },
      filters: ["region"],
    }),
  )
  .chart("shareChart", ({ refs }) => ({ marks: [refs.pivot("share").pie()] }));

const datedCheck = createWorkbook()
  .sheet("Sales")
  .table("sales", { schema: datedSaleSchema, rows: [] });

datedCheck
  .pivot("textByYear", ({ refs }) =>
    refs.table("sales").pivot({
      // @ts-expect-error - only date columns can be grouped by calendar units
      rows: [{ field: "region", by: "year" }],
      values: { revenue: "sum" },
    }),
  )
  .pivot("blankDates", ({ refs }) =>
    refs.table("sales").pivot({
      // @ts-expect-error - Excel cannot group a date column that may be blank
      rows: [{ field: "shippedAt", by: "month" }],
      values: { revenue: "sum" },
    }),
  )
  .pivot("wrongOrder", ({ refs }) =>
    refs.table("sales").pivot({
      // @ts-expect-error - date levels go from the largest unit to the smallest
      rows: [{ field: "orderedAt", by: ["month", "year"] }],
      values: { revenue: "sum" },
    }),
  )
  .pivot("levelsInColumns", ({ refs }) =>
    refs.table("sales").pivot({
      rows: ["region"],
      // @ts-expect-error - a column groups a date by one unit; only rows take several
      columns: [{ field: "orderedAt", by: ["year", "month"] }],
      values: { revenue: "sum" },
    }),
  )
  .pivot("groupedTwice", ({ refs }) =>
    refs
      .table("sales")
      // @ts-expect-error - a grouped date is still one field: a row, a column or a filter, once
      .pivot({
        rows: [{ field: "orderedAt", by: "year" }],
        filters: [{ field: "orderedAt", by: "month" }],
        values: { revenue: "sum" },
      }),
  )
  .pivot("rowShareWithoutColumns", ({ refs }) =>
    refs
      .table("sales")
      // @ts-expect-error - "percentOfRow" needs a column field
      .pivot({ rows: ["region"], values: { revenue: { aggregate: "sum", show: "percentOfRow" } } }),
  )
  .pivot("unknownShow", ({ refs }) =>
    refs.table("sales").pivot({
      rows: ["region"],
      // @ts-expect-error - unknown "show" value
      values: { revenue: { aggregate: "sum", show: "percentOfGrandTotal" } },
    }),
  );

// valid: pivot themes bind to table slots and take their own pivot slots
const pivotBrand = defineSpreadsheetTheme({
  slots: {
    header: { fill: { color: { rgb: "0B1220" } } },
    pivotFrame: { border: { top: { style: "medium" }, bottom: { style: "medium" } } },
    pivotTotal: ({ tokens }) => ({ fill: { color: { rgb: tokens.colors.summaryFill } } }),
    pivotHeader: { font: { italic: true } },
  },
});

createWorkbook()
  .sheet("Sales")
  .table("sales", { schema: datedSaleSchema, rows: [], theme: spreadsheetThemes.slate })
  .pivot("byRegion", ({ refs }) =>
    refs.table("sales").pivot({
      rows: ["region"],
      values: { revenue: "sum" },
      theme: pivotBrand,
      banded: { rows: true, columns: false },
    }),
  )
  .pivot("builtIn", ({ refs }) =>
    refs.table("sales").pivot({
      rows: ["region"],
      values: { revenue: "sum" },
      style: "PivotStyleMedium9",
      banded: true,
    }),
  );

defineSpreadsheetTheme({
  slots: {
    // @ts-expect-error - Excel draws a pivot header's border on its first row only
    pivotHeader: { border: { bottom: { style: "thin" } } },
  },
});
defineSpreadsheetTheme({
  slots: {
    // @ts-expect-error - a pivot style cannot change number formats
    pivotTotal: { numFmt: "0.0" },
  },
});
spreadsheetThemes.slate.extend({
  slots: {
    // @ts-expect-error - a pivot style cannot change font sizes
    pivotBody: { font: { size: 14 } },
  },
});

datedCheck
  .pivot("styleAndTheme", ({ refs }) =>
    refs
      .table("sales")
      // @ts-expect-error - a pivot takes a built-in style or a theme, not both
      .pivot({
        rows: ["region"],
        values: { revenue: "sum" },
        style: "PivotStyleMedium9",
        theme: spreadsheetThemes.slate,
      }),
  )
  .pivot("badBanding", ({ refs }) =>
    refs.table("sales").pivot({
      rows: ["region"],
      values: { revenue: "sum" },
      // @ts-expect-error - banded takes a boolean or { rows, columns }
      banded: "rows",
    }),
  );

async function _streamPivots() {
  const workbook = createWorkbookStream();
  const sales = await workbook.sheet("Sales").table("sales", { schema: chartMonthlySchema });
  const analysis = workbook.sheet("Analysis");
  const byMonth = analysis.pivot(
    "byMonth",
    sales.pivot({ rows: ["month"], values: { revenue: "sum" } }),
  );
  analysis.chart("chart", { marks: [byMonth.pie()] });
  // @ts-expect-error - streamed tables check pivot fields too
  sales.pivot({ rows: ["nope"], values: { revenue: "sum" } });
}

// Columns declared inside a group keep their value type in formulas: a number column compares to
// numbers, and a boolean column compares to booleans.
createExcelSchema<{ qty: number; urgent: boolean }>()
  .group("order", { header: "Order" }, (group) =>
    group
      .column("qty", { accessor: "qty" })
      .column("urgent", { accessor: "urgent", type: "checkbox" }),
  )
  .column("status", {
    formula: ({ refs, fx }) =>
      fx.if(refs.column("qty").gt(0).and(refs.column("urgent").eq(true)), "Rush", "Normal"),
  })
  .build();

// Pivot values are checked against the table: an unknown key or an empty list does not compile.
type PivotSale = { region: string; revenue: number; orderedAt?: Date | null };
const pivotSales = createExcelSchema<PivotSale>()
  .column("region", { header: "Region", accessor: "region" })
  .column("revenue", { header: "Revenue", accessor: "revenue" })
  .column("orderedAt", { header: "Ordered", accessor: "orderedAt", defaultValue: new Date(0) })
  .build();

createWorkbook()
  .sheet("Sales")
  .table("sales", { schema: pivotSales, rows: [] })
  .pivot("unknownValue", ({ refs }) =>
    // @ts-expect-error - "profit" is not a column of the table
    refs.table("sales").pivot({ rows: ["region"], values: { revenue: "sum", profit: "sum" } }),
  )
  .pivot("emptyValue", ({ refs }) =>
    // @ts-expect-error - a value needs at least one aggregation
    refs.table("sales").pivot({ rows: ["region"], values: { revenue: [] } }),
  )
  // A date column with a defaultValue is never blank, so it can be grouped by date.
  .pivot("byYear", ({ refs }) =>
    refs.table("sales").pivot({
      rows: [{ field: "orderedAt", by: "year" }],
      values: { revenue: "sum" },
    }),
  );
