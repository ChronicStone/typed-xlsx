import { Buffer } from "node:buffer";

export type FeatureTrack = "Schema" | "Formula" | "Renderer" | "Workflow" | "Workbook" | "Layout";

export type FeatureMapRow = {
  apiSurface: string;
  buffered: boolean;
  demonstrates: string;
  feature: string;
  sheet: string;
  streaming: boolean;
  target: string;
  track: FeatureTrack;
};

export type AccountRow = {
  account: string;
  owner: string;
  ownerEmail: string;
  region: "AMER" | "EMEA" | "APAC";
  tier: "Enterprise" | "Growth" | "Starter";
  arr: number;
  seatsPurchased: number;
  seatsActivated: number;
  renewalDate: Date;
  notes?: string;
};

export type OrderLine = {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  shipped: boolean;
};

export type OrderRow = {
  orderId: string;
  customer: {
    name: string;
    tier: "Enterprise" | "Growth" | "Starter";
  };
  createdAt: Date;
  lines: OrderLine[];
};

export type FormulaRow = {
  product: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  seatsPurchased: number;
  seatsActivated: number;
};

export type SummaryRow = {
  account: string;
  region: "AMER" | "EMEA" | "APAC";
  revenue: number;
  cost: number;
  healthScore: number;
  closedAt: Date;
};

export type TerritoryRow = {
  manager: string;
  quarter: "Q1" | "Q2";
  revenueByRegion: Record<string, number>;
  territory: string;
};

export type BadgeCheckboxRow = {
  account: string;
  billingOk: boolean | null;
  canEditLaunch: boolean;
  launchReady: boolean;
  priority: "High" | "Medium" | "Low";
  status: "Live" | "At risk" | "Launch";
};

export type LinkRow = {
  account: string;
  customerId: string;
  email: string;
  invoiceId: string;
};

export type SparklineRow = {
  segment: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  deltaJan: number;
  deltaFeb: number;
  deltaMar: number;
  deltaApr: number;
  deltaMay: number;
  deltaJun: number;
};

export type ProductMediaRow = {
  category: string;
  listedOnline: boolean;
  price: number;
  productName: string;
  sku: string;
  status: "Live" | "Low stock" | "Launch";
  storefrontUrl: string;
  thumbnail: Uint8Array;
  thumbnailUrl: string;
};

export type ValidationRow = {
  amount: number;
  owner: string;
  startDate: Date;
  status: "draft" | "active" | "archived";
};

export type ProtectedInputRow = {
  approvedBudget: number;
  owner: string;
  requestedBudget: number;
};

export type NativeTableRow = {
  cost: number;
  product: string;
  region: "AMER" | "EMEA" | "APAC";
  revenue: number;
  units: number;
};

function date(day: number) {
  return new Date(Date.UTC(2026, 0, day, 9, 30, 0));
}

const thumbnails = {
  backpack:
    "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAbElEQVR4nO3QwQ2AIBREQSqxFkuxOc725wVLICTCapyfvCvZoWz72b5cSQ8ASA8ASA8ASA8ASA8AeOqho15DAQAABAGzbilg9Md7AQAAAAAAAAAAAPwIMOOWAd4UQDqAdADpANIBpANIB5DuBt7QUN1JPkANAAAAAElFTkSuQmCC",
  dock: "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAmElEQVR4nO3SsQ2AMBBD0VRMxAyswVzMxUAgCiREFV0i7CO/cB2/nMu0LkfmFHUBAOoCANQF0gLmfcsLuMqnBdzlUwKe5e0A73I1AQAAAAAA4wJ6vdsFEPl9qwtEAT0QckArwgLQgrABRBEAfguIwGwA0ctYAFqmJQfUTMsWUDMtW0DNtAAAAAAAwHiALwJAHQDqAFAHgDon2COGMuDoxsEAAAAASUVORK5CYII=",
  lamp: "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAaklEQVR4nO3PsQ2AQBADwa+Aigio8dslgJwUOHNiLG3uGXNbjs6N9AGA9AGA9AGA9AGA9AGA9AGA9IFSwD7XkgAACjG3AdcBAPwN8HYAAAAAAI+fBmgL+GIA6QDSAaQDSAeQDiAdQLr2gBM067YHeC33XQAAAABJRU5ErkJggg==",
} satisfies Record<string, string>;

