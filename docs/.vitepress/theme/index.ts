import DefaultTheme from 'vitepress/theme'
import TwoslashFloatingVue from 'vitepress-plugin-twoslash/client'
import 'vitepress-plugin-twoslash/style.css'
import type { EnhanceAppContext } from 'vitepress'
import './style.css'

export default {
  ...DefaultTheme,
  enhanceApp({ app }: EnhanceAppContext) {
    app.use(TwoslashFloatingVue)
  },
}
