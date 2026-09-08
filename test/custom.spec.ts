import { bundle, mockBundleAndRun } from './utils'

test('add custom blocks to the Rspack output', async () => {
  const { code } = await bundle({
    entry: 'custom-language.vue',
    module: {
      rules: [
        {
          test: /\.js/,
          loader: 'builtin:swc-loader',
          options: {
            jsc: { target: 'es5' },
          },
        },
      ],
    },
  })

  // should also be transpiled
  expect(code).toMatch(
    /describe\('example', function\s*\(\) \{\s*it\('basic', function\s*\(done\) \{\s*done\(\);\s*\}\);\s*\}\);/
  )
}, 10_000)

test('custom blocks should work with src imports', async () => {
  const { code } = await bundle({
    entry: 'custom-import.vue',
    module: {
      rules: [
        {
          test: /\.js/,
          loader: 'builtin:swc-loader',
          options: {
            jsc: { target: 'es5' },
          },
        },
      ],
    },
  })

  expect(code).toMatch(
    /describe\('example', function\s*\(\) \{\s*it\('basic', function\s*\(done\) \{\s*done\(\);\s*\}\);\s*\}\);/
  )
})

test('passes Component to custom block loaders', async () => {
  const { componentModule } = await mockBundleAndRun({
    entry: 'custom-language.vue',
    module: {
      rules: [
        {
          resourceQuery: /blockType=documentation/,
          loader: require.resolve('./mock-loaders/docs'),
        },
      ],
    },
  })

  expect(componentModule.__docs).toContain(
    'This is example documentation for a component.'
  )
})

test('custom blocks can be ignored', async () => {
  const { code } = await bundle({
    entry: 'custom-language.vue',
  })
  expect(code).not.toContain(`describe('example'`)
})
