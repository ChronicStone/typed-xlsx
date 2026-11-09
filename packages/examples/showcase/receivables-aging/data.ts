import { createShowcaseFaker } from "../../src/_shared/faker";

export const AS_OF = new Date(Date.UTC(2026, 9, 31));

export type Bucket = "Current" | "1-30" | "31-60" | "61-90" | "90+";
export const BUCKETS: Bucket[] = ["Current", "1-30", "31-60", "61-90", "90+"];

export type Invoice = {
  invoice: string;
  customer: string;
  collector: string;
  issuedOn: Date;
  dueOn: Date;
  amount: number;
  paid: number;
  daysOverdue: number;
  bucket: Bucket;
  lastNote: string;
};

const NOTES = [
  "Promised payment end of week",
  "Waiting for PO number",
  "Disputed: duplicate line",
  "Sent reminder #2",
  "Paid partially, chasing balance",
  "AP contact on leave",
  "",
  "",
];

function bucketOf(days: number): Bucket {
  if (days <= 0) return "Current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

/** Open invoices as of 31 October 2026. Days late and buckets are computed in TypeScript. */
export function createInvoices(): Invoice[] {
  const faker = createShowcaseFaker(3131);
  const customers = Array.from({ length: 18 }, () => faker.company.name());
  const collectors = ["Ana Ruiz", "Tom Becker", "Priya Nair"];
  return Array.from({ length: 64 }, (_, i) => {
    const issuedDaysAgo = faker.helpers.weightedArrayElement([
      { weight: 5, value: faker.number.int({ min: 5, max: 29 }) },
      { weight: 4, value: faker.number.int({ min: 31, max: 60 }) },
      { weight: 3, value: faker.number.int({ min: 61, max: 95 }) },
      { weight: 2, value: faker.number.int({ min: 96, max: 130 }) },
      { weight: 1, value: faker.number.int({ min: 131, max: 210 }) },
    ]);
    const issuedOn = new Date(AS_OF.getTime() - issuedDaysAgo * 86_400_000);
    const dueOn = new Date(issuedOn.getTime() + 30 * 86_400_000);
    const daysOverdue = Math.max(0, Math.round((AS_OF.getTime() - dueOn.getTime()) / 86_400_000));
    const amount = faker.number.int({ min: 18, max: 420 }) * 100;
    const paid = faker.datatype.boolean({ probability: 0.2 }) ? Math.round(amount * 0.4) : 0;
    return {
      invoice: `INV-26-${String(4100 + i)}`,
      customer: faker.helpers.arrayElement(customers),
      collector: faker.helpers.arrayElement(collectors),
      issuedOn,
      dueOn,
      amount,
      paid,
      daysOverdue,
      bucket: bucketOf(daysOverdue),
      lastNote: faker.helpers.arrayElement(NOTES),
    };
  }).sort(
    // Youngest bucket first, so the aging pivot lists buckets in that order; latest within each.
    (a, b) =>
      BUCKETS.indexOf(a.bucket) - BUCKETS.indexOf(b.bucket) || b.daysOverdue - a.daysOverdue,
  );
}
