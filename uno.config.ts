import { defineConfig, presetTypography, presetUno, presetWebFonts, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetTypography(),
    presetWebFonts({
      provider: 'fontshare',
      fonts: {
        satoshi: 'Satoshi',
      },
    }),
  ],
  transformers: [
    transformerVariantGroup(),
    transformerDirectives({
      applyVariable: ['--at-apply', '--uno-apply', '--uno'],
    }),
  ],
  theme: {
    colors: {
      primary: '#FF9600',
    },
  },
  rules: [['h-layout', { height: 'calc(100vh - 4rem)' }]],
})
