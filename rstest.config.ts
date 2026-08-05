import { defineConfig } from '@rstest/core'

export default defineConfig({
  globals: true,
  testTimeout: 10_000,
  output: {
    externals: {
      'rspack-vue-loader': `commonjs ../dist/index.js`,
    },
  },
})
