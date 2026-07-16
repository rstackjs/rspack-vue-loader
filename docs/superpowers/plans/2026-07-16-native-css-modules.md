# Native CSS Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Support Vue SFC CSS Modules with Rspack native CSS while preserving the css-loader path, Vue style transforms, HMR, emitted CSS, code splitting, source maps, and SSR exports-only behavior.

**Architecture:** Run all integration tests through `@rspack/core`. In native mode, let the inline match-resource request finish normally, add plugin-owned rules for Vue style post-processing and `css/module` typing, and generate CSS Module bindings from namespace imports so both css-loader and native exports work.

**Tech Stack:** TypeScript, @rspack/core 1.x, @vue/compiler-sfc, Rstest, JSDOM, memfs, css-loader/style-loader, Sass.

## Global Constraints

- Keep the existing css-loader behavior and custom-element inline-style rejection.
- Native CSS requires both `experiments.css` and `experimentalInlineMatchResource`.
- Vue post-processing must run after preprocessors and before the native CSS parser.
- Ordinary Vue styles retain the user's `css` or `css/auto` type; only module style queries become `css/module`.
- GitHub changes are pushed directly to `origin`; do not rebase or amend.
- Skip unrelated storage/native-watcher tests; this repository has none in its test suite.

---

### Task 1: Run the existing suite with Rspack

**Files:**

- Modify: `test/utils.ts`
- Modify: `test/advanced.spec.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: existing `bundle()` and `mockBundleAndRun()` test APIs.
- Produces: the same APIs backed by `@rspack/core`, plus Sass loader dependencies for native SCSS coverage.

- [x] **Step 1: Replace the webpack compiler import**

Change `test/utils.ts` to import the compiler and configuration types from `@rspack/core`, while retaining the existing helper signatures and memfs output filesystem.

- [x] **Step 2: Adapt extraction tests to Rspack**

Use Rspack-compatible extraction APIs or configuration where the old webpack-only plugin integration differs. Preserve assertions for emitted CSS and split CSS chunks in loader mode.

- [x] **Step 3: Add Sass test dependencies**

Run:

```bash
pnpm add -D sass sass-loader
```

Expected: `package.json` and `pnpm-lock.yaml` contain `sass` and `sass-loader` dev dependencies.

- [x] **Step 4: Verify the migrated baseline**

Run:

```bash
pnpm test
```

Expected: the existing 46 tests pass under `@rspack/core`, with the existing skips and todos unchanged.

- [x] **Step 5: Commit**

```bash
git add test/utils.ts test/advanced.spec.ts package.json pnpm-lock.yaml
git commit -m "test: run loader suite with rspack"
```

### Task 2: Add failing native CSS Modules integration tests

**Files:**

- Create: `test/nativeCss.spec.ts`
- Create: `test/fixtures/native-css-modules.vue`
- Create: `test/fixtures/native-css-external.css`
- Create: `test/fixtures/native-css-external.vue`
- Modify: `test/utils.ts`

**Interfaces:**

- Consumes: `bundle()` and `mockBundleAndRun()` from `test/utils.ts`.
- Produces: `nativeCssConfig()` test configuration enabling `experiments.css`, inline match-resource, native CSS types, and optional generator/parser overrides.

- [x] **Step 1: Add the native CSS test configuration**

Add a helper that returns these essential settings:

```ts
{
  experiments: { css: true },
  vue: { experimentalInlineMatchResource: true },
  module: {
    rules: [
      { test: /\.vue$/, use: [DEFAULT_VUE_USE] },
      { test: /\.css$/, type: 'css' },
      { test: /\.scss$/, type: 'css', use: ['sass-loader'] },
    ],
  },
}
```

- [x] **Step 2: Add a fixture covering core module forms**

The fixture must include `<style module>`, `<style module="classes">`, `<style scoped module="scopedClasses">`, and `<style module="scssClasses" lang="scss">`. Its template and setup code must read mappings through `$style.foo`, `useCssModule()`, and `useCssModule('classes')` and render the mapped class names.

- [x] **Step 3: Add failing runtime and CSS asset assertions**

Assert that all module mappings are non-empty, named mappings remain separate, scoped CSS contains the component scope id, SCSS variables are compiled, emitted CSS uses the exported local class names, and external module styles work.

- [x] **Step 4: Run the native test and verify RED**

Run:

```bash
pnpm exec rstest test/nativeCss.spec.ts
```

Expected: FAIL with the current native-CSS error stating that `module` is unsupported, proving the test reaches the missing feature.

- [x] **Step 5: Commit the failing tests**

```bash
git add test/nativeCss.spec.ts test/fixtures/native-css-modules.vue test/fixtures/native-css-external.css test/fixtures/native-css-external.vue test/utils.ts
git commit -m "test: cover native CSS modules in Vue styles"
```

### Task 3: Let native CSS consume the original style request

**Files:**

- Modify: `src/pitcher.ts`
- Modify: `src/plugin.ts`
- Test: `test/nativeCss.spec.ts`

**Interfaces:**

- Consumes: parsed Vue block queries and `compiler.options.experiments.css`.
- Produces: native-only `stylePostLoaderRule` and `vueStyleModuleRule` entries in `compiler.options.module.rules`.

- [x] **Step 1: Narrow the pitcher rejection**

In the native CSS branch, keep the inline-style error but remove `query.module` from that condition. Delete the loader-string and `@import` proxy generation, then return nothing so the original matched request continues.

- [x] **Step 2: Add exact native rule matchers**

Create parsed-query predicates equivalent to:

```ts
const isVueStyle = (query?: string) => {
  if (!query) return false
  const parsed = qs.parse(query.slice(1))
  return parsed.vue != null && parsed.type === 'style'
}

