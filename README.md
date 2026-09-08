# rspack-vue-loader

<p>
  <a href="https://npmjs.com/package/rspack-vue-loader">
   <img src="https://img.shields.io/npm/v/rspack-vue-loader?style=flat-square&colorA=564341&colorB=EDED91" alt="npm version" />
  </a>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square&colorA=564341&colorB=EDED91" alt="license" />
  <a href="https://npmcharts.com/compare/rspack-vue-loader?minimal=true"><img src="https://img.shields.io/npm/dm/rspack-vue-loader.svg?style=flat-square&colorA=564341&colorB=EDED91" alt="downloads" /></a>
</p>

Rspack loader for Vue 3 Single-File Components (SFCs).

## Features

- Compile Vue templates, `<script setup>`, and styles in `.vue` files.
- Use Rspack loaders for languages such as TypeScript, Sass, and Pug inside SFCs.
- Support scoped CSS, CSS Modules, and CSS `v-bind()`.
- Resolve static assets in templates and styles through Rspack.
- Preserve component state during template and style hot updates.
- Compile components for server-side rendering and custom elements.
- Process custom blocks with your own loaders.

## Installation

Requires Rspack `^1.0.0 || ^2.0.0` and Vue 3. The loader resolves the SFC compiler from `vue/compiler-sfc` (included in Vue 3.2.13 and later), falling back to `@vue/compiler-sfc`. If you install `@vue/compiler-sfc` separately, keep its version aligned with `vue`.

```bash
# npm
npm install -D rspack-vue-loader

# pnpm
pnpm add -D rspack-vue-loader

# yarn
yarn add -D rspack-vue-loader
```

Register both the loader and `VueLoaderPlugin`. The plugin applies your language rules to the corresponding SFC blocks and adds template compilation and scoped CSS processing.

```js
// rspack.config.mjs
import { VueLoaderPlugin } from 'rspack-vue-loader'

export default {
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'rspack-vue-loader',
      },
      {
        test: /\.css$/,
        type: 'javascript/auto',
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [new VueLoaderPlugin()],
}
```

Keep the `.vue` rule at the root of `module.rules`; `VueLoaderPlugin` does not support placing it inside `oneOf`. Use `type: 'javascript/auto'` for CSS processed by `css-loader` to avoid also applying Rspack's built-in CSS handling.

## Examples

The examples below show additions or replacements to the installation config. Keep the other rules and `VueLoaderPlugin`.

### TypeScript

Add a rule for `.ts` files using Rspack's built-in SWC loader. `VueLoaderPlugin` also applies this rule to `<script lang="ts">`, `<script setup lang="ts">`, and the compiled templates of TypeScript components.

```js
// rspack.config.mjs
export default {
  resolve: {
    extensions: ['.ts', '.js', '.vue'],
  },
  module: {
    rules: [
      // Keep the existing rules and add:
      {
        test: /\.ts$/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: { parser: { syntax: 'typescript' } },
        },
      },
    ],
  },
  // Keep the plugins from the installation config.
}
```

```vue
<script setup lang="ts">
const props = defineProps<{ message: string }>()
</script>

<template>
  <p>{{ props.message }}</p>
</template>
```

TypeScript must be available to resolve types imported by SFC macros. SWC only transpiles code; use `vue-tsc` separately for type checking.

The SWC rule above handles TypeScript without JSX. Vue JSX/TSX needs a Vue-compatible JSX transform in addition to TypeScript parsing.

### Sass

For projects using `sass` and `sass-loader`, add this rule to `module.rules`:

```js
{
  test: /\.scss$/,
  type: 'javascript/auto',
  use: ['style-loader', 'css-loader', 'sass-loader'],
},
```

```vue
<template>
  <section class="message">Hello from Sass</section>
</template>

<style scoped lang="scss">
$color: #42b883;

.message {
  color: $color;
}
</style>
```

### PostCSS

The loader handles Vue's scoped CSS and CSS variable transforms. For projects using `postcss`, `postcss-loader`, and `autoprefixer`, replace the CSS rule with:

