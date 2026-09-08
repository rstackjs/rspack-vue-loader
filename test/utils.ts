import * as path from 'path'
import * as crypto from 'crypto'
import {
  rspack,
  type Configuration,
  type Stats,
  type OutputFileSystem,
} from '@rspack/core'
import { merge } from 'rspack-merge'
import { fs as mfs } from 'memfs'
import { JSDOM, VirtualConsole } from 'jsdom'
import { VueLoaderPlugin } from 'rspack-vue-loader'
import type { VueLoaderOptions } from 'rspack-vue-loader'

function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 8)
}

export const DEFAULT_VUE_USE = {
  loader: 'rspack-vue-loader',
  options: {
    experimentalInlineMatchResource: Boolean(process.env.INLINE_MATCH_RESOURCE),
  },
}

// Rspack and VueLoaderPlugin mutate rules; each compilation needs fresh objects.
const createBaseConfig = (): Configuration => ({
  mode: 'development',
  devtool: false,
  output: {
    path: '/',
    filename: 'test.build.js',
    publicPath: '',
  },
  resolve: {
    extensions: ['.js', '.ts'],
  },
  resolveLoader: {
    alias: {
      'rspack-vue-loader': require.resolve('../dist'),
    },
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: [{ ...DEFAULT_VUE_USE, options: { ...DEFAULT_VUE_USE.options } }],
      },
      {
        test: /\.ts$/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: { parser: { syntax: 'typescript' } },
        },
      },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new rspack.DefinePlugin({
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    }),
  ],
})

type BundleOptions = Configuration & {
  vue?: VueLoaderOptions
  modify?: (config: Configuration) => void
}

export async function bundle(
  options: BundleOptions,
  wontThrowError?: boolean
): Promise<{
  code: string
  stats: Stats
}> {
  let config: BundleOptions = merge(createBaseConfig(), options)

  config.module?.rules?.push({
    test: /\.css$/,
    type: 'javascript/auto',
    use: ['style-loader', 'css-loader'],
  })

  if (config.vue && config.module) {
    const vueOptions = {
      // Test experimental inline match resource by default
      experimentalInlineMatchResource: Boolean(
        process.env.INLINE_MATCH_RESOURCE
      ),
      ...options.vue,
    }

    delete config.vue
    const vueIndex = config.module.rules!.findIndex(
      (r: any) => r.test instanceof RegExp && r.test.test('.vue')
    )
    const vueRule = config.module.rules![vueIndex]

    // Detect `Rule.use` or `Rule.loader` and `Rule.options` combination
    if (vueRule && typeof vueRule === 'object' && Array.isArray(vueRule.use)) {
      // Vue usually locates at the first loader
      if (typeof vueRule.use?.[0] === 'object') {
        vueRule.use[0] = Object.assign({}, vueRule.use[0], {
          options: vueOptions,
        })
      }
    } else {
      config.module.rules![vueIndex] = Object.assign({}, vueRule, {
        options: vueOptions,
      })
    }
  }

  if (typeof config.entry === 'string' && /\.vue/.test(config.entry)) {
    const vueFile = config.entry
    config = merge(config, {
      entry: require.resolve('./fixtures/entry'),
      resolve: {
        alias: {
          '~target': path.resolve(__dirname, './fixtures', vueFile),
        },
      },
    })
  }

  if (options.modify) {
    delete config.modify
    options.modify(config)
  }

  const compiler = rspack(config)
  compiler.outputFileSystem = Object.assign(
    {
      join: path.join.bind(path),
    },
    mfs
  ) as unknown as OutputFileSystem

  try {
    const stats = await new Promise<Stats>((resolve, reject) => {
      compiler.run((error, result) => {
        if (error) {
          reject(error)
        } else if (!result) {
          reject(new Error('Rspack did not return compilation stats'))
        } else {
          resolve(result)
        }
      })
    })

    if (!wontThrowError && stats.hasErrors()) {
      throw new Error(stats.toString({ all: false, errors: true }))
    }

    return {
      code: mfs.readFileSync('/test.build.js').toString(),
      stats,
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      compiler.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

export async function mockBundleAndRun(
  options: BundleOptions,
  wontThrowError?: boolean
) {
  const { code, stats } = await bundle(options, wontThrowError)

  const dom = new JSDOM(
    `<!DOCTYPE html><html><head></head><body></body></html>`,
    {
      url: 'http://localhost/',
      runScripts: 'outside-only',
      virtualConsole: new VirtualConsole(),
    }
  )
  try {
    dom.window.eval(code)
  } catch (e) {
    console.error(`JSDOM error:\n${e.stack}`)
    throw new Error(String(e), { cause: e })
  }

  const { window } = dom
  const { componentModule, exports, instance } = window

  return {
    window,

    componentModule,
    exports,
    instance,

    code,
    stats,
  }
}

export function normalizeNewline(input: string): string {
  return input.split('\r\n').join('\n')
}

// see the logic at src/index.ts
// in non-production environment, shortFilePath is used to generate scope id
export function genId(fixtureName: string): string {
  return hash(path.join('test', 'fixtures', fixtureName).replace(/\\/g, '/'))
}

export { mfs }
