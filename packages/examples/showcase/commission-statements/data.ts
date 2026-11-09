import { createShowcaseFaker } from "../../src/_shared/faker";

export type Team = "Enterprise" | "Mid-Market" | "SMB";

export type Rep = {
  rep: string;
  email: string;
  team: Team;
  quota: number;
  closedWon: number;
  deals: number;
  spiffs: number;
};

export type Deal = {
  opportunity: string;
  oppId: string;
  rep: string;
  account: string;
  closedOn: Date;
  type: "New business" | "Expansion" | "Renewal";
  amount: number;
};

/** Q3 2026 bookings per rep, with every deal behind them. */
export function createCommissionData() {
  const faker = createShowcaseFaker(7272);
  const teams: Array<[Team, number]> = [
    ["Enterprise", 900_000],
    ["Mid-Market", 520_000],
    ["SMB", 260_000],
  ];
  const reps: Rep[] = [];
  const deals: Deal[] = [];
  for (const [team, quota] of teams) {
    for (let i = 0; i < 4; i++) {
      const name = `${faker.person.firstName()} ${faker.person.lastName()}`;
      const attainment = faker.number.float({ min: 0.48, max: 1.42 });
      const target = quota * attainment;
      let booked = 0;
      let count = 0;
      while (booked < target) {
        const amount =
          Math.round(
            Math.min(
              target - booked + 5000,
              faker.number.int({ min: quota / 18, max: quota / 4 }),
            ) / 100,
          ) * 100;
        const account = faker.company.name();
        deals.push({
          opportunity: `${account} · ${faker.helpers.arrayElement(["Platform", "Analytics", "Seats"])}`,
          oppId: `0066g00000${faker.string.alphanumeric({ length: 8, casing: "upper" })}`,
          rep: name,
          account,
          closedOn: new Date(
            Date.UTC(
              2026,
              6 + faker.number.int({ min: 0, max: 2 }),
              faker.number.int({ min: 1, max: 28 }),
            ),
          ),
          type: faker.helpers.weightedArrayElement([
            { weight: 5, value: "New business" as const },
            { weight: 3, value: "Expansion" as const },
            { weight: 2, value: "Renewal" as const },
          ]),
          amount,
        });
        booked += amount;
        count++;
      }
      reps.push({
        rep: name,
        email: faker.internet
          .email({ firstName: name.split(" ")[0], provider: "example.com" })
          .toLowerCase(),
        team,
        quota,
        closedWon: booked,
        deals: count,
        spiffs: faker.helpers.arrayElement([0, 0, 500, 1000, 2500]),
      });
    }
  }
  return {
    reps: reps.sort((a, b) => b.closedWon / b.quota - a.closedWon / a.quota),
    deals: deals.sort((a, b) => a.closedOn.getTime() - b.closedOn.getTime()),
  };
}
