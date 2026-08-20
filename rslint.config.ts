import { defineConfig, globals, js, ts } from '@rslint/core';

export default defineConfig([
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
  {
    files: ['example/**/*'],
    rules: {
      'no-undef': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: globals.rstest,
    },
  },
  {
    files: ['test/fixtures/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.rstest,
      },
    },
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
      },
    },
  },
]);
