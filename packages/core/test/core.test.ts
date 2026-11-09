import { describe, expect, it } from "vite-plus/test";
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

  it("resolves schema text callbacks from each table context", () => {
    type Context = {
      labels: Record<
        | "amount"
        | "errorMessage"
        | "errorTitle"
        | "group"
        | "promptMessage"
        | "promptTitle"
        | "status"
        | "summary"
        | "title"
        | "total",
        string
      >;
    };
    const english: Context = {
      labels: {
        amount: "Amount",
        errorMessage: "Only draft, active, or archived are allowed",
        errorTitle: "Invalid status",
        group: "Financials",
        promptMessage: "Use one of the allowed values",
        promptTitle: "Pick a status",
        status: "Status",
        summary: "TOTAL",
        title: "Localized report",
        total: "TOTAL",
      },
    };
    const french: Context = {
      labels: {
        amount: "Montant",
        errorMessage: "Utilisez brouillon, actif ou archive",
        errorTitle: "Statut invalide",
        group: "Finances",
        promptMessage: "Utilisez une valeur autorisee",
        promptTitle: "Choisissez un statut",
        status: "Statut",
        summary: "TOTAL FR",
        title: "Rapport localise",
        total: "TOTAL FR",
      },
    };
    const tableSchema = Internal.ExcelTableSchemaBuilder.create<
      {
        amount: number;
        status: string;
      },
      Context
    >()
      .column("status", {
        header: ({ ctx }) => ctx.labels.status,
        accessor: "status",
        totalsRow: { label: ({ ctx }) => ctx.labels.total },
        validation: (v) =>
          v
            .list(["draft", "active", "archived"])
            .prompt({
              title: ({ ctx }) => ctx.labels.promptTitle,
              message: ({ ctx }) => ctx.labels.promptMessage,
            })
            .error({
              title: ({ ctx }) => ctx.labels.errorTitle,
              message: ({ ctx }) => ctx.labels.errorMessage,
            }),
      })
      .column("amount", {
        header: ({ ctx }) => ctx.labels.amount,
        accessor: "amount",
      })
      .build();

    const columns = Internal.resolveColumns(tableSchema, english);
    const frenchColumns = Internal.resolveColumns(tableSchema, french);

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
    expect(frenchColumns[0]?.headerLabel).toBe("Statut");
    expect(frenchColumns[0]?.totalsRow).toEqual({ label: "TOTAL FR" });
    expect(frenchColumns[0]?.validation).toMatchObject({
      prompt: { title: "Choisissez un statut", message: "Utilisez une valeur autorisee" },
      error: { title: "Statut invalide", message: "Utilisez brouillon, actif ou archive" },
    });
    expect(frenchColumns[1]?.headerLabel).toBe("Montant");

    const reportSchema = Internal.SchemaBuilder.create<{ amount: number }, Context>()
      .group("financials", { header: ({ ctx }) => ctx.labels.group }, (group) =>
        group.column("amount", {
          header: ({ ctx }) => ctx.labels.amount,
          accessor: "amount",
          summary: (summary) => [summary.label(({ ctx }) => ctx.labels.summary)],
        }),
      )
      .build();

    const reportColumns = Internal.resolveColumns(reportSchema, french);
    expect(reportColumns[0]?.groupPath[0]?.headerLabel).toBe("Finances");
    const summaryBinding = Internal.createSummaryBindings(reportColumns)[0];

    expect(summaryBinding).toBeDefined();
    expect(
      summaryBinding
        ? Internal.finalizeSummaryRuntime(summaryBinding.definition, summaryBinding.runtime, {
            ctx: french,
          })
        : undefined,
    ).toBe("TOTAL FR");

    const workbook = Internal.BufferedWorkbookBuilder.create();
    workbook.sheet("Reports").table("localized", {
      title: ({ ctx }) => ctx.labels.title,
      schema: reportSchema,
      rows: [{ amount: 1 }],
      context: french,
    });

    expect(workbook.buildPlan().sheets[0]?.tables[0]?.title).toBe("Rapport localise");
  });
});
