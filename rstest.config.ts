import { defineConfig } from '@rstest/core';

export default defineConfig({
  globals: true,
  output: {
    externals: {
      'rspack-vue-loader': `commonjs ../dist/index.js`,
    },
  },
});
