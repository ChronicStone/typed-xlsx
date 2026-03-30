import fs from "node:fs";
import path from "node:path";

const reportDir = path.resolve(process.cwd(), ".reports/vitest");
const jsonPath = path.join(reportDir, "results.json");
const markdownPath = path.join(reportDir, "SUMMARY.md");

if (!fs.existsSync(jsonPath)) {
  console.error(`Missing JSON report at ${jsonPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const lines = [
  "# Test Summary",
  "",
  `- Success: ${report.success ? "yes" : "no"}`,
  `- Test suites: ${report.numPassedTestSuites}/${report.numTotalTestSuites} passed`,
  `- Tests: ${report.numPassedTests}/${report.numTotalTests} passed`,
  `- Failed tests: ${report.numFailedTests}`,
  "",
  "## Suites",
  "",
];

for (const suite of report.testResults ?? []) {
  const assertions = suite.assertionResults ?? [];
  const passed = assertions.filter((item) => item.status === "passed").length;
  const failed = assertions.filter((item) => item.status === "failed").length;

  lines.push(`- ${path.basename(suite.name)}: ${passed} passed, ${failed} failed`);
}

lines.push("");

fs.writeFileSync(markdownPath, lines.join("\n"));
