import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    ignorePatterns: ["build/**", "node_modules/**"],
    options: {
      denyWarnings: true,
      typeAware: false,
      typeCheck: false,
    },
  },
  fmt: {
    ignorePatterns: ["build/**", "node_modules/**"],
  },
  pack: {
    clean: true,
    dts: true,
    entry: ["./src/index.ts"],
    fixedExtension: false,
    format: "esm",
    minify: "dce-only",
    outDir: "./build",
    sourcemap: false,
    target: "es2022",
    treeshake: false,
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
