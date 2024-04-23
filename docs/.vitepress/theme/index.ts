import DefaultTheme from 'vitepress/theme'
import TwoslashFloatingVue from 'vitepress-plugin-twoslash/client'
import 'vitepress-plugin-twoslash/style.css'
import type { EnhanceAppContext } from 'vitepress'
import './style.css'
import 'vitepress-plugin-sandpack/dist/style.css'
import { Sandbox } from 'vitepress-plugin-sandpack'
import vitepressNprogress from 'vitepress-plugin-nprogress'
import CodeSandbox from './components/CodeSandbox.vue'
import 'vitepress-plugin-nprogress/lib/css/index.css'
import 'uno.css'

export default {
  ...DefaultTheme,
  enhanceApp(ctx: EnhanceAppContext) {
    ctx.app.use(TwoslashFloatingVue)
    DefaultTheme.enhanceApp?.(ctx)
    vitepressNprogress(ctx)
    ctx.app.component('Sandbox', Sandbox)
    ctx.app.component('CodeSandbox', CodeSandbox)
  },
}
