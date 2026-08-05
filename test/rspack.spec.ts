import * as path from 'path'
import {
  rspack,
  type Configuration,
  type OutputFileSystem,
  type Stats,
} from '@rspack/core'
import { createFsFromVolume, Volume } from 'memfs'
import { VueLoaderPlugin } from 'rspack-vue-loader'

type MemoryFileSystem = ReturnType<typeof createFsFromVolume> & {
  join: typeof path.join
}

async function compile(
  config: Configuration,
  check: (outputFileSystem: MemoryFileSystem) => void
) {
  const compiler = rspack(config)
  const outputFileSystem = Object.assign(createFsFromVolume(new Volume()), {
    join: path.join.bind(path),
  })
  compiler.outputFileSystem = outputFileSystem as unknown as OutputFileSystem

  const stats = await new Promise<Stats>((resolve, reject) => {
    compiler.run((error, result) => {
      if (error) {
        reject(error)
        return
      }
      if (!result) {
        reject(new Error('Rspack did not return compilation stats'))
        return
      }
      resolve(result)
    })
  })

  try {
    if (stats.hasErrors()) {
      throw new Error(stats.toString({ colors: false }))
    }
    check(outputFileSystem)
  } finally {
    await new Promise<void>((resolve, reject) => {
      compiler.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

function nativeCSSConfig(): Configuration {
  return {
    mode: 'production',
    devtool: false,
    entry: path.resolve(__dirname, 'fixtures/basic.vue'),
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
          test: /\.css$/,
          type: 'css',
        },
      ],
    },
    plugins: [new VueLoaderPlugin()],
  }
}

function assertCSSOutput(outputFileSystem: MemoryFileSystem) {
  const css = outputFileSystem.readFileSync('/dist/main.css', 'utf8')
  expect(css).toMatch(/comp-a h2\s*\{/)
  expect(css).toMatch(/color:\s*(?:#f00|red)/)
}

test('emits styles with rule-based native CSS', async () => {
  await compile(nativeCSSConfig(), assertCSSOutput)
})

test('keeps the CSS extraction loader pipeline working', async () => {
  const CssExtractRspackPlugin = rspack.CssExtractRspackPlugin

  await compile(
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
    assertCSSOutput
  )
})
