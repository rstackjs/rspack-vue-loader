const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const { createFsFromVolume, Volume } = require('memfs')
const { rspack } = require('@rspack/core')
const { VueLoaderPlugin } = require('../dist')

async function compile(rspack, config, check) {
  const compiler = rspack(config)
  const outputFileSystem = createFsFromVolume(new Volume())
  outputFileSystem.join = path.join.bind(path)
  compiler.outputFileSystem = outputFileSystem

  const stats = await new Promise((resolve, reject) => {
    compiler.run((error, result) => {
      if (error) {
        reject(error)
        return
      }
      resolve(result)
    })
  })

  try {
    assert.ok(stats)
    assert.equal(stats.hasErrors(), false, stats.toString({ colors: false }))
    check(outputFileSystem)
  } finally {
    await new Promise((resolve, reject) => {
      compiler.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

function nativeCSSConfig() {
  return {
    mode: 'production',
    devtool: false,
    entry: path.resolve(__dirname, 'fixtures/native-css-sass.vue'),
    output: {
      path: '/dist',
      filename: 'main.js',
      cssFilename: 'main.css',
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: require.resolve('../dist'),
          options: {
            experimentalInlineMatchResource: true,
          },
        },
        {
          test: /\.sass$/,
          loader: require.resolve('sass-loader'),
          type: 'css',
        },
      ],
    },
    plugins: [new VueLoaderPlugin()],
  }
}

function assertSassOutput(outputFileSystem) {
  const css = outputFileSystem.readFileSync('/dist/main.css', 'utf8')
  assert.match(css, /\.hello\s*\{/)
  assert.match(css, /color:\s*#639/)
  assert.match(css, /width:\s*143px/)
}

test('emits preprocessed styles with rule-based native CSS', async () => {
  await compile(rspack, nativeCSSConfig(), assertSassOutput)
})

test('keeps the CSS extraction loader pipeline working', async () => {
  const CssExtractRspackPlugin = rspack.CssExtractRspackPlugin

  await compile(
    rspack,
    {
      mode: 'production',
      devtool: false,
      entry: path.resolve(__dirname, 'fixtures/basic.vue'),
      output: {
        path: '/dist',
        filename: 'main.js',
      },
      module: {
        rules: [
          {
            test: /\.vue$/,
            loader: require.resolve('../dist'),
            options: {
              experimentalInlineMatchResource: true,
            },
          },
          {
            test: /\.css$/,
            use: [CssExtractRspackPlugin.loader, require.resolve('css-loader')],
            type: 'javascript/auto',
          },
        ],
      },
      plugins: [
        new VueLoaderPlugin(),
        new CssExtractRspackPlugin({ filename: 'main.css' }),
      ],
    },
    (outputFileSystem) => {
      const css = outputFileSystem.readFileSync('/dist/main.css', 'utf8')
      assert.match(css, /comp-a h2\s*\{/)
      assert.match(css, /color:\s*(?:#f00|red)/)
    }
  )
})