const isVueStyleModule = (query?: string) => {
  if (!isVueStyle(query)) return false
  return qs.parse(query!.slice(1)).module != null
}
```

- [x] **Step 3: Inject native rules in winning order**

Add an `enforce: 'post'` style post-loader rule and a `type: 'css/module'` rule. Insert the module type rule after cloned/user style rules so it overrides ordinary `css`/`css/auto` types without changing non-module blocks.

- [x] **Step 4: Run the native integration tests**

Run:

```bash
pnpm exec rstest test/nativeCss.spec.ts
```

Expected: the module rejection is gone; core module, scoped, SCSS, external source, emitted CSS, and mapping assertions pass. Any remaining failure must identify a later unimplemented behavior rather than the old rejection.

- [x] **Step 5: Run loader-mode style regression tests**

Run:

```bash
pnpm exec rstest test/style.spec.ts test/advanced.spec.ts
```

Expected: existing css-loader scoped styles, CSS Modules, extraction, and code splitting pass without duplicate Vue transforms.

- [x] **Step 6: Commit**

```bash
git add src/pitcher.ts src/plugin.ts test/nativeCss.spec.ts
git commit -m "feat: process Vue modules with native CSS"
```

### Task 4: Support native CSS exports and HMR

**Files:**

- Create: `test/cssModulesCode.spec.ts`
- Modify: `src/cssModules.ts`
- Test: `test/nativeCss.spec.ts`
- Test: `test/style.spec.ts`

**Interfaces:**

- Consumes: `genCSSModulesCode(id, index, request, moduleName, needsHotReload)`.
- Produces: namespace-based module binding compatible with default and named exports, plus refreshed HMR assignment.

- [x] **Step 1: Add failing code-generation tests**

Assert the generated source contains:

```js
import * as style0Namespace from 'request'
const style0 = style0Namespace.default || style0Namespace
cssModules['$style'] = style0
```

For HMR, assert it accepts the exact request, assigns `style0Namespace.default || style0Namespace` inside the callback, and calls `__VUE_HMR_RUNTIME__.rerender(id)`.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm exec rstest test/cssModulesCode.spec.ts
```

Expected: FAIL because current generation uses a default import and reuses the initial binding during HMR.

