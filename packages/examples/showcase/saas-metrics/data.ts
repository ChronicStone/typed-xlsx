import { createShowcaseFaker } from "../../src/_shared/faker";

export const MONTHS = [
  "Oct 25",
  "Nov 25",
  "Dec 25",
  "Jan 26",
  "Feb 26",
  "Mar 26",
  "Apr 26",
  "May 26",
  "Jun 26",
  "Jul 26",
  "Aug 26",
  "Sep 26",
];

export type Plan = "Starter" | "Growth" | "Scale" | "Enterprise";

export type BridgeRow = {
  month: string;
  opening: number;
  newMrr: number;
  expansion: number;
  contraction: number;
  churn: number;
};

export type PlanRow = {
  plan: Plan;
  customers: number;
  mrrByMonth: Record<string, number>;
};

export type AccountRow = {
  account: string;
  crmId: string;
  plan: Plan;
  owner: string;
  mrr: number;
  seats: number;
  activeSeats: number;
  health: "Healthy" | "Watch" | "At risk";
  renewsOn: Date;
  qbrDone: boolean;
};

/** Twelve months of MRR movements. Opening MRR chains from the previous closing in TypeScript. */
export function createBridge(): BridgeRow[] {
  const faker = createShowcaseFaker(1701);
  let opening = 1_284_000;
  return MONTHS.map((month, i) => {
    const newMrr = Math.round(faker.number.int({ min: 58_000, max: 84_000 }) * (1 + i * 0.03));
    const expansion = Math.round(faker.number.int({ min: 26_000, max: 41_000 }) * (1 + i * 0.02));
    const contraction = faker.number.int({ min: 6_000, max: 14_000 });
    const churn = faker.number.int({ min: 14_000, max: i === 6 ? 52_000 : 31_000 });
    const row = { month, opening, newMrr, expansion, contraction, churn };
    opening = opening + newMrr + expansion - contraction - churn;
    return row;
  });
}

export function createPlans(): PlanRow[] {
  const faker = createShowcaseFaker(1702);
  const plans: Array<[Plan, number, number, number]> = [
    // plan, customers, starting MRR, monthly growth
    ["Starter", 1840, 182_000, 0.012],
    ["Growth", 612, 398_000, 0.031],
    ["Scale", 141, 421_000, 0.038],
    ["Enterprise", 38, 283_000, 0.052],
  ];
  return plans.map(([plan, customers, start, growth]) => {
    let mrr = start;
    const mrrByMonth: Record<string, number> = {};
    for (const m of MONTHS) {
      mrrByMonth[m] = Math.round(mrr);
      mrr *= 1 + growth + faker.number.float({ min: -0.015, max: 0.015 });
    }
    return { plan, customers, mrrByMonth };
  });
}

export function createAccounts(): AccountRow[] {
  const faker = createShowcaseFaker(1703);
  const plans: Plan[] = ["Enterprise", "Enterprise", "Scale", "Scale", "Growth"];
  return Array.from({ length: 24 }, () => {
    const plan = faker.helpers.arrayElement(plans);
    const seats =
      plan === "Enterprise"
        ? faker.number.int({ min: 400, max: 2400 })
        : faker.number.int({ min: 60, max: 480 });
    const usage = faker.number.float({ min: 0.31, max: 0.97 });
    const health = usage > 0.72 ? "Healthy" : usage > 0.5 ? "Watch" : "At risk";
    const name = faker.company.name();
    return {
      account: name,
      crmId: `0016g00000${faker.string.alphanumeric({ length: 8, casing: "upper" })}`,
      plan,
      owner: `${faker.person.firstName()} ${faker.person.lastName()}`,
      mrr: Math.round(seats * (plan === "Enterprise" ? 38 : plan === "Scale" ? 31 : 24)),
      seats,
      activeSeats: Math.round(seats * usage),
      health,
      renewsOn: new Date(
        Date.UTC(
          2026,
          faker.number.int({ min: 9, max: 20 }) % 12,
          faker.number.int({ min: 1, max: 28 }),
        ),
      ),
      qbrDone: faker.datatype.boolean({ probability: 0.6 }),
    } satisfies AccountRow;
  }).sort((a, b) => b.mrr - a.mrr);
}
