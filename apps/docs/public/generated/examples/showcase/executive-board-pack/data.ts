import { createShowcaseFaker } from "../../src/_shared/faker";

export type ExecutiveAccount = {
  accountName: string;
  region: "AMER" | "EMEA" | "APAC";
  sector: "Fintech" | "Healthcare" | "Retail" | "Manufacturing";
  csm: string;
  arr: number;
  expansionRatio: number;
  nrr: number;
  seatsPurchased: number;
  seatsActivated: number;
  healthScore: number;
  nextRenewalDate: Date;
  executiveSummary: string;
};

function month(monthIndex: number, day: number) {
  return new Date(Date.UTC(2026, monthIndex, day));
}

export function createExecutiveAccounts(): ExecutiveAccount[] {
  const faker = createShowcaseFaker(101);
  const accountNames = [
    "Northstar Payments",
    "Bluebird Health",
    "Delta Retail Group",
    "Cinder Labs",
    "Atlas Commerce",
    "Meridian Bio",
  ];
  const regions: ExecutiveAccount["region"][] = ["AMER", "EMEA", "APAC"];
  const sectors: ExecutiveAccount["sector"][] = [
    "Fintech",
    "Healthcare",
    "Retail",
    "Manufacturing",
  ];

  return accountNames.map((accountName, index) => {
    const arr = faker.number.int({ min: 300000, max: 1200000 });
    const seatsPurchased = faker.number.int({ min: 420, max: 2200 });
    const seatsActivated = faker.number.int({
      min: Math.floor(seatsPurchased * 0.65),
      max: seatsPurchased,
    });

    return {
      accountName,
      region: regions[index % regions.length]!,
      sector: faker.helpers.arrayElement(sectors),
      csm: faker.person.fullName(),
      arr,
      expansionRatio: faker.number.float({ min: 0.03, max: 0.24, fractionDigits: 2 }),
      nrr: faker.number.float({ min: 0.94, max: 1.2, fractionDigits: 2 }),
      seatsPurchased,
      seatsActivated,
      healthScore: faker.number.int({ min: 58, max: 96 }),
      nextRenewalDate: month(1 + index, faker.number.int({ min: 8, max: 24 })),
      executiveSummary: faker.helpers.arrayElement([
        "Expansion path tied to a live rollout and executive sponsorship.",
        "Healthy usage trend, but commercial alignment still needs work before renewal.",
        "Operational adoption is strong and the account is positioned for expansion.",
        "Risk is manageable if onboarding debt is reduced before procurement review.",
      ]),
    } satisfies ExecutiveAccount;
  });
}
