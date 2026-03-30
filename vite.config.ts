import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    plugins: ["import", "node"],
    categories: {
      correctness: "error",
      suspicious: "error",
    },
    env: {
      builtin: true,
    },
    ignorePatterns: [
      ".repo-migration/**",
      "docs/.data/**",
      "docs/.nuxt/**",
      "docs/.output/**",
      "docs/node_modules/**",
      "node_modules/**",
      "packages/*/build/**",
    ],
    options: {
      denyWarnings: true,
      typeAware: false,
      typeCheck: false,
    },
  },
  fmt: {
    ignorePatterns: [
      ".repo-migration/**",
      "docs/.data/**",
      "docs/.nuxt/**",
      "docs/.output/**",
      "docs/node_modules/**",
      "node_modules/**",
      "packages/*/build/**",
    ],
  },
});
