import { createShowcaseFaker } from "../../src/_shared/faker";

export type ForecastRow = {
  repName: string;
  territory: string;
  stage: "Pipeline" | "Best Case" | "Commit";
  units: number;
  revenue: number;
  closeMonth: string;
};

export function createForecastRows(): ForecastRow[] {
  const faker = createShowcaseFaker(303);
  const stages: ForecastRow["stage"][] = ["Pipeline", "Best Case", "Commit"];

  return Array.from({ length: 10 }, () => ({
    repName: faker.person.fullName(),
    territory: `${faker.helpers.arrayElement(["AMER", "EMEA", "APAC"])} ${faker.location.city()}`,
    stage: faker.helpers.arrayElement(stages),
    units: faker.number.int({ min: 60, max: 640 }),
    revenue: faker.number.int({ min: 80000, max: 420000 }),
    closeMonth: `2026-${String(faker.number.int({ min: 2, max: 6 })).padStart(2, "0")}`,
  }));
}
