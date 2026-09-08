import * as fs from 'fs'
import * as path from 'path'
import { rspack, type Configuration, type Stats } from '@rspack/core'
import { VueLoaderPlugin } from 'rspack-vue-loader'
import { bundle } from './utils'

// hot reload code is wrapped in `if (module.hot)`, which the bundler drops
// unless HMR is actually enabled for the compilation
const enableHMR = (config: Configuration) => {
  config.plugins = [
    ...(config.plugins ?? []),
    new rspack.HotModuleReplacementPlugin(),
  ]
}

test('no hot reload code in a server build by default', async () => {
  const { code } = await bundle({
    entry: 'basic.vue',
    modify: enableHMR,
    vue: {
      isServerBuild: true,
    },
  })

  expect(code).not.toContain('__exports__.__hmrId')
})

test('opt a server build into hot reload with hotReload: true', async () => {
  const { code } = await bundle({
    entry: 'basic.vue',
    modify: enableHMR,
    vue: {
      isServerBuild: true,
      hotReload: true,
    },
  })

  expect(code).toContain('__exports__.__hmrId')
})

test('hotReload: false still wins over a server build opt-in', async () => {
  const { code } = await bundle({
    entry: 'basic.vue',
    modify: enableHMR,
    vue: {
      isServerBuild: true,
      hotReload: false,
    },
  })

  expect(code).not.toContain('__exports__.__hmrId')
})

test('swap ssrRender on a template update in a server build', async () => {
  const { code } = await bundle({
    entry: 'basic.vue',
    modify: enableHMR,
    vue: {
      isServerBuild: true,
      hotReload: true,
    },
  })

  // the bundler rewrites the imported `ssrRender` into its own reference
  expect(code).toContain('__exports__.ssrRender =')
  // `api.rerender` assigns to `render`, which a server build never imports
  expect(code).not.toContain('api.rerender')
})

test('keep using api.rerender on a template update in a client build', async () => {
  const { code } = await bundle({
    entry: 'basic.vue',
    modify: enableHMR,
  })

  expect(code).toContain('api.rerender')
  expect(code).not.toContain('__exports__.ssrRender')
})

/**
 * The tests below drive a real watching server build: they render the bundle
 * with `vue/server-renderer`, edit a file, apply the hot update the way a dev
 * server would, and render again.
 */

const tmpRoot = path.join(__dirname, '.tmp')

const ENTRY = `
const { createSSRApp } = require('vue')
const { renderToString } = require('vue/server-renderer')

// required per render, so that a re-executed module is picked up
exports.render = () => renderToString(createSSRApp(require('./target.vue').default))
exports.hot = module.hot
`

interface ServerBuild {
  /** resolves once the next compilation has finished */
  nextBuild: () => Promise<Stats>
  /** applies the pending hot update inside the running bundle */
  applyUpdate: () => Promise<void>
  render: () => Promise<string>
  write: (name: string, content: string) => void
  close: () => Promise<void>
}

async function startServerBuild(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(tmpRoot, 'server-hmr-'))
  const write = (name: string, content: string) =>
    fs.writeFileSync(path.join(dir, name), content)

  write('entry.js', ENTRY)
  for (const [name, content] of Object.entries(files)) {
    write(name, content)
  }

  const compiler = rspack({
    mode: 'development',
    devtool: false,
    target: 'node',
    context: dir,
    entry: './entry.js',
    output: {
      path: path.join(dir, 'dist'),
      filename: 'bundle.js',
      library: { type: 'commonjs2' },
    },
    // share Vue with the test process, so that the bundle talks to the same
    // `__VUE_HMR_RUNTIME__`
    externals: {
      vue: 'commonjs vue',
      'vue/server-renderer': 'commonjs vue/server-renderer',
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
          use: [
            {
              loader: 'rspack-vue-loader',
              options: {
                isServerBuild: true,
                hotReload: true,
                experimentalInlineMatchResource: Boolean(
                  process.env.INLINE_MATCH_RESOURCE
                ),
              },
            },
          ],
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
    plugins: [new VueLoaderPlugin(), new rspack.HotModuleReplacementPlugin()],
  })

  const finished: Stats[] = []
  const waiting: ((stats: Stats) => void)[] = []
  compiler.hooks.done.tap('server-hmr-test', (stats) => {
    const waiter = waiting.shift()
    if (waiter) {
      waiter(stats)
    } else {
      finished.push(stats)
    }
  })

  const nextBuild = () =>
    new Promise<Stats>((resolve) => {
      const stats = finished.shift()
      if (stats) {
        resolve(stats)
      } else {
        waiting.push(resolve)
      }
    }).then((stats) => {
      if (stats.hasErrors()) {
        throw new Error(stats.toString({ all: false, errors: true }))
      }
      return stats
    })

  const watching = compiler.watch({ aggregateTimeout: 50, poll: 100 }, () => {})

  await nextBuild()

  const bundlePath = path.join(dir, 'dist', 'bundle.js')
  const bundled = require(bundlePath)

  const build: ServerBuild = {
    nextBuild,
    applyUpdate: () => bundled.hot.check(true).then(() => undefined),
    render: () => bundled.render(),
    write,
    close: () =>
      new Promise<void>((resolve, reject) => {
        delete require.cache[require.resolve(bundlePath)]
        watching.close(() => {
          compiler.close((error) => (error ? reject(error) : resolve()))
        })
      }).then(() => {
        fs.rmSync(dir, { recursive: true, force: true })
      }),
  }
  return build
}

const openBuilds: ServerBuild[] = []

beforeAll(() => {
  fs.mkdirSync(tmpRoot, { recursive: true })
})

afterEach(async () => {
  await Promise.all(openBuilds.splice(0).map((build) => build.close()))
})

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true })
})

async function startTrackedServerBuild(files: Record<string, string>) {
  const build = await startServerBuild(files)
  openBuilds.push(build)
  return build
}

test('hot swap ssrRender when the template of a server build changes', async () => {
  const build = await startTrackedServerBuild({
    'target.vue': `
<template>
  <div>{{ msg }}</div>
</template>

<script>
export default {
  data: () => ({ msg: 'hello' }),
}
</script>
`,
  })

  expect(await build.render()).toBe('<div>hello</div>')

  build.write(
    'target.vue',
    `
<template>
  <p>{{ msg }}</p>
</template>

<script>
export default {
  data: () => ({ msg: 'hello' }),
}
</script>
`
  )

  await build.nextBuild()
  await build.applyUpdate()

  expect(await build.render()).toBe('<p>hello</p>')
})

test('recompile a server build when an imported type changes', async () => {
  const build = await startTrackedServerBuild({
    'types.ts': `export interface Props { msg?: string }\n`,
    'target.vue': `
<template>
  <div>{{ Object.keys(props).join(',') }}</div>
</template>

<script setup lang="ts">
import type { Props } from './types'

const props = defineProps<Props>()
</script>
`,
  })

  expect(await build.render()).toBe('<div>msg</div>')

  build.write(
    'types.ts',
    `export interface Props { msg?: string; id?: number }\n`
  )

  await build.nextBuild()
  await build.applyUpdate()

  expect(await build.render()).toBe('<div>msg,id</div>')
})
