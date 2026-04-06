/**
 * Type-level safety tests for xlsmith.
 *
 * Not a runtime test file — these assertions are verified by `tsc --noEmit`
 * via `bun run typecheck`. Each `@ts-expect-error` directive must suppress
 * exactly one compiler error; tsc will report an error if the line it
 * annotates compiles cleanly (meaning a regression fixed the error).
 */

import type { Path, SchemaColumnId, SchemaGroupContext } from "../src";
import { createExcelSchema, createWorkbook } from "../src";

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
