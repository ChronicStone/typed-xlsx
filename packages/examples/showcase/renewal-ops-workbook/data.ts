import { createShowcaseFaker } from "../../src/_shared/faker";

export type RenewalOpportunity = {
  account: {
    name: string;
    sponsor: {
      name: string;
      email: string;
    };
  };
  csm: {
    name: string;
    pod: string;
  };
  segment: "Enterprise" | "Growth" | "Mid-Market";
  renewalDate: Date;
  currentArr: number;
  targetArr: number;
  confidence: "Commit" | "Best Case" | "Risk";
  forecastCategory: "Renew" | "Expand" | "At Risk";
  openTickets: number;
  sponsorEmail: string;
  riskNotes: string;
};

function day(month: number, date: number) {
  return new Date(Date.UTC(2026, month, date));
}

export function createRenewalOpportunities(): RenewalOpportunity[] {
  const faker = createShowcaseFaker(404);
  const segments: RenewalOpportunity["segment"][] = ["Enterprise", "Growth", "Mid-Market"];
  const confidences: RenewalOpportunity["confidence"][] = ["Commit", "Best Case", "Risk"];
  const categories: RenewalOpportunity["forecastCategory"][] = ["Renew", "Expand", "At Risk"];

  return Array.from({ length: 14 }, () => {
    const currentArr = faker.number.int({ min: 120000, max: 1300000 });
    const targetArr = Math.max(80000, currentArr + faker.number.int({ min: -90000, max: 180000 }));

    return {
      account: {
        name: faker.company.name(),
        sponsor: {
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
        },
      },
      csm: {
        name: faker.person.fullName(),
        pod: faker.helpers.arrayElement(["Strategic", "Scale", "Growth"]),
      },
      segment: faker.helpers.arrayElement(segments),
      renewalDate: day(faker.number.int({ min: 2, max: 7 }), faker.number.int({ min: 4, max: 26 })),
      currentArr,
      targetArr,
      confidence: faker.helpers.arrayElement(confidences),
      forecastCategory: faker.helpers.arrayElement(categories),
      openTickets: faker.number.int({ min: 0, max: 12 }),
      sponsorEmail: faker.internet.email().toLowerCase(),
      riskNotes: faker.helpers.arrayElement([
        "Expansion depends on rollout adoption staying on track.",
        "Commercial path is healthy but services scope still needs approval.",
        "Sponsor transition increases uncertainty despite solid usage.",
        "Ticket volume is elevated and needs operational follow-up before the renewal call.",
      ]),
    } satisfies RenewalOpportunity;
  });
}
