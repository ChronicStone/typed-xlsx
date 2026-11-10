import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vite-plus/test";

/**
 * Type error quality checks.
 *
 * Each file in `test/type-errors/` is a list of deliberate mistakes. A comment
 * `// @error <token>: <text>` says the next code line must have an error that starts at `<token>`
 * and whose message contains `<text>`. Any other error fails the test, so the valid code in these
 * files must keep compiling. Every message is also written to a snapshot, to review wording.
 */

const root = dirname(fileURLToPath(import.meta.url));
const casesDir = join(root, "type-errors");
const caseFiles = readdirSync(casesDir)
  .filter((file) => file.endsWith(".ts"))
  .map((file) => join(casesDir, file));

type Expectation = { line: number; token: string; text: string; marker: string };

function readExpectations(source: string): Expectation[] {
  const lines = source.split("\n");
  const expectations: Expectation[] = [];

  lines.forEach((line, index) => {
    const match = /\/\/ @error (\S+?): (.+)$/.exec(line);
    if (!match) return;
    let target = index + 1;
    while (target < lines.length && /^\s*\/\//.test(lines[target]!)) target += 1;
    expectations.push({
      line: target,
      token: match[1]!,
      text: match[2]!.trim(),
      marker: `${index + 1}: ${line.trim()}`,
    });
  });

  return expectations;
}

function compile() {
  const configPath = join(root, "..", "tsconfig.json");
  const config = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    },
  );
  if (!config) throw new Error("tsconfig.json could not be read");
  const program = ts.createProgram(caseFiles, { ...config.options, noEmit: true });
  return program;
}

const program = compile();

/**
 * Sorts the lists inside a message (`Options: b, a` and `"b" | "a"`). TypeScript orders a union by
 * when its members were created, so any change to the types can reshuffle them; sorted, the
 * snapshot only changes when the content does.
 */
function sortLists(message: string) {
  return message
    .replace(
      /: ([\w.]+(?:, [\w.]+)+)/g,
      (_, list: string) => `: ${list.split(", ").sort().join(", ")}`,
    )
    .replace(/"[^"]*"(?: \| "[^"]*")+/g, (union) => union.split(" | ").sort().join(" | "));
}

describe("type errors", () => {
  for (const file of caseFiles) {
    const name = file.slice(casesDir.length + 1);

    it(name, async () => {
      const sourceFile = program.getSourceFile(file)!;
      const source = sourceFile.getFullText();
      const expectations = readExpectations(source);
      const diagnostics = [
        ...program.getSyntacticDiagnostics(sourceFile),
        ...program.getSemanticDiagnostics(sourceFile),
      ];

      const found = diagnostics.map((diagnostic) => {
        const start = diagnostic.start ?? 0;
        const { line } = sourceFile.getLineAndCharacterOfPosition(start);
        return {
          line,
          at: source.slice(start, start + 40).split("\n")[0]!,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        };
      });

      const unmatched = [...found];
      const problems: string[] = [];

      for (const expectation of expectations) {
        const index = unmatched.findIndex(
          (diagnostic) =>
            diagnostic.line === expectation.line &&
            diagnostic.at.startsWith(expectation.token) &&
            diagnostic.message.includes(expectation.text),
        );
        if (index === -1) {
          const onLine = found
            .filter((diagnostic) => diagnostic.line === expectation.line)
            .map((diagnostic) => `    at "${diagnostic.at}": ${diagnostic.message}`);
          problems.push(
            `Expected error not found (line ${expectation.marker})\n` +
              (onLine.length ? onLine.join("\n") : "    no error on that line"),
          );
        } else {
          unmatched.splice(index, 1);
        }
      }

      for (const diagnostic of unmatched) {
        problems.push(
          `Unexpected error on line ${diagnostic.line + 1} at "${diagnostic.at}":\n    ${diagnostic.message}`,
        );
      }

      expect(problems.join("\n\n")).toBe("");

      const snapshot = found
        .map(
          (diagnostic) =>
            `line ${diagnostic.line + 1} at ${diagnostic.at}\n${sortLists(diagnostic.message)}`,
        )
        .join("\n\n");
      await expect(`${snapshot}\n`).toMatchFileSnapshot(
        join(casesDir, "__snapshots__", `${name.replace(/\.ts$/, "")}.txt`),
      );
    });
  }
});
