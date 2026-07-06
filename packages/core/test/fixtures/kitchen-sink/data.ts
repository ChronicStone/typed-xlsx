export interface KitchenSinkLineItem {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  fulfilled: boolean;
}

export interface KitchenSinkOrder {
  orderId: string;
  customer: {
    name: string;
    email: string;
    tier: "enterprise" | "growth" | "starter";
  };
  region: "EMEA" | "AMER" | "APAC";
  createdAt: Date;
  notes: string;
  tags: string[];
  items: KitchenSinkLineItem[];
}

export interface KitchenSinkSparklineRow {
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
}

function computeSeededDate(day: number) {
  return new Date(Date.UTC(2025, 2, day, 9, 30, 0));
}

export function createKitchenSinkOrders(): KitchenSinkOrder[] {
  return [
    {
      orderId: "ORD-1001",
      customer: {
        name: "Acme Manufacturing",
        email: "ops@acme.example",
        tier: "enterprise",
      },
      region: "EMEA",
      createdAt: computeSeededDate(3),
      notes: "Priority shipment\nRequires customs docs",
      tags: ["priority", "hardware", "renewal"],
      items: [
        {
          sku: "AX-100",
          description: "Assembly node\nRack-ready kit",
          quantity: 8,
          unitPrice: 1450,
          fulfilled: true,
        },
        {
          sku: "SUP-11",
          description: "Premium support extension",
          quantity: 1,
          unitPrice: 950,
          fulfilled: false,
        },
      ],
    },
    {
      orderId: "ORD-1002",
      customer: {
        name: "Bluebird Health",
        email: "finance@bluebird.example",
        tier: "growth",
      },
      region: "AMER",
      createdAt: computeSeededDate(7),
      notes: "Bundle with migration hours",
      tags: ["services", "migration"],
      items: [
        {
          sku: "LIC-24",
          description: "Workspace license",
          quantity: 24,
          unitPrice: 79,
          fulfilled: true,
        },
        {
          sku: "MIG-08",
          description: "Migration workshop",
          quantity: 2,
          unitPrice: 1250,
          fulfilled: true,
        },
        {
          sku: "TRN-04",
          description: "Enablement training\nRemote session",
          quantity: 1,
          unitPrice: 600,
          fulfilled: false,
        },
      ],
    },
    {
      orderId: "ORD-1003",
      customer: {
        name: "Cinder Labs",
        email: "team@cinder.example",
        tier: "starter",
      },
      region: "APAC",
      createdAt: computeSeededDate(12),
      notes: "Keep starter discount",
      tags: ["self-serve"],
      items: [
        {
          sku: "LITE-05",
          description: "Starter seats",
          quantity: 5,
          unitPrice: 39,
          fulfilled: true,
        },
      ],
    },
    {
      orderId: "ORD-1004",
      customer: {
        name: "Delta Retail Group",
        email: "buyers@delta.example",
        tier: "enterprise",
      },
      region: "EMEA",
      createdAt: computeSeededDate(18),
      notes: "Split invoice by subsidiary\nSend PDF copy",
      tags: ["multi-entity", "finance-review", "renewal"],
      items: [
        {
          sku: "POS-14",
          description: "Retail POS devices",
          quantity: 14,
          unitPrice: 520,
          fulfilled: true,
        },
        {
          sku: "NET-02",
          description: "Network gateway",
          quantity: 2,
          unitPrice: 2100,
          fulfilled: true,
        },
      ],
    },
  ];
}

export function createKitchenSinkSparklineRows(): KitchenSinkSparklineRow[] {
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
      segment: "Starter",
      jan: 22,
      feb: 19,
      mar: 24,
      apr: 28,
      may: 25,
      jun: 31,
      deltaJan: 1,
      deltaFeb: -3,
      deltaMar: 5,
      deltaApr: 4,
      deltaMay: -3,
      deltaJun: 6,
    },
    {
      segment: "Expansion",
      jan: 18,
      feb: 24,
      mar: 37,
      apr: 34,
      may: 46,
      jun: 58,
      deltaJan: 2,
      deltaFeb: 6,
      deltaMar: 13,
      deltaApr: -3,
      deltaMay: 12,
      deltaJun: 12,
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
    {
      segment: "Seasonal",
      jan: 36,
      feb: 52,
      mar: 49,
      apr: 68,
      may: 55,
      jun: 73,
      deltaJan: 5,
      deltaFeb: 16,
      deltaMar: -3,
      deltaApr: 19,
      deltaMay: -13,
      deltaJun: 18,
    },
    {
      segment: "Turnaround",
      jan: 96,
      feb: 74,
      mar: 51,
      apr: 48,
      may: 67,
      jun: 92,
      deltaJan: -8,
      deltaFeb: -22,
      deltaMar: -23,
      deltaApr: -3,
      deltaMay: 19,
      deltaJun: 25,
    },
  ];
}
