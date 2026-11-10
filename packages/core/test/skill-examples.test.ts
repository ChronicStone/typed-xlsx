import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vite-plus/test";

/**
 * The agent skill shipped in `skills/` is read by coding agents, which copy its examples. Every
 * ```ts block in it is compiled here against the current source, so an example that stops
 * compiling fails the build. A block that is deliberately partial is fenced as ```ts nocheck.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = join(root, "skills");

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

type Example = { file: string; line: number; code: string; virtualPath: string };

function readExamples(file: string): Example[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const examples: Example[] = [];
  let start = -1;
  let checked = false;

  lines.forEach((line, index) => {
    const fence = /^```(\S*)\s*(.*)$/.exec(line);
    if (!fence) return;
    if (start === -1) {
      start = index;
      checked = fence[1] === "ts" && !/\bnocheck\b/.test(fence[2] ?? "");
      return;
    }
    if (checked) {
      const name = relative(skillsDir, file).replace(/[^\w]+/g, "-");
      examples.push({
        file,
        line: start + 1,
        code: lines.slice(start + 1, index).join("\n"),
        virtualPath: join(root, "test", ".skill-examples", `${name}-${start + 1}.ts`),
      });
    }
    start = -1;
  });

  return examples;
}

const examples = markdownFiles(skillsDir).flatMap(readExamples);

function compile() {
  const config = ts.getParsedCommandLineOfConfigFile(
    join(root, "tsconfig.json"),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    },
  );
  if (!config) throw new Error("tsconfig.json could not be read");

  const virtual = new Map(examples.map((example) => [example.virtualPath, example.code]));
  const options = { ...config.options, noEmit: true, noUnusedLocals: false };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (path) => virtual.has(path) || ts.sys.fileExists(path);
  host.readFile = (path) => virtual.get(path) ?? ts.sys.readFile(path);
  host.getSourceFile = (path, languageVersion, onError, shouldCreate) => {
    const code = virtual.get(path);
    return code === undefined
      ? getSourceFile(path, languageVersion, onError, shouldCreate)
      : ts.createSourceFile(path, code, languageVersion, true);
  };

  return ts.createProgram([...virtual.keys()], options, host);
}

describe("skill examples", () => {
  it("finds examples to check", () => {
    expect(examples.length).toBeGreaterThan(20);
  });

  const program = compile();

  for (const example of examples) {
    it(`${relative(root, example.file)}:${example.line}`, () => {
      const sourceFile = program.getSourceFile(example.virtualPath)!;
      const problems = [
        ...program.getSyntacticDiagnostics(sourceFile),
        ...program.getSemanticDiagnostics(sourceFile),
      ].map((diagnostic) => {
        const { line } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        return `line ${example.line + line + 1}: ${message}`;
      });
      expect(problems.join("\n")).toBe("");
    });
  }
});
