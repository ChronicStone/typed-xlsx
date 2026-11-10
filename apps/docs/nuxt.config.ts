export default defineNuxtConfig({
  extends: ["./layer"],
  // Vercel Web Analytics: cookieless page views, read in the Vercel dashboard (Analytics tab).
  // Free on the Hobby plan up to 50k events a month; collects nothing outside Vercel deployments.
  modules: ["@vercel/analytics/nuxt"],
  vue: {
    runtimeCompiler: true,
  },
  site: {
    name: "typed-xlsx",
    url: "https://typed-xlsx.vercel.app",
  },
  // The docs deploy as static files, so there is no server to answer /mcp. Keeping the module on
  // would advertise a dead MCP endpoint in llms.txt.
  mcp: { enabled: false },
  // pages moved or removed over the docs restructures keep their old URLs (and search rankings) working.
  // Keep in sync with the `redirects` in the root vercel.json, which serves them as real 301s in production.
  routeRules: {
    "/formulas/row-model": { redirect: { to: "/core-concepts/row-model", statusCode: 301 } },
    "/formulas/summary-formulas": { redirect: { to: "/columns/summary-rows", statusCode: 301 } },
    "/getting-started/key-benefits-and-why": {
      redirect: { to: "/getting-started/introduction", statusCode: 301 },
    },
    "/schema-builder/create-schema": {
      redirect: { to: "/columns/defining-columns", statusCode: 301 },
    },
    "/schema-builder/build-schema": {
      redirect: { to: "/columns/defining-columns", statusCode: 301 },
    },
    "/schema-builder/columns": { redirect: { to: "/columns/defining-columns", statusCode: 301 } },
    "/schema-builder/dynamic-columns": {
      redirect: { to: "/columns/dynamic-columns", statusCode: 301 },
    },
    "/schema-builder/reusable-formatters": {
      redirect: { to: "/columns/defining-columns", statusCode: 301 },
    },
    "/schema-builder/reusable-transformers": {
      redirect: { to: "/columns/defining-columns", statusCode: 301 },
    },
    "/file-builder/create-file-builder": {
      redirect: { to: "/workbook/building-workbooks", statusCode: 301 },
    },
    "/file-builder/define-sheets": {
      redirect: { to: "/workbook/building-workbooks", statusCode: 301 },
    },
    "/file-builder/define-tables": {
      redirect: { to: "/workbook/building-workbooks", statusCode: 301 },
    },
    "/file-builder/build-excel-file": {
      redirect: { to: "/workbook/building-workbooks", statusCode: 301 },
    },
  },
});