- [x] **Step 3: Implement namespace export normalization**

Generate a namespace variable per style block, initialize the existing style variable from `namespace.default || namespace`, and refresh the module map from that expression during HMR.

- [x] **Step 4: Verify code generation and both integration paths**

Run:

```bash
pnpm exec rstest test/cssModulesCode.spec.ts test/style.spec.ts test/nativeCss.spec.ts
```

Expected: code-generation tests, css-loader CSS Modules, and native CSS Modules all pass.

- [x] **Step 5: Commit**

```bash
git add src/cssModules.ts test/cssModulesCode.spec.ts test/nativeCss.spec.ts test/style.spec.ts
git commit -m "fix: normalize native CSS module exports"
```

### Task 5: Add native production, source-map, split-chunk, and SSR coverage

**Files:**

- Modify: `test/nativeCss.spec.ts`
- Create: `test/fixtures/native-css-source-map.vue`
- Create: `test/fixtures/native-css-split.vue`
- Create: `test/fixtures/native-css-split-child.vue`
- Create: `test/fixtures/native-css-ssr-entry.js`

**Interfaces:**

- Consumes: native CSS test configuration and `mfs` output filesystem.
- Produces: integration coverage for emitted `.css`, `.css.map`, async CSS chunks, and server exports-only builds.

- [x] **Step 1: Add source-map coverage**

Build a Vue style with `devtool: 'source-map'`, locate the emitted CSS map in compilation assets, and assert its `sources` includes the Vue fixture while the mapped CSS contains the transformed selector.

- [x] **Step 2: Add production extraction coverage**

Build in production native mode and assert a non-empty CSS asset contains ordinary, scoped, module, and preprocessed output with the expected generated class names.

- [x] **Step 3: Add CSS code-splitting coverage**

Dynamically import a styled Vue child and a style-less Vue child. Assert the styled async chunk has a CSS asset and the style-less chunk does not emit an empty CSS asset.

- [x] **Step 4: Add SSR exports-only coverage**

Build with `target: 'node'` and native CSS generator `exportsOnly: true`. Assert the server bundle contains usable CSS Module exports and emits no browser CSS asset.

- [x] **Step 5: Run extended native coverage**

Run:

```bash
pnpm exec rstest test/nativeCss.spec.ts
```

Expected: all native development, production, source-map, split-chunk, external-source, and SSR assertions pass.

- [x] **Step 6: Commit**

```bash
git add test/nativeCss.spec.ts test/fixtures/native-css-source-map.vue test/fixtures/native-css-split.vue test/fixtures/native-css-split-child.vue test/fixtures/native-css-ssr-entry.js
git commit -m "test: cover native CSS build modes"
```

### Task 6: Complete the test matrix and documentation

**Files:**

- Modify: `package.json`
- Modify: `README.md` only if users need configuration guidance.

**Interfaces:**

- Consumes: all loader and native suites.
- Produces: explicit package scripts for the css-loader, inline match-resource, and native CSS matrices.

- [x] **Step 1: Add an explicit native matrix script**

Add:

```json
"test:native-css": "NODE_OPTIONS=--openssl-legacy-provider rstest test/nativeCss.spec.ts test/cssModulesCode.spec.ts"
```

Keep `test` and `test:match-resource` for the css-loader path with normal and inline match-resource requests.

- [x] **Step 2: Run fresh full verification**

Run each command independently:

```bash
pnpm test
pnpm test:match-resource
pnpm test:native-css
pnpm build
pnpm lint
```

Expected: every command exits zero with no test failures, TypeScript errors, or lint errors.

- [x] **Step 3: Check the final diff and requirement coverage**

Run:

```bash
git diff --check origin/main...HEAD
git status --short
```

Expected: no whitespace errors; only intended source, tests, fixtures, dependency, documentation, and plan files are changed.

- [x] **Step 4: Commit final adjustments**

```bash
git add package.json README.md docs/superpowers/plans/2026-07-16-native-css-modules.md
git commit -m "test: add native CSS verification matrix"
```