function decodePng(base64: string) {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export function createFeatureMapRows(): FeatureMapRow[] {
  return [
    {
      apiSurface: "accessor, dot paths, callbacks, defaultValue, autoWidth",
      buffered: true,
      demonstrates: "Typed row-shape accessors and derived values without cell coordinates.",
      feature: "Typed accessors",
      sheet: "01 Typed Accessors",
      streaming: true,
      target: "#'01 Typed Accessors'!A1",
      track: "Schema",
    },
    {
      apiSurface: "array-valued accessors, merged parent cells",
      buffered: true,
      demonstrates: "Nested line items expand into physical rows while parent cells merge.",
      feature: "Sub-row expansion",
      sheet: "02 Sub Row Expansion",
      streaming: true,
      target: "#'02 Sub Row Expansion'!A1",
      track: "Schema",
    },
    {
      apiSurface: "refs.column(), fx.round(), fx.safeDiv(), conditionalStyle",
      buffered: true,
      demonstrates: "Column-ID formulas replace fragile A1 string math.",
      feature: "Formula DSL",
      sheet: "03 Formula DSL",
      streaming: true,
      target: "#'03 Formula DSL'!A1",
      track: "Formula",
    },
    {
      apiSurface: "summary.formula(), summary.cell(), summary.label()",
      buffered: true,
      demonstrates: "Footer formulas and reducers align automatically across the schema.",
      feature: "Summary rows",
      sheet: "04 Summary Rows",
      streaming: true,
      target: "#'04 Summary Rows'!A1",
      track: "Formula",
    },
    {
      apiSurface: "dynamic(), typed schema context, refs.dynamic()",
      buffered: true,
      demonstrates: "Runtime region columns still participate in typed totals.",
      feature: "Dynamic columns",
      sheet: "05 Dynamic Columns",
      streaming: true,
      target: "#'05 Dynamic Columns'!A1",
      track: "Schema",
    },
    {
      apiSurface: "type: badge, type: checkbox, refs.column(), conditionalStyle, protection.locked",
      buffered: true,
      demonstrates:
        "Checkbox toggles feed live formulas and conditional styles; locked checkbox cells stay disabled on the protected sheet.",
      feature: "Badges and checkboxes",
      sheet: "06 Badges Checkboxes",
      streaming: true,
      target: "#'06 Badges Checkboxes'!A1",
      track: "Renderer",
    },
    {
      apiSurface: "type: hyperlink, target, tooltip",
      buffered: true,
      demonstrates: "External links, mailto links, and workbook-internal jumps.",
      feature: "Hyperlinks",
      sheet: "07 Hyperlinks",
      streaming: true,
      target: "#'07 Hyperlinks'!A1",
      track: "Renderer",
    },
    {
      apiSurface: "type: sparkline, grouped sources, line/column/win-loss",
      buffered: true,
      demonstrates: "Tiny trend charts driven by typed source columns.",
      feature: "Sparklines",
      sheet: "08 Sparklines",
      streaming: true,
      target: "#'08 Sparklines'!A1",
      track: "Renderer",
    },
    {
      apiSurface: "type: image, source: bytes, source: url",
      buffered: true,
      demonstrates: "Embedded media and URL-backed IMAGE formulas side by side.",
      feature: "Images and media",
      sheet: "09 Images Media",
      streaming: true,
      target: "#'09 Images Media'!A1",
      track: "Renderer",
    },
    {
      apiSurface: "validation list, integer, date, prompt, error",
      buffered: true,
      demonstrates: "Native Excel validation rules are declared in the schema.",
      feature: "Data validation",
      sheet: "10 Data Validation",
      streaming: true,
      target: "#'10 Data Validation'!A1",
      track: "Workflow",
    },
    {
      apiSurface: "sheet protection, locked cells, unlocked inputs, hidden formulas",
      buffered: true,
      demonstrates: "End-user inputs stay editable while formulas remain protected.",
      feature: "Protected inputs",
      sheet: "11 Protected Inputs",
      streaming: true,
      target: "#'11 Protected Inputs'!A1",
      track: "Workflow",
    },
    {
      apiSurface: "mode: excel-table, autoFilter, totalsRow, table styles",
      buffered: true,
      demonstrates: "Real Excel table objects with filter-aware totals.",
      feature: "Native Excel table",
      sheet: "12 Native Excel Table",
      streaming: true,
      target: "#'12 Native Excel Table'!A1",
      track: "Workbook",
    },
    {
      apiSurface: "tablesPerRow, select.include, select.exclude, freezePane",
      buffered: true,
      demonstrates: "Multiple focused tables are composed on one sheet from one schema.",
      feature: "Layout controls",
      sheet: "13 Layout Controls",
      streaming: true,
      target: "#'13 Layout Controls'!A1",
      track: "Layout",
    },
  ];
}

export function createAccounts(): AccountRow[] {
  return [
    {
      account: "Acme Manufacturing",
      owner: "Maya Chen",
      ownerEmail: "maya.chen@example.com",
      region: "EMEA",
      tier: "Enterprise",
      arr: 420000,
      seatsPurchased: 480,
      seatsActivated: 438,
      renewalDate: date(20),
      notes: "Board-visible renewal, expansion in procurement",
    },
    {
      account: "Bluebird Health",
      owner: "Noah Patel",
      ownerEmail: "noah.patel@example.com",
      region: "AMER",
      tier: "Growth",
      arr: 96000,
      seatsPurchased: 120,
      seatsActivated: 86,
      renewalDate: date(24),
    },
    {
      account: "Cinder Labs",
      owner: "Lena Ortiz",
      ownerEmail: "lena.ortiz@example.com",
      region: "APAC",
      tier: "Starter",
      arr: 18000,
      seatsPurchased: 24,
      seatsActivated: 19,
      renewalDate: date(28),
      notes: "Self-serve expansion candidate",
    },
  ];
}

export function createOrders(): OrderRow[] {
  return [
    {
      orderId: "ORD-1001",
      customer: { name: "Acme Manufacturing", tier: "Enterprise" },
      createdAt: date(4),
      lines: [
        {
          sku: "AX-100",
          description: "Assembly node kit",
          quantity: 8,
          unitPrice: 1450,
          shipped: true,
        },
        {
          sku: "SUP-11",
          description: "Premium support extension",
          quantity: 1,
          unitPrice: 950,
          shipped: false,
        },
      ],
    },
    {
      orderId: "ORD-1002",
      customer: { name: "Bluebird Health", tier: "Growth" },
      createdAt: date(8),
      lines: [
        {
          sku: "LIC-24",
          description: "Workspace license",
          quantity: 24,
          unitPrice: 79,
          shipped: true,
        },
        {
          sku: "MIG-08",
          description: "Migration workshop",
          quantity: 2,
          unitPrice: 1250,
          shipped: true,
        },
        {
          sku: "TRN-04",
          description: "Enablement training",
          quantity: 1,
          unitPrice: 600,
          shipped: false,
        },
      ],
    },
  ];
}

export function createFormulaRows(): FormulaRow[] {
  return [
    {
      product: "Assembly node kit",
      quantity: 8,
      unitPrice: 1450,
      discountRate: 0.12,
      seatsPurchased: 80,
      seatsActivated: 74,
    },
    {
      product: "Workspace license",
      quantity: 24,
      unitPrice: 79,
      discountRate: 0.04,
      seatsPurchased: 120,
      seatsActivated: 86,
    },
    {
      product: "Retail POS device",
      quantity: 14,
      unitPrice: 520,
      discountRate: 0.18,
      seatsPurchased: 40,
      seatsActivated: 18,
    },
  ];
}

export function createSummaryRows(): SummaryRow[] {
  return [
    {
      account: "Acme Manufacturing",
      region: "EMEA",
      revenue: 420000,
      cost: 210000,
      healthScore: 92,
      closedAt: date(2),
    },
    {
      account: "Bluebird Health",
      region: "AMER",
      revenue: 96000,
      cost: 57000,
      healthScore: 74,
      closedAt: date(6),
    },
    {
      account: "Cinder Labs",
      region: "APAC",
      revenue: 18000,
      cost: 12000,
      healthScore: 81,
      closedAt: date(12),
    },
    {
      account: "Delta Retail Group",
      region: "EMEA",
      revenue: 260000,
      cost: 185000,
      healthScore: 68,
      closedAt: date(16),
    },
  ];
}

export function createTerritories(): TerritoryRow[] {
  return [
    {
      territory: "North America",
      manager: "Evan Brooks",
      quarter: "Q1",
      revenueByRegion: { AMER: 320000, EMEA: 48000, APAC: 36000 },
    },
    {
      territory: "Europe",
      manager: "Mira Weiss",
      quarter: "Q1",
      revenueByRegion: { AMER: 42000, EMEA: 280000, APAC: 22000 },
    },
    {
      territory: "Asia Pacific",
      manager: "Hana Sato",
      quarter: "Q1",
      revenueByRegion: { AMER: 18000, EMEA: 34000, APAC: 210000 },
    },
  ];
}

export function createBadgeCheckboxRows(): BadgeCheckboxRow[] {
  return [
    {
      account: "Acme Manufacturing",
      billingOk: true,
      canEditLaunch: true,
      launchReady: true,
      priority: "High",
      status: "Live",
    },
    {
      account: "Bluebird Health",
      billingOk: null,
      canEditLaunch: true,
      launchReady: false,
      priority: "Medium",
      status: "Launch",
    },
    {
      account: "Delta Retail Group",
      billingOk: false,
      canEditLaunch: false,
      launchReady: false,
      priority: "High",
      status: "At risk",
    },
  ];
}

export function createLinkRows(): LinkRow[] {
  return [
    {
      account: "Acme Manufacturing",
      customerId: "acme",
      email: "ops@acme.example",
      invoiceId: "INV-1001",
    },
    {
      account: "Bluebird Health",
      customerId: "bluebird",
      email: "finance@bluebird.example",
      invoiceId: "INV-1002",
    },
    {
      account: "Cinder Labs",
      customerId: "cinder",
      email: "team@cinder.example",
      invoiceId: "INV-1003",
    },
  ];
}

export function createSparklineRows(): SparklineRow[] {
  return [
    {
      segment: "Enterprise",
      jan: 82,
      feb: 91,
      mar: 88,
      apr: 106,
      may: 118,
      jun: 132,
      deltaJan: 4,
      deltaFeb: 9,
      deltaMar: -3,
      deltaApr: 18,
      deltaMay: 12,
      deltaJun: 14,
    },
    {
      segment: "Growth",
      jan: 44,
      feb: 47,
      mar: 54,
      apr: 52,
      may: 63,
      jun: 71,
      deltaJan: -2,
      deltaFeb: 3,
      deltaMar: 7,
      deltaApr: -2,
      deltaMay: 11,
      deltaJun: 8,
    },
    {
      segment: "Risk",
      jan: 68,
      feb: 62,
      mar: 57,
      apr: 49,
      may: 44,
      jun: 39,
      deltaJan: -1,
      deltaFeb: -6,
      deltaMar: -5,
      deltaApr: -8,
      deltaMay: -5,
      deltaJun: -5,
    },
  ];
}

export function createProductMediaRows(): ProductMediaRow[] {
  return [
    {
      category: "Bags",
      listedOnline: true,
      price: 129,
      productName: "Atlas Field Backpack",
      sku: "BK-1024",
      status: "Live",
      storefrontUrl: "https://example.com/products/atlas-field-backpack",
      thumbnail: decodePng(thumbnails.backpack),
      thumbnailUrl: "https://dummyimage.com/48x48/1e40af/ffffff.png&text=BK",
    },
    {
      category: "Electronics",
      listedOnline: true,
      price: 189,
      productName: "Pulse USB-C Dock",
      sku: "EL-2088",
      status: "Launch",
      storefrontUrl: "https://example.com/products/pulse-usb-c-dock",
      thumbnail: decodePng(thumbnails.dock),
      thumbnailUrl: "https://dummyimage.com/48x48/065f46/ffffff.png&text=EL",
    },
    {
      category: "Home",
      listedOnline: false,
      price: 74,
      productName: "Northstar Desk Lamp",
      sku: "HM-4310",
      status: "Low stock",
      storefrontUrl: "https://example.com/products/northstar-desk-lamp",
      thumbnail: decodePng(thumbnails.lamp),
      thumbnailUrl: "https://dummyimage.com/48x48/92400e/ffffff.png&text=HM",
    },
  ];
}

export function createValidationRows(): ValidationRow[] {
  return [
    { amount: 42000, owner: "Maya Chen", startDate: date(3), status: "active" },
    { amount: 18000, owner: "Noah Patel", startDate: date(9), status: "draft" },
    { amount: 12000, owner: "Lena Ortiz", startDate: date(14), status: "archived" },
  ];
}

export function createProtectedInputRows(): ProtectedInputRow[] {
  return [
    { approvedBudget: 37800, owner: "Maya Chen", requestedBudget: 42000 },
    { approvedBudget: 16200, owner: "Noah Patel", requestedBudget: 18000 },
    { approvedBudget: 10800, owner: "Lena Ortiz", requestedBudget: 12000 },
  ];
}

export function createNativeTableRows(): NativeTableRow[] {
  return [
    { cost: 8800, product: "Assembly node kit", region: "EMEA", revenue: 11600, units: 8 },
    { cost: 1280, product: "Workspace license", region: "AMER", revenue: 1896, units: 24 },
    { cost: 5200, product: "Retail POS device", region: "EMEA", revenue: 7280, units: 14 },
  ];
}
