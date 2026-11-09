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
    overrides: [
      {
        files: ["packages/core/test/type-safety.ts", "packages/core/test/stream-api.test.ts"],
        rules: {
          // Type assertions use underscores for intentionally unused bindings.
          "no-underscore-dangle": "off",
        },
      },
      {
        files: [
          "apps/docs/app/app.vue",
          "apps/docs/layer/app/app.vue",
          "apps/docs/layer/app/error.vue",
        ],
        rules: {
          // The active locale selects a Nuxt UI translation at runtime.
          "import/namespace": ["error", { allowComputed: true }],
        },
      },
    ],
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
