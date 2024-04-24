import { defineConfig } from 'vitepress'
import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import container from 'markdown-it-container'
import { renderSandbox } from 'vitepress-plugin-sandpack'
import Unocss from 'unocss/vite'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Typed-xlsx',
  sitemap: {
    hostname: 'https://typed-xlsx.vercel.app',
  },
  description: 'Documentation of typed-xlsx library',
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    codeTransformers: [
      transformerTwoslash(),
    ],
    config(md) {
      md
        .use(container, 'sandbox', {
          render(tokens, idx) {
            return renderSandbox(tokens, idx, 'sandbox')
          },
        })
        .use(container, 'code-sandbox', {
          render(tokens, idx) {
            return renderSandbox(tokens, idx, 'code-sandbox')
          },
        })
    },
  },
  lastUpdated: true,
  ignoreDeadLinks: true,
  cleanUrls: false,
  titleTemplate: 'Typed-xlsx | :title',
  head: [
    ['meta', { name: 'google-site-verification', content: 'DPVOPrsgdIJ4_xJYhy6Azw6vGw51riJiJoaT7SBTARc' }],
    ['link', { rel: 'shortcut icon', href: '/favicon.ico' }],
    ['meta', { property: 'og:type', content: 'website' }],
  ],
  themeConfig: {
    logo: '/images/logo.png',
    editLink: {
      pattern: 'https://github.com/ChronicStone/typed-xlsx/edit/main/docs/:path',
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
          { text: 'Create schema', link: '/schema-builder/create-schema' },
          { text: 'Define columns', link: '/schema-builder/columns' },
          { text: 'Dynamic Columns', link: '/schema-builder/dynamic-columns' },
          { text: 'Global Transformers', link: '/schema-builder/global-transformers' },
          { text: 'Build Schema', link: '/schema-builder/build-schema' },
        ],
      },
      {
        text: 'File Builder',
        items: [
          { text: 'Create file builder', link: '/file-builder/create-file-builder' },
          { text: 'Define Sheets', link: '/file-builder/define-sheets' },
          { text: 'Define Tables', link: '/file-builder/define-tables' },
          { text: 'Build excel file', link: '/file-builder/build-excel-file' },
        ],
      },
    ],
  },
  vite: {
    plugins: [
      // @ts-expect-error unknown ts issue
      Unocss({}),
    ],
  },
})
