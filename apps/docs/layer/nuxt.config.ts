// @ts-nocheck
import { defineNuxtConfig } from "nuxt/config";
import { extendViteConfig, createResolver, useNuxt } from "@nuxt/kit";
import { join } from "node:path";

const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || "https://typed-xlsx.vercel.app";
const { resolve } = createResolver(import.meta.url);
const shikiOptimizeDeps = [
  "@shikijs/engine-javascript",
  "@shikijs/core",
  "@shikijs/transformers",
  "@shikijs/langs/shellscript",
  "@shikijs/langs/diff",
  "@shikijs/langs/json",
  "@shikijs/langs/javascript",
  "@shikijs/langs/typescript",
  "@shikijs/langs/html",
  "@shikijs/langs/css",
  "@shikijs/langs/vue",
  "@shikijs/langs/mdc",
  "@shikijs/langs/markdown",
  "@shikijs/langs/yaml",
  "@shikijs/langs/tsx",
  "@shikijs/themes/vitesse-light",
  "@shikijs/themes/vitesse-dark",
];

export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      siteUrl,
    },
  },
  alias: {
    "@typed-xlsx-package": resolve("../../../packages/core/src/index.ts"),
  },
  modules: [
    resolve("../../../node_modules/docus/modules/config.ts"),
    resolve("../../../node_modules/docus/modules/routing.ts"),
    resolve("../../../node_modules/docus/modules/markdown-rewrite.ts"),
    resolve("../../../node_modules/docus/modules/css.ts"),
    () => {
      const nuxt = useNuxt();
      const options = nuxt.options as typeof nuxt.options & {
        icon?: { customCollections?: Array<{ prefix: string; dir: string }> };
      };
      options.icon ||= {};
      options.icon.customCollections ||= [];
      options.icon.customCollections.push({
        prefix: "custom",
        dir: join(nuxt.options.srcDir, "assets/icons"),
      });
    },
    "@nuxt/ui",
    "nuxt-content-twoslash",
    "@nuxt/content",
    "@nuxt/image",
    "@nuxtjs/robots",
    "@nuxtjs/mcp-toolkit",
    "nuxt-og-image",
    "nuxt-llms",
    () => {
      extendViteConfig((config) => {
        config.optimizeDeps ||= {};
        config.optimizeDeps.include ||= [];
        config.optimizeDeps.include.push("@nuxt/content > slugify");
        config.optimizeDeps.include.push(...shikiOptimizeDeps);
        config.optimizeDeps.include = config.optimizeDeps.include.map((id) =>
          id.replace(/^@nuxt\/content > /, "docus > @nuxt/content > "),
        );

        if (process.env.AI_GATEWAY_API_KEY) {
          config.optimizeDeps.include.push("@vercel/oidc");
          config.optimizeDeps.include = config.optimizeDeps.include.map((id) =>
            id.replace(/^@vercel\/oidc$/, "docus > @vercel/oidc"),
          );
        }
      });
    },
  ],
  app: {
    head: {
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    },
  },
  content: {
    experimental: { sqliteConnector: "native" },
    build: {
      markdown: {
        highlight: {
          langs: [
            "bash",
            "diff",
            "json",
            "js",
            "ts",
            "html",
            "css",
            "vue",
            "shell",
            "mdc",
            "md",
            "yaml",
          ],
        },
        remarkPlugins: {
          "remark-mdc": {
            options: {
              autoUnwrap: true,
            },
          },
        },
      },
    },
  },
  mdc: {
    highlight: {
      shikiEngine: "javascript",
      theme: {
        light: "vitesse-light",
        default: "vitesse-light",
        dark: "vitesse-dark",
      },
      langs: ["ts", "tsx", "js", "json", "vue", "bash", "diff", "html", "css", "md", "yaml"],
    },
  },
  twoslash: {
    enableInDev: true,
    includeNuxtTypes: true,
  },
  experimental: {
    asyncContext: true,
  },
  compatibilityDate: "2025-07-22",
  llms: {
    domain: siteUrl,
    title: "typed-xlsx",
    description:
      "Feature-rich, type-safe Excel reporting for TypeScript with schema builders, multi-sheet exports, dynamic formatting, summaries, and reusable report composition.",
  },
  nitro: {
    prerender: {
      crawlLinks: true,
      failOnError: false,
      autoSubfolderIndex: false,
    },
    compatibilityDate: {
      vercel: "2025-07-14",
    },
    preset: "static",
  },
  hooks: {
    "nitro:config"(nitroConfig) {
      const nuxt = useNuxt();

      const i18nOptions = (
        nuxt.options as typeof nuxt.options & {
          i18n?: { locales?: Array<string | { code: string }> };
        }
      ).i18n;
      const routes: string[] = [];

      if (!i18nOptions) {
        routes.push("/");
      } else {
        routes.push(
          ...((i18nOptions.locales?.map((locale) =>
            typeof locale === "string" ? `/${locale}` : `/${locale.code}`,
          ) || []) as string[]),
        );
      }

      nitroConfig.prerender ||= {};
      nitroConfig.prerender.routes ||= [];
      nitroConfig.prerender.routes.push(...routes, "/sitemap.xml");
    },
  } as Record<string, (...args: any[]) => void>,
  icon: {
    customCollections: [
      {
        prefix: "custom",
        dir: resolve("./app/assets/icons"),
      },
    ],
    clientBundle: {
      scan: true,
      includeCustomCollections: true,
    },
    provider: "iconify",
  },
  robots: {
    groups: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: "/sitemap.xml",
  },
});
