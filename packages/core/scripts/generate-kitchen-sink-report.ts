import fs from "node:fs";
import path from "node:path";
import { buildKitchenSinkBufferedExample } from "../test/fixtures/kitchen-sink/buffered";

const outputPath = path.resolve(import.meta.dirname, "../examples/playground.xlsx");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, buildKitchenSinkBufferedExample());

console.log(`Generated ${outputPath}`);
