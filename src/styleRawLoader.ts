import type { LoaderDefinitionFunction } from '@rspack/core'

const StyleRawLoader: LoaderDefinitionFunction = function (source, map) {
  return `export default ${JSON.stringify({ source, map })}`
}

export default StyleRawLoader
