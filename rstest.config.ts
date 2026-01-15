import { defineConfig } from '@rstest/core';

const __dirname = new URL('.', import.meta.url).pathname;

export default defineConfig({
  root: __dirname,
  globals: true,
  output: {
    externals: {
      'rspack-vue-loader': `commonjs ${__dirname}/dist/index.js`,
    },
  },
  disableConsoleIntercept: true,
});
