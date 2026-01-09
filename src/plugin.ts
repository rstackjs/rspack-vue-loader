import type { Compiler } from 'webpack'

declare class VueLoaderPlugin {
  static NS: string
  apply(compiler: Compiler): void
}

const NS = 'vue-loader'

class Plugin {
  static NS = NS
  apply(compiler: Compiler) {
    const Ctor: typeof VueLoaderPlugin = require('./pluginWebpack5').default
    new Ctor().apply(compiler)
  }
}

export default Plugin