```js
{
  test: /\.css$/,
  type: 'javascript/auto',
  use: [
    'style-loader',
    {
      loader: 'css-loader',
      options: { importLoaders: 1 },
    },
    {
      loader: 'postcss-loader',
      options: {
        postcssOptions: {
          plugins: ['autoprefixer'],
        },
      },
    },
  ],
},
```

`importLoaders: 1` also applies `postcss-loader` to CSS `@import` dependencies.

### Pug

For projects using `pug` and `pug-plain-loader`, add this rule to `module.rules`:

```js
{
  test: /\.pug$/,
  loader: 'pug-plain-loader',
},
```

```vue
<template lang="pug">
section.message Hello from Pug
</template>
```

Template preprocessors must return HTML for the Vue compiler, which is why this example uses `pug-plain-loader`.

### Scoped CSS

Add `scoped` to a style block to restrict its selectors using a generated component attribute. Scoped and global style blocks can coexist in one SFC.

```vue
<style scoped>
.panel {
  padding: 1rem;
}

.panel :deep(.child-label) {
  color: #42b883;
}

:slotted(.label) {
  font-weight: bold;
}

:global(.theme-dark) {
  background: #222;
}
</style>
```

A child component's root element can receive both its own and its parent's scoped styles. Use `:deep()` for child content or HTML inserted with `v-html`, `:slotted()` for slot content, and `:global()` for a global selector within a scoped block. These are the current [Vue SFC CSS selectors](https://vuejs.org/api/sfc-css-features.html).

### CSS `v-bind()`

Reference script state in CSS with `v-bind()`. Vue compiles these values to CSS custom properties and updates them when the state changes. This works with both regular and scoped style blocks.

```vue
<script setup>
import { ref } from 'vue'

const color = ref('#42b883')
</script>

<template>
  <button class="button" @click="color = 'tomato'">Change color</button>
</template>

<style scoped>
.button {
  color: v-bind(color);
}
</style>
```

### CSS Modules

Replace the CSS rule with a `oneOf` rule that enables CSS Modules for `<style module>`:

```js
{
  test: /\.css$/,
  type: 'javascript/auto',
  oneOf: [
    {
      resourceQuery: /module/,
      use: [
        'style-loader',
        {
          loader: 'css-loader',
          options: {
            modules: { namedExport: false },
          },
        },
      ],
    },
    {
      use: ['style-loader', 'css-loader'],
    },
  ],
},
```

```vue
<template>
  <p :class="$style.message">Hello from CSS Modules</p>
</template>

<style module>
.message {
  color: #42b883;
}
</style>
```

The generated class names are available as `$style` in templates and through Vue's `useCssModule()` in scripts. Use `<style module="classes">` to expose `classes` in templates and read it with `useCssModule('classes')`. `namedExport: false` makes `css-loader` provide the default export expected by this loader.

### CSS extraction

To emit a separate CSS file, replace `style-loader` with `CssExtractRspackPlugin.loader` and add the plugin. Do not use both loaders in the same style chain:

```js
// rspack.config.mjs
import { CssExtractRspackPlugin } from '@rspack/core'

export default {
  module: {
    rules: [
      // Replace the CSS rule; keep the other rules.
      {
        test: /\.css$/,
        type: 'javascript/auto',
        use: [CssExtractRspackPlugin.loader, 'css-loader'],
      },
    ],
  },
  plugins: [
    // Keep VueLoaderPlugin and the existing plugins.
    new CssExtractRspackPlugin({ filename: '[name].css' }),
  ],
}
```

For component libraries, preserve style side effects when configuring `sideEffects`; setting it to `false` for styled SFCs can cause their CSS to be removed.

### Built-in CSS

With Rspack 2, you can use built-in CSS processing by replacing the Vue and CSS rules with:

```js
{
  test: /\.vue$/,
  loader: 'rspack-vue-loader',
  options: {
    experimentalInlineMatchResource: true,
  },
},
{
  test: /\.css$/,
  type: 'css',
},
```

Keep `VueLoaderPlugin`. This path does not need `style-loader`, `css-loader`, or `CssExtractRspackPlugin`. With Rspack 1, also enable `experiments.css` in the Rspack config.

The loader's built-in CSS integration currently supports regular and scoped styles, but does not support `<style module>` or custom element inline styles. Use the `css-loader` configuration for those features.

### Static assets

Relative asset URLs in templates become imports handled by Rspack's asset modules. Add an asset rule for the file types you use:

```js
{
  test: /\.(png|jpe?g|gif|svg|webp)$/i,
  type: 'asset',
},
```

```vue
<template>
  <img class="logo" src="./logo.png" alt="Logo" />
</template>

<style scoped>
.logo {
  background-image: url('./logo.png');
}
</style>
```

Template URLs such as `./logo.png` resolve relative to the SFC. External URLs, data URLs, and root-relative URLs such as `/logo.png` are left unchanged by default. CSS URLs are processed by `css-loader` or Rspack's built-in CSS pipeline. For a dynamic template binding, import the asset in your script and bind the imported value:

```vue
<script setup>
import logo from './logo.png'
</script>

<template>
  <img :src="logo" alt="Logo" />
</template>
```

See [transformAssetUrls](#transformasseturls) to configure template asset attributes.

### External block files

Use `src` to keep a template, a normal script, or styles in separate files:

```vue
<template src="./template.html"></template>
<script src="./component.js"></script>
<style scoped src="./style.css"></style>
```

The script file must export a Vue component options object. Add `lang` for non-default languages even when the filename already has that extension, for example `<script lang="ts" src="./component.ts"></script>` or `<style lang="scss" src="./style.scss"></style>`.

`<script setup>` cannot use `src`. An SFC with `<script setup>` also cannot use `src` on its normal `<script>` block. Keep CSS `v-bind()` expressions in inline style blocks so Vue can discover their script dependencies while parsing the SFC.

### Custom blocks

Match custom blocks by their `blockType` query parameter. Blocks without a matching loader are ignored. If a block's compiled module exports a function, the loader calls it with the component object.

```js
// docs-loader.cjs
module.exports = function (source) {
  return `export default function (component) {
    component.__docs = ${JSON.stringify(source)}
  }`
}
```

```js
// rspack.config.mjs
import { fileURLToPath } from 'node:url'

export default {
  module: {
    rules: [
      // Keep the existing rules and add:
      {
        resourceQuery: /blockType=docs/,
        loader: fileURLToPath(new URL('./docs-loader.cjs', import.meta.url)),
      },
    ],
  },
  // Keep the plugins from the installation config.
}
```

```vue
<template>
  <p>Hello</p>
</template>

<docs>
Documentation attached to the component as __docs.
</docs>
```

### Server-side rendering

The loader generates SSR render functions when Rspack's target is `'node'`. For other server targets, set [isServerBuild](#isserverbuild) explicitly.

```js
// rspack.config.mjs
export default {
  target: 'node',
  // Keep the Vue rule and VueLoaderPlugin.
}
```

Use CSS extraction or built-in CSS for server builds instead of `style-loader`. Server HMR is disabled by default; see [hotReload](#hotreload) to opt in. Use [exposeModuleIdentifier](#exposemoduleidentifier) to attach metadata for mapping rendered components to a client manifest.

### Source maps and production builds

The loader follows Rspack's `devtool` setting for source maps; there is no separate loader `sourceMap` option.

Rspack `mode: 'production'` or `NODE_ENV=production` enables production compilation and disables Vue HMR code. For `<script setup>` components whose templates have neither `lang` nor `src`, the loader also inlines the render function into `setup()`.

## Options

Pass options to `rspack-vue-loader` in the `.vue` rule, not to `VueLoaderPlugin`:

```js
{
  test: /\.vue$/,
  loader: 'rspack-vue-loader',
  options: {
    // Options below go here.
  },
},
```

Each example below shows a loader `options` object, assigned to `vueOptions` when imports are needed. Compiler-related types come from `vue/compiler-sfc`; their supported fields depend on the installed Vue version. `undefined` defaults mean the loader leaves the choice to that compiler.

The package exports the `VueLoaderOptions` type for these options.

### compilerOptions

- Type: `CompilerOptions`
- Default: `{}`

Options for Vue's template compiler and SFC template parser. For example, mark selected tags as native custom elements so Vue does not try to resolve them as Vue components:

```js
{
  compilerOptions: {
    isCustomElement: (tag) => tag.startsWith('my-'),
  },
}
```

This controls how tags are compiled. To compile an SFC itself for use with `defineCustomElement`, use [customElement](#customelement).

### transformAssetUrls

- Type: `boolean | AssetURLOptions | Record<string, string[]>`
- Default: `true`

Configure which static template attributes become asset imports. The default tag mapping is:

```js
{
  video: ['src', 'poster'],
  source: ['src'],
  img: ['src'],
  image: ['xlink:href', 'href'],
  use: ['xlink:href', 'href'],
}
```

The Vue compiler also processes `srcset` on `img` and `source`. An `AssetURLOptions` object accepts `tags`, `base` (rewrite relative URLs against a base URL), and `includeAbsolute` (also transform root-relative URLs). A custom `tags` map replaces the default mapping, so include any built-in tags you still need:

```js
{
  transformAssetUrls: {
    tags: {
      img: ['src'],
      'app-image': ['src'],
    },
  },
}
```

The current loader normalizes falsy values to `true`, so `false` does not disable the transform. To disable tag-based URL imports, use `transformAssetUrls: { tags: {} }`; the compiler's separate `srcset` transform still applies.

### customElement

- Type: `boolean | RegExp`
- Default: `/\.ce\.vue$/`

Compile matching SFCs in custom element mode. Their styles become strings in the component's `styles` option, which Vue's `defineCustomElement` injects into the shadow root. Set `true` for all SFCs or `false` to disable this mode.

```js
{
  customElement: /\.element\.vue$/,
}
```

Register the compiled component:

```js
import { defineCustomElement } from 'vue'
import MyElement from './MyElement.element.vue'

customElements.define('my-element', defineCustomElement(MyElement))
```

Use the `css-loader` style rule from the installation example. The loader handles style inlining automatically. CSS Modules and built-in CSS processing are not supported in this mode.

### hotReload

- Type: `boolean`
- Default: enabled for client builds outside production; disabled for server builds

Generate Vue HMR code. Template updates preserve component state; script updates recreate component instances. Requires Rspack HMR to be enabled.

```js
{
  hotReload: false,
}
```

Server builds can opt in with `hotReload: true` when the server's HMR runtime applies updates. Production builds never generate HMR code, even when this option is `true`. Production means Rspack `mode` or `NODE_ENV` is set to `'production'`.

### enableTsInTemplate

- Type: `boolean`
- Default: `true`

Enable TypeScript expressions in templates when the component's script uses `lang="ts"` or `lang="tsx"`. Configure a TypeScript transpiler, such as the SWC rule in [TypeScript](#typescript), to process the generated code.

```js
{
  enableTsInTemplate: false,
}
```

When disabled, avoid TypeScript-only syntax in template expressions. Script transpilation is configured separately by your language rules.

### babelParserPlugins

- Type: `SFCScriptCompileOptions['babelParserPlugins']`
- Default: `undefined` (Vue's default parser plugins)

Add Babel parser plugins when Vue parses script blocks. This affects parsing only; configure a script loader separately to transform syntax for your target runtime.

```js
{
  babelParserPlugins: ['decorators-legacy'],
}
```

### compiler

- Type: `TemplateCompiler | string`
- Default: `undefined` (the template compiler selected by Vue's SFC compiler)

Provide a compatible template compiler object or a module path that the loader can `require`. This overrides template compilation, including inlined production templates; it does not replace the SFC parser or script compiler.

```js
// rspack.config.mjs
import * as compiler from '@vue/compiler-dom'

const vueOptions = {
  compiler,
}
```

Use `vueOptions` in the `.vue` rule. This example assumes `@vue/compiler-dom` is available with the same version as `vue`.

### exposeFilename

- Type: `boolean`
- Default: `false`

Attach a `__file` property containing the component's basename in production builds. Development builds always include the path relative to the project root for devtools and runtime warnings, regardless of this option.

```js
{
  exposeFilename: true,
}
```

### exposeModuleIdentifier

- Type: `boolean | ((request: string, context: { resourcePath: string; rootContext: string }) => string)`
- Default: `false`

Attach a `__moduleIdentifier` property that an SSR integration can use to map rendered components to a client manifest. Set `true` for an eight-character SHA-256 hash of the module request, or provide a callback to match your manifest's keys. The loader strips the trailing inline match-resource hash before passing the request to the callback.

```js
{
  exposeModuleIdentifier: true,
}
```

The default hash depends on the full loader request, which can differ between client and server builds. To key a manifest by project-relative paths instead, use a callback:

```js
// rspack.config.mjs
import { relative } from 'node:path'

const vueOptions = {
  exposeModuleIdentifier: (_request, { resourcePath, rootContext }) =>
    relative(rootContext, resourcePath).replace(/\\/g, '/'),
}
```

Use the same project root and identifier scheme in both builds and in your manifest generator. This option only attaches metadata; it does not collect rendered components or generate a manifest.

### appendExtension

- Type: `boolean`
- Default: `false`

Append the language extension to the resource path seen by subsequent loaders for inline template, script, and style blocks. For example, a TypeScript script block is exposed as `App.vue.ts`. This can help loaders that inspect filenames; `VueLoaderPlugin` already handles language rule matching without it.

```js
{
  appendExtension: true,
}
```

### experimentalInlineMatchResource

- Type: `boolean`
- Default: `false`

Use Rspack's inline match resource syntax to match SFC blocks against language rules with virtual filenames such as `App.vue.ts` and `App.vue.css`. This is required for the [built-in CSS](#built-in-css) integration.

```js
{
  experimentalInlineMatchResource: true,
}
```

### isServerBuild

- Type: `boolean`
- Default: `loaderContext.target === 'node'`

Explicitly select server or client compilation. This controls SSR render function generation and the default HMR behavior. Set it when your server target is not detected as `'node'`, such as a worker-based SSR runtime.

```js
{
  isServerBuild: true,
}
```

This option does not configure Rspack's target, output format, or externals.

### propsDestructure

- Type: `boolean`
- Default: `undefined` (the installed Vue compiler's default)

Control reactive destructuring of `defineProps()` in `<script setup>`. The loader passes this option to Vue's script compiler. [Reactive props destructuring](https://vuejs.org/api/sfc-script-setup.html#reactive-props-destructure) is enabled by default in Vue 3.5 and later; Vue 3.3 and 3.4 require opting in.

```js
{
  propsDestructure: true,
}
```

### defineModel

- Type: `boolean`
- Default: `undefined` (the installed Vue compiler's default)

Compatibility option for enabling the experimental `defineModel()` macro in Vue 3.3. [Vue 3.4 and later enable the macro by default](https://vuejs.org/api/sfc-script-setup.html#definemodel); this option is no longer needed and setting it to `false` does not disable the macro in those versions.

```js
{
  defineModel: true,
}
```

### reactivityTransform

- Type: `boolean`
- Default: `undefined` (disabled in Vue versions that supported the transform)

Deprecated compatibility option for older Vue compilers that supported macros such as `$ref`. [Vue removed Reactivity Transform in 3.4](https://vuejs.org/guide/extras/reactivity-transform.html), so enabling this option has no effect with current Vue compilers. Use Vue's standard reactivity APIs in new code.

```js
{
  reactivityTransform: false,
}
```

## Credits

`rspack-vue-loader` is a fork of [vue-loader](https://github.com/vuejs/vue-loader), adapted for Rspack. Thanks to the [Vue Loader contributors](https://github.com/vuejs/vue-loader/graphs/contributors) for the original implementation and their continued work.

## License

[MIT](./LICENSE)
