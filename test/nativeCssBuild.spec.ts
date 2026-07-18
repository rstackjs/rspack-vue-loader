import * as path from 'path'
import cssesc from 'cssesc'
import {
  bundle,
  genId,
  mfs,
  mockBundleAndRun,
  nativeCssConfig,
  normalizeNewline,
} from './utils'

function assetNames(stats: any, suffix: string): string[] {
  return stats
    .toJson({ assets: true })
    .assets.map((asset: { name: string }) => asset.name)
    .filter((name: string) => name.endsWith(suffix))
}

function readAssets(stats: any, suffix: string): string {
  return normalizeNewline(
    assetNames(stats, suffix)
      .map((name) => mfs.readFileSync(`/${name}`, 'utf8'))
      .join('\n')
  )
}

test('native CSS applies v-bind() transforms', async () => {
  const { instance, stats } = await mockBundleAndRun(
    nativeCssConfig({ entry: 'style-v-bind.vue' })
  )

  const id = genId('style-v-bind.vue')
  const css = readAssets(stats, '.css')
  expect(css).toContain(`color: var(--${id}-color)`)
  expect(css).toContain(`font-size: var(--${id}-font\\.size)`)

  const computedStyle = instance.$el.ownerDocument.defaultView.getComputedStyle(
    instance.$el
  )
  expect(computedStyle.getPropertyValue(`--${id}-color`)).toBe('red')
  expect(computedStyle.getPropertyValue(`--${id}-font.size`)).toBe('2em')
})

test('native CSS emits Vue style source maps', async () => {
  const { stats } = await bundle(
    nativeCssConfig({
      entry: 'native-css-source-map.vue',
      devtool: 'source-map',
    })
  )

  const cssAsset = stats
    .toJson({ assets: true })
    .assets.find((asset: { name: string }) => asset.name.endsWith('.css'))
  const mapNames = cssAsset.info.related.sourceMap
  expect(mapNames).toHaveLength(1)
  const map = JSON.parse(mfs.readFileSync(`/${mapNames[0]}`, 'utf8'))
  expect(
    map.sources.some((source: string) =>
      source.includes('native-css-source-map.vue')
    )
  ).toBe(true)
  expect(readAssets(stats, '.css')).toContain(
    `[data-v-${genId('native-css-source-map.vue')}]`
  )
})

test('native CSS extracts module styles in production', async () => {
  const { componentModule, instance, stats } = await mockBundleAndRun(
    nativeCssConfig({
      mode: 'production',
      entry: 'native-css-modules.vue',
    })
  )

  const css = readAssets(stats, '.css')
  expect(assetNames(stats, '.css')).toHaveLength(1)
  expect(css).toContain(
    `.${cssesc(instance.$style.foo, { isIdentifier: true })}`
  )
  expect(css).toContain(`[${componentModule.__scopeId}]`)
  expect(css).toContain('color:#639')
})

test('native CSS emits styles only for styled async chunks', async () => {
  const { stats } = await bundle(
    nativeCssConfig({
      entry: 'native-css-split.vue',
      output: {
        chunkFilename: '[name].js',
        cssFilename: '[name].css',
        cssChunkFilename: '[name].css',
      },
    })
  )

  const cssNames = assetNames(stats, '.css')
  expect(cssNames.some((name) => name.includes('native-styled'))).toBe(true)
  expect(cssNames.some((name) => name.includes('native-empty'))).toBe(false)
  expect(readAssets(stats, '.css')).toContain('color: tomato')
})

test('native CSS exposes module mappings without CSS assets in SSR', async () => {
  const { code, stats } = await bundle(
    nativeCssConfig({
      entry: path.resolve(__dirname, 'fixtures/native-css-ssr-entry.js'),
      target: 'node',
      vue: {
        experimentalInlineMatchResource: true,
        isServerBuild: true,
      },
      output: {
        library: { type: 'commonjs2' },
      },
      module: {
        generator: {
          'css/module': {
            exportsOnly: true,
          },
          css: {
            exportsOnly: true,
          },
        },
      },
    })
  )

  expect(assetNames(stats, '.css')).toHaveLength(0)

  const serverModule = { exports: {} as any }
  new Function('module', 'exports', 'require', code)(
    serverModule,
    serverModule.exports,
    require
  )
  const component = serverModule.exports.default || serverModule.exports
  expect(component.__cssModules.$style.foo).toEqual(expect.any(String))
  expect(component.__cssModules.classes.bar).toEqual(expect.any(String))
})
