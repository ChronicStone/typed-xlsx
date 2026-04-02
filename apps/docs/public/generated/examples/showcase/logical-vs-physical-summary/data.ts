export type LogicalPhysicalRow = {
  customer: string;
  segment: "Startup" | "Enterprise";
  monthlyAmounts: number[];
};

export function createLogicalPhysicalRows(): LogicalPhysicalRow[] {
  return [
    {
      customer: "Northwind Labs",
      segment: "Startup",
      monthlyAmounts: [10, 20, 30],
    },
    {
      customer: "Helios Systems",
      segment: "Enterprise",
      monthlyAmounts: [100, 200],
    },
    {
      customer: "Pinecrest Health",
      segment: "Enterprise",
      monthlyAmounts: [80, 120, 140, 160],
    },
  ];
}
