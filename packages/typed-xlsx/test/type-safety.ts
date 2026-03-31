/**
 * Type-level safety tests for @chronicstone/typed-xlsx.
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
    transform: (value) => value.toFixed(0),
  })
  .build();

// callback accessor → value matches callback return type
createExcelSchema<FlatRow>()
  .column("derived", {
    accessor: (row) => row.age * 2,
    // value is inferred as number
    transform: (value) => `${value.toFixed(0)} years`,
  })
  .build();

// ── formula columns: predecessor refs are typed ───────────────────────────────

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("doubleAge", {
    formula: ({ row }) => row.ref("age").mul(2),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("status", {
    formula: ({ row, fx }) => fx.if(row.ref("age").gte(18), "adult", "minor"),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("bucket", {
    formula: ({ row, fx }) =>
      fx.if(row.ref("age").gt(65).or(row.ref("age").lt(18)), "edge", "core"),
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("doubleAge", {
    formula: ({ row }) => {
      const age = row.ref("age");
      return age.add(age.toExpr());
    },
  })
  .build();

createExcelSchema<FlatRow>()
  .column("age", { accessor: "age" })
  .column("doubleAge", {
    formula: ({ row }) =>
      // @ts-expect-error formula columns can only reference previously declared column ids
      row.ref("future"),
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
  .table({ rows: [], schema: basicSchema, select: { include: ["name"] } });
createWorkbook()
  .sheet("S")
  .table({ rows: [], schema: basicSchema, select: { exclude: ["age"] } });

// undeclared column id in include
createWorkbook()
  .sheet("S")
  .table({
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
  .table({
    rows: [],
    schema: basicSchema,
    select: {
      // @ts-expect-error — "ghost" is not a declared column id
      exclude: ["ghost"],
    },
  });

// ── rows: array must match the schema's row type ──────────────────────────────

// valid rows compile
createWorkbook()
  .sheet("S")
  .table({ rows: [{ name: "Ada", age: 42 }], schema: basicSchema });

// extra property in row is rejected (excess property check)
createWorkbook()
  .sheet("S")
  .table({
    // @ts-expect-error — unknownField does not exist on FlatRow
    rows: [{ name: "Ada", age: 42, unknownField: true }],
    schema: basicSchema,
  });

// ── groups: context is required when groups exist ────────────────────────────

type GroupRow = { name: string; orgs: number[] };

const groupSchema = createExcelSchema<GroupRow>()
  .column("name", { accessor: "name" })
  .group("orgIds", (b, ids: number[]) => {
    for (const id of ids) {
      b.column(`org-${id}`, { accessor: (r) => r.orgs.includes(id) });
    }
  })
  .build();

// context required — omitting it errors
createWorkbook()
  .sheet("S")
  // @ts-expect-error — context is required when the schema contains groups
  .table({ rows: [], schema: groupSchema });

// context with wrong value type errors
createWorkbook()
  .sheet("S")
  .table({
    rows: [],
    schema: groupSchema,
    // @ts-expect-error — orgIds must be number[], not string
    context: { orgIds: "should-be-array" },
  });

// correct context compiles
createWorkbook()
  .sheet("S")
  .table({ rows: [], schema: groupSchema, context: { orgIds: [1, 2, 3] } });

// excluding the only contextful group means context is no longer required
createWorkbook()
  .sheet("S")
  .table({ rows: [], schema: groupSchema, select: { exclude: ["orgIds"] } });

// ── SchemaGroupContext: shape matches the group generic ──────────────────────

type GroupCtx = SchemaGroupContext<typeof groupSchema>;

const _gc1: GroupCtx = { orgIds: [1, 2, 3] };
// @ts-expect-error — string is not assignable to number[]
const _gc2: GroupCtx = { orgIds: "bad" };

type GroupItem = { id: number; name: string };
type DetailedGroupRow = {
  name: string;
  orgs: GroupItem[];
  tags: string[];
};

const detailedGroupSchema = createExcelSchema<DetailedGroupRow>()
  .column("name", { accessor: "name" })
  .group("orgs", (b, items: GroupItem[]) => {
    for (const item of items) {
      b.column(`org-${item.id}`, {
        header: item.name,
        accessor: (row) => (row.orgs.some((org) => org.id === item.id) ? "Yes" : "No"),
      });
    }
  })
  .group("tags", (b, tags: string[]) => {
    for (const tag of tags) {
      b.column(`tag-${tag}`, { accessor: (row) => (row.tags.includes(tag) ? "Yes" : "No") });
    }
  })
  .group("derived", (b) => {
    b.column("tagCount", { accessor: (row) => row.tags.length });
  })
  .build();

createExcelSchema<DetailedGroupRow>()
  .column("name", { accessor: "name" })
  // @ts-expect-error — passing a single generic argument to group is not supported; type the callback context instead
  .group<GroupItem[]>("orgs", () => {});

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
// @ts-expect-error — groups without a context parameter should not appear in the context shape
const _dgc6: keyof DetailedGroupCtx = "derived";

createWorkbook()
  .sheet("S")
  .table({ rows: [], schema: detailedGroupSchema, select: { include: ["name"] } });

createWorkbook()
  .sheet("S")
  .table({ rows: [], schema: detailedGroupSchema, select: { include: ["derived"] } });

createWorkbook()
  .sheet("S")
  // @ts-expect-error — context is required when selecting the orgs group
  .table({ rows: [], schema: detailedGroupSchema, select: { include: ["orgs"] } });

createWorkbook()
  .sheet("S")
  .table({
    rows: [],
    schema: detailedGroupSchema,
    select: { include: ["orgs"] },
    context: { orgs: [{ id: 1, name: "Acme" }] },
  });

createWorkbook()
  .sheet("S")
  .table({
    rows: [],
    schema: detailedGroupSchema,
    select: { include: ["orgs"] },
    // @ts-expect-error — only the selected orgs group should be present in context
    context: { orgs: [{ id: 1, name: "Acme" }], tags: ["vip"] },
  });

createWorkbook()
  .sheet("S")
  // @ts-expect-error — excluding tags still leaves orgs selected, so context is required
  .table({ rows: [], schema: detailedGroupSchema, select: { exclude: ["tags"] } });

createWorkbook()
  .sheet("S")
  .table({
    rows: [],
    schema: detailedGroupSchema,
    select: { exclude: ["tags"] },
    context: { orgs: [{ id: 1, name: "Acme" }] },
  });

createWorkbook()
  .sheet("S")
  .table({
    rows: [],
    schema: detailedGroupSchema,
    select: { exclude: ["orgs", "tags"] },
  });

createWorkbook()
  .sheet("S")
  .table({
    rows: [],
    schema: detailedGroupSchema,
    select: { include: ["orgs", "tags"], exclude: ["tags"] },
    context: { orgs: [{ id: 1, name: "Acme" }] },
  });

createWorkbook()
  .sheet("S")
  .table({
    rows: [],
    schema: detailedGroupSchema,
    select: { include: ["derived", "name"] },
  });
