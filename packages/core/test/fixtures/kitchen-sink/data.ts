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
