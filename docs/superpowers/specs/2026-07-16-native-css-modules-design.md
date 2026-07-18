# Native CSS Modules for Vue Styles

## Goal

Make Vue single-file component style blocks work with Rspack's native CSS parser when `experiments.css` and `experimentalInlineMatchResource` are enabled, including CSS Modules exports, Vue style transforms, HMR, extraction, code splitting, and SSR. Keep the existing `style-loader`/`css-loader` path working, and run both paths through `@rspack/core`.

## Scope

The implementation targets the repository's Rspack 1.x development dependency and its `experiments.css` API. It preserves the package's existing Rspack peer range, but does not add a separate Rspack 2.x configuration path because Rspack 2 removes `experiments.css`.

The existing custom-element inline-style restriction remains. Native CSS support is added only for non-inline Vue style requests. No public vue-loader option is added.

## Architecture

### Test compiler and CSS modes

All tests compile with `@rspack/core`. The shared test utilities expose two explicit CSS modes:

- Loader mode uses `style-loader` and `css-loader` and disables native CSS processing for matching rules.
- Native mode enables `experiments.css`, enables `experimentalInlineMatchResource`, and assigns `css` or `css/auto` module types to ordinary styles.

Common loader behavior runs against Rspack in both modes where the behavior is meaningful. Mode-specific CSS assertions live in dedicated suites so that DOM style injection in loader mode is not confused with emitted CSS assets in native mode.

### Native Vue style request flow

The native path preserves the original inline match-resource request produced by the main Vue loader. When the global pitcher sees a Vue style request with native CSS enabled, it validates that `experimentalInlineMatchResource` is enabled and rejects only inline custom-element styles. It does not reject CSS Modules and does not return a JavaScript `@import` proxy.

With the pitcher no longer short-circuiting, the original module request completes this sequence:

1. `rspack-vue-loader` selects the requested style block.
2. The cloned Sass, Less, Stylus, or PostCSS loaders transform the selected block.
3. An enforced Vue style post-loader applies scoped selectors, `v-bind()` rewrites, trimming, and source-map composition.
4. Rspack's native CSS parser consumes the final CSS.

### Plugin-injected native rules

`VueLoaderPlugin` adds two narrowly scoped rules only when `compiler.options.experiments.css` is enabled:

- An `enforce: 'post'` rule matching parsed queries with `vue` and `type=style`, using `stylePostLoader`.
- A module-type override matching parsed queries with `vue`, `type=style`, and `module`, setting `type: 'css/module'`.

The module-type override is ordered after cloned/user CSS rules so it wins over an ordinary `css` or `css/auto` type for module style blocks. Non-module Vue styles retain the user's configured native CSS type.

The existing pitcher injection before `css-loader` remains unchanged in loader mode, preventing duplicate style post-processing.

### CSS Modules JavaScript generation

`genCSSModulesCode()` imports each style module as a namespace:

```js
import * as style0Namespace from 'generated-style-module'
const style0 = style0Namespace.default || style0Namespace
```

This supports both css-loader's default export and Rspack native CSS named exports. The existing `cssModules[name]` assignment and component `__cssModules` attachment remain.

For HMR, the generated module accepts the exact style dependency. Its callback resolves `styleNNamespace.default || styleNNamespace` again, assigns the refreshed mapping to `cssModules[name]`, and calls Vue's rerender runtime. Re-resolving the namespace in the callback avoids retaining a replaced default-export object.

## Behavior and Edge Cases

- `<style module>` registers `$style`.
- `<style module="classes">` registers `classes`.
- Multiple default and named blocks retain independent mappings.
- `<style scoped module>` receives both native local-class rewriting and Vue scope attributes.
- Preprocessed module styles are transformed before native parsing.
- `v-bind()` is rewritten by the Vue post-loader in ordinary and module styles.
- External `<style src>` requests retain the Vue query, so the post-loader and module-type override still apply. Scoped external styles keep the component id.
- Source maps flow from block selection through preprocessors and `compileStyle` to the emitted CSS asset.
- Production browser builds emit native CSS assets. Async Vue components emit CSS chunks without empty CSS assets for style-less chunks.
- Server builds use native CSS exports-only behavior: CSS Module mappings remain available to Vue while browser CSS assets are not emitted.

## Testing Strategy

Tests follow red-green-refactor. Native integration tests first demonstrate the current `query.module` rejection and missing native exports.

Coverage includes:

- default and named module blocks;
- multiple module blocks;
- scoped modules;
- SCSS modules and loader ordering;
- `$style.foo` and `useCssModule()` runtime access;
- emitted CSS and generated local class names;
- `v-bind()` transforms;
- external style sources;
- CSS source maps;
- production CSS assets;
- CSS code splitting;
- SSR exports-only output;
- generated HMR dependency acceptance, mapping refresh, and rerender calls.

The final verification runs the complete Rspack test suite in loader mode and in native mode, followed by TypeScript build and lint. Storage and native watcher tests are not applicable to this repository's suite.

## Compatibility and Failure Handling

If native CSS is enabled without `experimentalInlineMatchResource`, the existing explicit compilation error remains. Inline custom-element styles remain unsupported with native CSS and keep an explicit error. The native rules use parsed resource queries rather than substring-only matching to avoid affecting unrelated resources whose query text happens to contain `vue`, `style`, or `module`.
