import { createShowcaseFaker } from "../../src/_shared/faker";

export type QuoteLine = {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
};

export type QuoteReview = {
  quoteId: string;
  account: {
    name: string;
    vertical: "Fintech" | "Healthcare" | "Retail" | "Manufacturing";
    legalEntity: string;
  };
  owner: {
    name: string;
    region: "AMER" | "EMEA" | "APAC";
  };
  stage: "Draft" | "Approval" | "Negotiation";
  discountRate: number;
  notes: string;
  lineItems: QuoteLine[];
};

export function createQuoteReviews(): QuoteReview[] {
  const faker = createShowcaseFaker(707);
  const stages: QuoteReview["stage"][] = ["Draft", "Approval", "Negotiation"];

  return Array.from({ length: 7 }, (_, index) => {
    const discountRate = faker.number.float({ min: 0.03, max: 0.22, fractionDigits: 2 });
    const lineItems = Array.from({ length: faker.number.int({ min: 2, max: 4 }) }, () => {
      const quantity = faker.number.int({ min: 5, max: 120 });
      const unitCost = faker.number.int({ min: 40, max: 1800 });
      const unitPrice = unitCost + faker.number.int({ min: 25, max: 900 });

      return {
        sku: faker.string.alphanumeric({ length: 8, casing: "upper" }),
        description: faker.commerce.productName(),
        quantity,
        unitPrice,
        unitCost,
      } satisfies QuoteLine;
    });

    return {
      quoteId: `QUOTE-${4100 + index}`,
      account: {
        name: faker.company.name(),
        vertical: faker.helpers.arrayElement(["Fintech", "Healthcare", "Retail", "Manufacturing"]),
        legalEntity: `${faker.company.name()} Holdings`,
      },
      owner: {
        name: faker.person.fullName(),
        region: faker.helpers.arrayElement(["AMER", "EMEA", "APAC"]),
      },
      stage: faker.helpers.arrayElement(stages),
      discountRate,
      notes: faker.helpers.arrayElement([
        "Procurement asked for commercial flexibility on the rollout phase.",
        "Services line is under margin review before approval routing.",
        "Security review is complete; pricing now depends on legal redlines.",
        "Partner delivery assumptions need sign-off before final submission.",
      ]),
      lineItems,
    } satisfies QuoteReview;
  });
}
