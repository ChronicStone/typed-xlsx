// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      '*.md',
    ],
  },
  {
    rules: {
      'line-comment-position': 'off',
    },
  },
)
