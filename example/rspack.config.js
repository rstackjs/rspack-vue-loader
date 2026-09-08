const path = require('path')
const { rspack } = require('@rspack/core')
const VueLoaderPlugin = require('../dist/plugin').default

module.exports = (env = {}) => {
  const isProd = env.prod
  const isSSR = env.ssr

  /**
   * Some notes regarding config for the server build of an SSR app:
   * 1. target: 'node'
   * 2. output.library: { type: 'commonjs2' } (so the exported app can be required)
   * 3. externals: this is mostly for faster builds.
   *    - externalize Vue via commonjs require()
   *    - externalize client side deps that are never used on the server, e.g.
   *      ones that are only used in onMounted() to empty modules
   * 4. If using cache-loader or any other forms of cache, make sure the cache
   *    key takes client vs. server builds into account!
   */
  const genConfig = (isServerBuild = false) => {
    const minimize = isProd && !isServerBuild && !env.noMinimize

    return {
      mode: isProd ? 'production' : 'development',
      entry: path.resolve(__dirname, './main.js'),
      target: isServerBuild ? 'node' : 'web',
      devtool: 'source-map',
      resolve: {
        extensions: ['.js', '.ts'],
      },
      output: {
        clean: true,
        path: path.resolve(
          __dirname,
          isSSR ? (isServerBuild ? 'dist-ssr/server' : 'dist-ssr/dist') : 'dist'
        ),
        filename: '[name].js',
        publicPath: '/dist/',
        library: isServerBuild ? { type: 'commonjs2' } : undefined,
      },
      externals: isServerBuild
        ? [
            ({ request }, cb) => {
              if (/^vue(?:\/|$)/.test(request)) {
                return cb(null, 'commonjs ' + request)
              }
              cb()
            },
          ]
        : undefined,
      module: {
        rules: [
          {
            test: /\.vue$/,
            loader: 'rspack-vue-loader',
            options: {
              experimentalInlineMatchResource: true,
              compilerOptions: {
                isCustomElement: (tag) => tag.startsWith('custom-'),
              },
            },
          },
          {
            test: /\.png$/,
            type: 'asset',
            parser: { dataUrlCondition: { maxSize: 8192 } },
          },
          {
            test: /\.css$/,
            type: 'javascript/auto',
            use: [rspack.CssExtractRspackPlugin.loader, 'css-loader'],
          },
          {
            test: /\.ts$/,
            use: [
              {
                loader: 'builtin:swc-loader',
                options: {
                  jsc: { parser: { syntax: 'typescript' } },
                },
              },
            ],
          },
          // target <docs> custom blocks
          {
            resourceQuery: /blockType=docs/,
            loader: require.resolve('./docs-loader'),
          },
        ],
      },
      plugins: [
        new VueLoaderPlugin(),
        new rspack.CssExtractRspackPlugin({
          filename: '[name].css',
        }),
        new rspack.DefinePlugin({
          __IS_SSR__: !!isSSR,
          __VUE_OPTIONS_API__: true,
          __VUE_PROD_DEVTOOLS__: false,
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        }),
      ],
      optimization: {
        minimize,
      },
      devServer: {
        hot: true,
        static: __dirname,
        devMiddleware: { stats: 'minimal' },
        client: { overlay: true },
      },
      resolveLoader: {
        alias: {
          'rspack-vue-loader': require.resolve('../'),
        },
      },
    }
  }

  if (!isSSR) {
    return genConfig()
  } else {
    return [genConfig(), genConfig(true)]
  }
}
