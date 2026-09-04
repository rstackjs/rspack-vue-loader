// Configuration guide: https://rstack.rs/config
import { define } from 'rstack'

define.test({
  globals: true,
  testTimeout: 10_000,
  output: {
    externals: {
      'rspack-vue-loader': 'commonjs ../dist/index.js',
    },
  },
})

define.fmt({
  ignorePatterns: ['test/fixtures/**'],
  semi: false,
  singleQuote: true,
  trailingComma: 'es5',
})

define.staged({
  '*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}': ['rs lint', 'rs fmt'],
  '*.{json,jsonc,md,mdx,css,scss,less,html,vue,yml,yaml}': 'rs fmt',
})

define.lint(({ js, ts }) => [
  js.configs.recommended,
  ts.configs.recommended,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-this-alias': 'off',
    },
  },
])
