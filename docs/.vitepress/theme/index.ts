import DefaultTheme from 'vitepress/theme'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import '@shikijs/vitepress-twoslash/style.css'
import type { EnhanceAppContext } from 'vitepress'
import './style.css'

import vitepressNprogress from 'vitepress-plugin-nprogress'
import 'vitepress-plugin-nprogress/lib/css/index.css'
import 'uno.css'

export default {
  ...DefaultTheme,
  enhanceApp(ctx: EnhanceAppContext) {
    ctx.app.use(TwoslashFloatingVue)
    DefaultTheme.enhanceApp?.(ctx)
    vitepressNprogress(ctx)
    // ctx.app.component('Sandbox', Sandbox)
    // ctx.app.component('CodeSandbox', CodeSandbox)
  },
}
