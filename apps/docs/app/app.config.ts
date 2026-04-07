export default defineAppConfig({
  docus: {
    name: "typed-xlsx - Documentation",
    description:
      "Type-safe, schema-driven Excel reporting for TypeScript with typed formulas, native Excel tables, and streaming exports.",
    url: "https://typed-xlsx.vercel.app",
  },
  seo: {
    titleTemplate: "%s - typed-xlsx",
    title: "typed-xlsx",
    description:
      "Type-safe, schema-driven Excel reporting for TypeScript with typed formulas, native Excel tables, and streaming exports.",
  },
  github: {
    owner: "ChronicStone",
    name: "typed-xlsx",
    url: "https://github.com/ChronicStone/typed-xlsx",
    branch: "main",
  },
  header: {
    title: "typed-xlsx",
    logo: {
      alt: "typed-xlsx",
      light: "/logo-light.svg",
      dark: "/logo-dark.svg",
      class: "h-8 md:h-9 w-auto",
      wordmark: {
        light: "/wordmark-light.svg",
        dark: "/wordmark-dark.svg",
      },
      display: "wordmark",
      favicon: "/favicon.svg",
    },
  },
  ui: {
    colors: {
      primary: "green",
      neutral: "stone",
    },
    contentNavigation: {
      slots: {
        linkLeadingIcon: "size-4 mr-1.5",
        linkTrailing: "hidden",
      },
      defaultVariants: {
        variant: "link",
      },
    },
    pageHero: {
      slots: {
        title: "max-w-4xl text-balance text-5xl font-semibold sm:text-6xl",
        description: "max-w-3xl text-pretty text-lg text-toned sm:text-xl",
      },
    },
    pageCard: {
      slots: {
        root: "rounded-2xl",
        title: "text-balance text-lg font-semibold",
        description: "text-pretty",
      },
    },
  },
  socials: {
    github: "https://github.com/ChronicStone/typed-xlsx",
  },
});
