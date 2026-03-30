import { createWorkbookStream } from "../../src";
import { chunkKitchenSinkOrders } from "./data";
import { kitchenSinkSchema } from "./schema";

export async function buildKitchenSinkStreamExample() {
  const workbook = createWorkbookStream({
    tempStorage: "memory",
  });

  const table = await workbook.sheet("Kitchen Sink Stream").table({
    id: "orders",
    schema: kitchenSinkSchema,
  });

  for (const rows of chunkKitchenSinkOrders(2)) {
    await table.commit({ rows });
  }

  const readable = workbook.toNodeReadable();
  const chunks: Buffer[] = [];

  for await (const chunk of readable) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
