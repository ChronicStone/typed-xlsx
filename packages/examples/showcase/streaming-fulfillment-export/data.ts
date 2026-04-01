import { createShowcaseFaker } from "../../src/_shared/faker";

export type FulfillmentRow = {
  shipmentId: string;
  warehouse: "Chicago" | "Rotterdam" | "Singapore";
  carrier: "DHL" | "FedEx" | "UPS";
  region: "AMER" | "EMEA" | "APAC";
  orderCount: number;
  shippedUnits: number;
  backlogUnits: number;
  shippedAt: Date;
};

function day(offset: number) {
  return new Date(Date.UTC(2026, 1, 1 + offset));
}

const faker = createShowcaseFaker(606);

const BASE_ROWS: FulfillmentRow[] = Array.from({ length: 8 }, (_, index) => ({
  shipmentId: `SHIP-${1001 + index}`,
  warehouse: faker.helpers.arrayElement(["Chicago", "Rotterdam", "Singapore"]),
  carrier: faker.helpers.arrayElement(["DHL", "FedEx", "UPS"]),
  region: faker.helpers.arrayElement(["AMER", "EMEA", "APAC"]),
  orderCount: faker.number.int({ min: 8, max: 24 }),
  shippedUnits: faker.number.int({ min: 260, max: 720 }),
  backlogUnits: faker.number.int({ min: 6, max: 40 }),
  shippedAt: day(index + 1),
}));

export function createFulfillmentRows(multiplier = 1): FulfillmentRow[] {
  return Array.from({ length: multiplier }, (_, batchIndex) =>
    BASE_ROWS.map((row, rowIndex) => ({
      ...row,
      shipmentId: `${row.shipmentId}-${String(batchIndex * BASE_ROWS.length + rowIndex + 1).padStart(4, "0")}`,
      shippedAt: day(batchIndex + rowIndex + 1),
      shippedUnits: row.shippedUnits + batchIndex * 12,
      backlogUnits: Math.max(4, row.backlogUnits - (batchIndex % 7)),
    })),
  ).flat();
}
