import cssesc from 'cssesc'
import {
  genId,
  mfs,
  mockBundleAndRun,
  nativeCssConfig,
  normalizeNewline,
} from './utils'

function readCssAssets(stats: any): string {
  const assets = stats
    .toJson({ assets: true })
    .assets.map((asset: { name: string }) => asset.name)
    .filter((name: string) => name.endsWith('.css'))

  expect(assets.length).toBeGreaterThan(0)

  return normalizeNewline(
    assets
      .map((name: string) => mfs.readFileSync(`/${name}`, 'utf8'))
      .join('\n')
  )
}

test('native CSS supports default, named, scoped, and SCSS modules', async () => {
  const { instance, stats } = await mockBundleAndRun(
    nativeCssConfig({ entry: 'native-css-modules.vue' })
  )

  const scssModule: any = Array.from(stats.compilation.modules).find(
    (module: any) =>
      module.resource?.includes('native-css-modules.vue') &&
      module.resource?.includes('index=3')
  )
  expect(scssModule).toBeDefined()
  expect(
    scssModule.request.match(/sass-loader\/dist\/cjs\/index\.js/g)
  ).toHaveLength(1)
  expect(scssModule.request.indexOf('stylePostLoader')).toBeLessThan(
    scssModule.request.indexOf('sass-loader')
  )

  const mappings = [
    instance.$style.foo,
    instance.defaultModule.foo,
    instance.classes.bar,
    instance.scopedClasses.scoped,
    instance.scssClasses.scss,
  ]

  mappings.forEach((className) => expect(className).toEqual(expect.any(String)))
  expect(instance.$style.foo).toBe(instance.defaultModule.foo)
  expect(new Set(mappings).size).toBe(4)
  mappings.forEach((className) => {
    expect(instance.$el.classList.contains(className)).toBe(true)
  })

  const css = readCssAssets(stats)
  mappings
    .slice(0, 1)
    .concat(mappings.slice(2))
    .forEach((className) => {
      expect(css).toContain(`.${cssesc(className, { isIdentifier: true })}`)
    })
  expect(css).toContain(`data-v-${genId('native-css-modules.vue')}`)
  expect(css).toContain('color: rebeccapurple')
})

test('native CSS supports external style module sources', async () => {
  const { instance, stats } = await mockBundleAndRun(
    nativeCssConfig({ entry: 'native-css-external.vue' })
  )

  expect(instance.$style.external).toEqual(expect.any(String))
  expect(instance.$el.className).toBe(instance.$style.external)

  const css = readCssAssets(stats)
  expect(css).toContain(
    `.${cssesc(instance.$style.external, { isIdentifier: true })}`
  )
  expect(css).toContain('color: darkorange')
})
