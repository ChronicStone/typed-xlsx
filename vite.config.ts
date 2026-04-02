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
      "apps/docs/.data/**",
      "apps/docs/.nuxt/**",
      "apps/docs/.output/**",
      "apps/docs/node_modules/**",
      "node_modules/**",
      "packages/*/build/**",
      "packages/*/artifacts/**",
      "packages/*/generated/**",
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
      "apps/docs/.data/**",
      "apps/docs/.nuxt/**",
      "apps/docs/.output/**",
      "apps/docs/node_modules/**",
      "node_modules/**",
      "packages/*/build/**",
      "packages/*/artifacts/**",
      "packages/*/generated/**",
    ],
  },
});
