import { createShowcaseFaker } from "../../src/_shared/faker";

export type TerritoryRow = {
  territory: string;
  manager: string;
  quarter: "Q1" | "Q2";
  revenueByRegion: Record<string, number>;
};

export function createTerritoryRows(): TerritoryRow[] {
  const faker = createShowcaseFaker(505);
  const quarters: TerritoryRow["quarter"][] = ["Q1", "Q2"];
  const territories = [
    "Enterprise East",
    "Strategic EMEA",
    "Growth APAC",
    "Majors West",
    "Mid-Market North",
  ];

  return territories.map((territory) => ({
    territory,
    manager: faker.person.fullName(),
    quarter: faker.helpers.arrayElement(quarters),
    revenueByRegion: {
      AMER: faker.number.int({ min: 70000, max: 480000 }),
      EMEA: faker.number.int({ min: 70000, max: 420000 }),
      APAC: faker.number.int({ min: 70000, max: 320000 }),
    },
  }));
}
