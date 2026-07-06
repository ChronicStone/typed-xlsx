import { createWorkbook } from "typed-xlsx";
import {
  createAccounts,
  createBadgeCheckboxRows,
  createFeatureMapRows,
  createFormulaRows,
  createLinkRows,
  createNativeTableRows,
  createOrders,
  createProductMediaRows,
  createProtectedInputRows,
  createSparklineRows,
  createSummaryRows,
  createTerritories,
  createValidationRows,
} from "./data";
import {
  badgeCheckboxSchema,
  dynamicColumnsSchema,
  featureMapSchema,
  formulaDslSchema,
  hyperlinkSchema,
  imageMediaSchema,
  nativeExcelTableSchema,
  protectedInputSchema,
  sparklineSchema,
  subRowExpansionSchema,
  summaryRowsSchema,
  typedAccessorsSchema,
  validationSchema,
} from "./schema";

const reportDefaults = {
  title: {
    style: {
      fill: { color: { rgb: "E0F2FE" } },
      font: { bold: true, color: { rgb: "0F172A" } },
      alignment: { horizontal: "center", vertical: "center" },
    },
  },
  header: {
    preset: "header.inverse",
    style: { fill: { color: { rgb: "0F172A" } } },
  },
  summary: {
    preset: "summary.subtle",
    style: { fill: { color: { rgb: "E2E8F0" } } },
  },
  cells: {
    base: { style: { alignment: { vertical: "center" } } },
    hyperlink: { style: { font: { color: { rgb: "0563C1" }, underline: true } } },
  },
} as const;

export function buildKitchenSinkWorkbook() {
  const workbook = createWorkbook();
  const accounts = createAccounts();
  const regions = ["AMER", "EMEA", "APAC"];

  workbook
    .sheet("00 Feature Map", {
      freezePane: { rows: 2, columns: 2 },
    })
    .table("feature-map", {
      title: "Kitchen Sink Feature Map",
      rows: createFeatureMapRows(),
      schema: featureMapSchema,
      defaults: reportDefaults,
    });

  workbook
    .sheet("01 Typed Accessors", {
      freezePane: { rows: 2, columns: 2 },
    })
    .table("typed-accessors", {
      title: "Typed Accessors, Defaults, and Widths",
      rows: accounts,
      schema: typedAccessorsSchema,
      defaults: reportDefaults,
    });

  workbook
    .sheet("02 Sub Row Expansion", {
      freezePane: { rows: 2, columns: 3 },
    })
    .table("sub-row-expansion", {
      title: "Nested Orders Expanded Into Physical Rows",
      rows: createOrders(),
      schema: subRowExpansionSchema,
      defaults: reportDefaults,
    });

  workbook
    .sheet("03 Formula DSL", {
      freezePane: { rows: 2, columns: 2 },
    })
    .table("formula-dsl", {
      title: "Typed Formula DSL",
      rows: createFormulaRows(),
      schema: formulaDslSchema,
      defaults: reportDefaults,
    });

  workbook
    .sheet("04 Summary Rows", {
      freezePane: { rows: 2, columns: 2 },
    })
    .table("summary-rows", {
      title: "Summary Formulas and Reducers",
      rows: createSummaryRows(),
      schema: summaryRowsSchema,
      defaults: reportDefaults,
    });

  workbook
    .sheet("05 Dynamic Columns", {
      freezePane: { rows: 1, columns: 2 },
    })
    .table("dynamic-columns", {
      rows: createTerritories(),
      schema: dynamicColumnsSchema,
      context: { regions },
      name: "DynamicTerritoryMatrix",
      style: "TableStyleMedium4",
      totalsRow: true,
      autoFilter: true,
    });

  workbook
    .sheet("06 Badges Checkboxes", {
      freezePane: { rows: 2, columns: 2 },
    })
    .table("badges-checkboxes", {
      title: "Badge and Checkbox Renderers",
      rows: createBadgeCheckboxRows(),
      schema: badgeCheckboxSchema,
      defaults: reportDefaults,
    });

  workbook
    .sheet("07 Hyperlinks", {
      freezePane: { rows: 2, columns: 2 },
    })
    .table("hyperlinks", {
      title: "External, Email, and Internal Hyperlinks",
      rows: createLinkRows(),
      schema: hyperlinkSchema,
      defaults: reportDefaults,
    });

  workbook
    .sheet("08 Sparklines", {
      freezePane: { rows: 3, columns: 1 },
    })
    .table("sparklines", {
      title: "Sparkline Renderer Variants",
      rows: createSparklineRows(),
      schema: sparklineSchema,
      defaults: {
        ...reportDefaults,
        rowHeight: 40,
      },
    });

  workbook
    .sheet("09 Images Media", {
      freezePane: { rows: 2, columns: 2 },
    })
    .table("images-media", {
      title: "Embedded Bytes vs URL Image Formulas",
      rows: createProductMediaRows(),
      schema: imageMediaSchema,
      defaults: {
        ...reportDefaults,
        rowHeight: 48,
      },
    });

  workbook
    .sheet("10 Data Validation", {
      freezePane: { rows: 2, columns: 2 },
    })
    .table("data-validation", {
      title: "Native Excel Validation Rules",
      rows: createValidationRows(),
      schema: validationSchema,
      defaults: reportDefaults,
    });

  workbook
    .sheet("11 Protected Inputs", {
      freezePane: { rows: 2, columns: 2 },
      protection: {
        password: "kitchen-sink",
        selectLockedCells: false,
        selectUnlockedCells: true,
      },
    })
    .table("protected-inputs", {
      title: "Editable Inputs, Locked Logic",
      rows: createProtectedInputRows(),
      schema: protectedInputSchema,
      defaults: reportDefaults,
    });

  workbook.sheet("12 Native Excel Table").table("native-excel-table", {
    rows: createNativeTableRows(),
    schema: nativeExcelTableSchema,
    name: "KitchenSinkNativeTable",
    style: "TableStyleMedium2",
    totalsRow: true,
    autoFilter: true,
  });

  workbook
    .sheet("13 Layout Controls", {
      tablesPerRow: 2,
      tableColumnGap: 2,
      tableRowGap: 2,
      freezePane: { rows: 2, columns: 1 },
    })
    .table("executive-view", {
      title: "Executive View",
      rows: accounts,
      schema: typedAccessorsSchema,
      select: { include: ["account", "tier", "arr", "renewalDate"] },
      defaults: reportDefaults,
    })
    .table("operations-view", {
      title: "Operations View",
      rows: accounts,
      schema: typedAccessorsSchema,
      select: { exclude: ["ownerContact", "notes"] },
      defaults: reportDefaults,
    });

  return workbook.toUint8Array();
}

export const buildArtifact = buildKitchenSinkWorkbook;
