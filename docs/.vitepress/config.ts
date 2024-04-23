import { defineConfig } from 'vitepress'
import { transformerTwoslash } from 'vitepress-plugin-twoslash'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Typed-xlsx',
  description: 'Documentation of typed-xlsx library',
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    codeTransformers: [
      transformerTwoslash(),
    ],
  },
  lastUpdated: true,
  ignoreDeadLinks: true,
  cleanUrls: true,
  titleTemplate: ':title - Typed-xlsx',
  themeConfig: {
    editLink: {
      pattern: 'https://github.com/ChronicStone/typed-xlsx/edit/main/:path',
      text: 'Edit this page on GitHub',
    },
    search: { provider: 'local' },
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Documentation', link: '/getting-started/key-benefits-why' },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ChronicStone/typed-xlsx' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2023-present Cyprien THAO',
    },
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Key Benefits & Why', link: '/getting-started/key-benefits-why' },
          { text: 'Installation', link: '/getting-started/installation' },
        ],
      },
      {
        text: 'Schema Builder',
        items: [
          { text: 'Columns', link: '/schema-builder/columns' },
          { text: 'Dynamic Columns', link: '/schema-builder/dynamic-columns' },
          { text: 'Global Transformers', link: '/schema-builder/global-transformers' },
          { text: 'Build Schema', link: '/schema-builder/build-schema' },
        ],
      },
      {
        text: 'Column Definition',
        items: [
          { text: 'Header', link: '/column-definition/header' },
          { text: 'Value Transformation', link: '/column-definition/value-transformation' },
          { text: 'Key & Value', link: '/column-definition/key-value' },
          { text: 'Default Value', link: '/column-definition/default-value' },
          { text: 'Cell Format', link: '/column-definition/cell-format' },
          { text: 'Cell Style', link: '/column-definition/cell-style' },
          { text: 'Summary', link: '/column-definition/summary' },
        ],
      },
      {
        text: 'File Builder',
        items: [
          { text: 'Define Sheets', link: '/file-builder/define-sheets' },
          { text: 'Define Tables', link: '/file-builder/define-tables' },
        ],
      },
    ],
  },
})
