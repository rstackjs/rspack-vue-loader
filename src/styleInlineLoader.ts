import type { LoaderDefinitionFunction } from '@rspack/core'

const StyleInineLoader: LoaderDefinitionFunction = function (source) {
  // TODO minify this?
  return `export default ${JSON.stringify(source)}`
}

export default StyleInineLoader
