import { createShowcaseFaker } from "../../src/_shared/faker";

export const WEEKS = ["W36", "W37", "W38", "W39", "W40", "W41", "W42", "W43"];
export const SUPPLIERS = [
  "Nordic Parts AB",
  "Kessler GmbH",
  "Lumen Supply Co.",
  "Orient Components",
];

export type StockItem = {
  sku: string;
  product: string;
  category: "Lighting" | "Power" | "Sensors" | "Mounting";
  warehouse: "Rotterdam" | "Lyon" | "Leipzig";
  onHand: number;
  inbound: number;
  unitCost: number;
  leadTimeDays: number;
  salesByWeek: Record<string, number>;
  supplier: string;
  reorderQty: number;
};

const PRODUCTS: Array<[string, StockItem["category"], number]> = [
  ["LED panel 60×60 4000K", "Lighting", 38],
  ["LED strip 5 m warm", "Lighting", 14],
  ["Track spot 12 W", "Lighting", 22],
  ["Emergency exit sign", "Lighting", 41],
  ["Driver 40 W dimmable", "Power", 19],
  ["Driver 75 W DALI", "Power", 46],
  ["Power supply 24 V 150 W", "Power", 33],
  ["Motion sensor ceiling", "Sensors", 27],
  ["Daylight sensor", "Sensors", 31],
  ["Presence detector PIR", "Sensors", 24],
  ["Suspension kit 1.5 m", "Mounting", 9],
  ["Surface frame 60×60", "Mounting", 17],
  ["Recessed clip set", "Mounting", 4],
  ["Track rail 2 m", "Mounting", 21],
];

/** Stock levels and eight weeks of sales per SKU. Reorder quantities start at zero: buyers fill them in. */
export function createStock(): StockItem[] {
  const faker = createShowcaseFaker(8086);
  const warehouses: StockItem["warehouse"][] = ["Rotterdam", "Lyon", "Leipzig"];
  return PRODUCTS.map(([product, category, unitCost], i) => {
    const weekly = faker.number.int({ min: 20, max: 160 });
    const salesByWeek = Object.fromEntries(
      WEEKS.map((w, k) => [
        w,
        Math.max(
          0,
          Math.round(weekly * (1 + (k - 4) * 0.04) + faker.number.int({ min: -12, max: 12 })),
        ),
      ]),
    );
    return {
      sku: `${category.slice(0, 3).toUpperCase()}-${String(1040 + i * 7)}`,
      product,
      category,
      warehouse: faker.helpers.arrayElement(warehouses),
      onHand: faker.number.int({ min: weekly * 0.6, max: weekly * 7 }),
      inbound: faker.helpers.arrayElement([0, 0, 0, weekly * 2, weekly * 4]),
      unitCost,
      leadTimeDays: faker.helpers.arrayElement([14, 21, 28, 42]),
      salesByWeek,
      supplier: faker.helpers.arrayElement(SUPPLIERS),
      reorderQty: 0,
    };
  });
}
