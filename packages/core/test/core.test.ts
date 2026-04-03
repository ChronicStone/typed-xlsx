import { describe, expect, it } from "vitest";
import * as Internal from "../src/index-internal";

describe("core", () => {
  it("resolves typed paths at runtime", () => {
    const row = {
      profile: {
        email: "hello@example.com",
      },
    };

    expect(Internal.getValueAtPath(row, "profile.email")).toBe("hello@example.com");
  });

  it("supports string and callback accessors", () => {
    const row = {
      profile: { email: "hello@example.com" },
      firstName: "Ada",
      lastName: "Lovelace",
    };

    expect(Internal.resolveAccessor(row, "profile.email")).toBe("hello@example.com");
    expect(Internal.resolveAccessor(row, (value) => `${value.firstName} ${value.lastName}`)).toBe(
      "Ada Lovelace",
    );
  });

  it("prevents duplicate schema column ids", () => {
    const builder = Internal.SchemaBuilder.create<{ id: string }>();
    builder.column("id", {
      accessor: "id",
    });

    expect(() =>
      builder.column("id", {
        accessor: "id",
      }),
    ).toThrow("Column with id 'id' already exists.");
  });

  it("exposes shared planner metrics for width and height estimation", () => {
    const width = Internal.resolveColumnWidth({
      column: {
        id: "name",
        accessor: "name",
        headerLabel: "Name",
        autoWidth: false,
        dynamicPath: [],
        groupPath: [],
        scopeIds: [],
      },
      currentWidth: 4,
      measuredWidth: 20,
    });

    expect(width).toBe(4);
    expect(Internal.measurePrimitiveValue("hello\nworld")).toBe(5);
    expect(
      Internal.estimateRowHeight(
        ["hello\nworld"],
        [
          {
            font: { size: 14 },
          },
        ],
      ),
    ).toBeGreaterThan(Internal.getDefaultRowHeight());
  });

  it("resolves lazy headers, summary labels, totals row labels, and validation messages during schema build", () => {
    const tableSchema = Internal.ExcelTableSchemaBuilder.create<{
      amount: number;
      status: string;
    }>()
      .column("status", {
        header: () => "Status",
        accessor: "status",
        totalsRow: { label: () => "TOTAL" },
        validation: (v) =>
          v
            .list(["draft", "active", "archived"])
            .prompt({
              title: () => "Pick a status",
              message: () => "Use one of the allowed values",
            })
            .error({
              title: () => "Invalid status",
              message: () => "Only draft, active, or archived are allowed",
            }),
      })
      .column("amount", {
        header: () => "Amount",
        accessor: "amount",
      })
      .build();

    const columns = Internal.resolveColumns(tableSchema);

    expect(columns[0]?.headerLabel).toBe("Status");
    expect(columns[0]?.totalsRow).toEqual({ label: "TOTAL" });
    expect(columns[0]?.validation).toMatchObject({
      type: "list",
      prompt: { title: "Pick a status", message: "Use one of the allowed values" },
      error: {
        title: "Invalid status",
        message: "Only draft, active, or archived are allowed",
      },
    });
    expect(columns[1]?.headerLabel).toBe("Amount");

    const reportSchema = Internal.SchemaBuilder.create<{ amount: number }>()
      .column("amount", {
        header: () => "Amount",
        accessor: "amount",
        summary: (summary) => [summary.label(() => "TOTAL")],
      })
      .build();

    const reportColumns = Internal.resolveColumns(reportSchema);
    const summaryBinding = Internal.createSummaryBindings(reportColumns)[0];

    expect(summaryBinding).toBeDefined();
    expect(
      summaryBinding
        ? Internal.finalizeSummaryRuntime(summaryBinding.definition, summaryBinding.runtime)
        : undefined,
    ).toBe("TOTAL");
  });
});
