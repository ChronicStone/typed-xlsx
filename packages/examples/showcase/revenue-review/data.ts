import { createShowcaseFaker } from "../../src/_shared/faker";

export type Region = "North America" | "EMEA" | "APAC" | "LATAM";
export type Channel = "Direct" | "Partner" | "Self-serve";
export type ProductLine = "Platform" | "Analytics" | "Integrations";

export type Order = {
  id: string;
  orderedAt: Date;
  customer: string;
  region: Region;
  channel: Channel;
  product: ProductLine;
  seats: number;
  revenue: number;
  cost: number;
};

export type MonthlyRow = {
  month: string;
  revenue: number;
  target: number;
  cost: number;
};

const REGIONS: Array<[Region, number]> = [
  ["North America", 0.42],
  ["EMEA", 0.31],
  ["APAC", 0.18],
  ["LATAM", 0.09],
];
const CHANNELS: Array<[Channel, number]> = [
  ["Direct", 0.5],
  ["Partner", 0.3],
  ["Self-serve", 0.2],
];
const PRODUCTS: Array<[ProductLine, number, number]> = [
  // line, share, price per seat
  ["Platform", 0.55, 540],
  ["Analytics", 0.3, 380],
  ["Integrations", 0.15, 220],
];

function pickWeighted<T>(rand: number, entries: Array<[T, number, ...unknown[]]>) {
  let acc = 0;
  for (const entry of entries) {
    acc += entry[1];
    if (rand <= acc) return entry;
  }
  return entries[entries.length - 1]!;
}

/** Seven quarters of orders, January 2025 to September 2026, growing about 6% a quarter. */
export function createOrders(): Order[] {
  const faker = createShowcaseFaker(2026);
  const customers = Array.from({ length: 60 }, () => faker.company.name());
  const orders: Order[] = [];
  for (let m = 0; m < 21; m++) {
    const year = 2025 + Math.floor(m / 12);
    const month = m % 12;
    const count = 14 + Math.round(m * 0.9) + faker.number.int({ min: 0, max: 4 });
    for (let i = 0; i < count; i++) {
      const [region] = pickWeighted(faker.number.float(), REGIONS);
      const [channel] = pickWeighted(faker.number.float(), CHANNELS);
      const [product, , price] = pickWeighted(faker.number.float(), PRODUCTS) as [
        ProductLine,
        number,
        number,
      ];
      const seats = faker.number.int({ min: 8, max: 160 });
      const discount = channel === "Partner" ? 0.18 : channel === "Self-serve" ? 0 : 0.08;
      const revenue = Math.round(seats * price * (1 - discount) * (1 + m * 0.012));
      orders.push({
        id: `SO-${String(10240 + orders.length)}`,
        orderedAt: new Date(Date.UTC(year, month, faker.number.int({ min: 1, max: 28 }))),
        customer: faker.helpers.arrayElement(customers),
        region,
        channel,
        product,
        seats,
        revenue,
        cost: Math.round(revenue * faker.number.float({ min: 0.24, max: 0.41 })),
      });
    }
  }
  return orders.sort((a, b) => a.orderedAt.getTime() - b.orderedAt.getTime());
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The last twelve months, totalled in TypeScript, next to the plan. */
export function summarizeMonths(orders: Order[]): MonthlyRow[] {
  const rows = new Map<string, MonthlyRow>();
  for (const o of orders) {
    const key = `${o.orderedAt.getUTCFullYear()}-${o.orderedAt.getUTCMonth()}`;
    const row = rows.get(key) ?? {
      month: `${MONTH[o.orderedAt.getUTCMonth()]} ${String(o.orderedAt.getUTCFullYear()).slice(2)}`,
      revenue: 0,
      target: 0,
      cost: 0,
    };
    row.revenue += o.revenue;
    row.cost += o.cost;
    rows.set(key, row);
  }
  return [...rows.values()].slice(-12).map((row, i) => ({
    ...row,
    target: Math.round((1_000_000 + i * 40_000) / 1000) * 1000,
  }));
}
