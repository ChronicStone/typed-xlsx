export default defineAppConfig({
  docus: {
    name: "Typed-xlsx - Documentation",
    description:
      "Feature-rich, type-safe Excel reporting for TypeScript with schema builders, multi-sheet exports, dynamic formatting, summaries, and reusable report composition.",
    url: "https://typed-xlsx.vercel.app",
  },
  seo: {
    titleTemplate: "%s - Typed-xlsx",
    title: "Typed-xlsx",
    description:
      "Feature-rich, type-safe Excel reporting for TypeScript with schema builders, multi-sheet exports, dynamic formatting, summaries, and reusable report composition.",
  },
  github: {
    owner: "ChronicStone",
    name: "typed-xlsx",
    url: "https://github.com/ChronicStone/typed-xlsx",
    branch: "main",
  },
  header: {
    title: "Typed-xlsx",
    logo: {
      alt: "Typed-xlsx",
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
