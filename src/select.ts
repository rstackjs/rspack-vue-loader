import type { LoaderContext } from 'webpack'
import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { ParsedUrlQuery } from 'querystring'
import { resolveScript } from './resolveScript'
import type { VueLoaderOptions } from 'src'

// Cache for storing previous content and sourcemap to avoid unnecessary HMR updates
// when only sourcemap changes but content remains the same
interface BlockCache {
  content: string
  map: any
}

const scriptCache = new Map<string, BlockCache>()
const templateCache = new Map<string, BlockCache>()
const styleCache = new Map<string, BlockCache>()
const customBlockCache = new Map<string, BlockCache>()

/**
 * Get cached sourcemap if content hasn't changed, otherwise update cache
 * This helps prevent unnecessary HMR updates when only sourcemap changes due to other
 * changes in the file (eg, style changes effecting the script and consequently the vue state).
 */
function getCachedMapOrUpdate(
  cache: Map<string, BlockCache>,
  key: string,
  content: string,
  map: any
): any {
  const cached = cache.get(key)
  if (cached && cached.content === content) {
    // Content hasn't changed, reuse the cached sourcemap
    return cached.map
  }
  // Content changed or not cached, update cache and return new map
  cache.set(key, { content, map })
  return map
}

export function selectBlock(
  descriptor: SFCDescriptor,
  scopeId: string,
  options: VueLoaderOptions,
  loaderContext: LoaderContext<VueLoaderOptions>,
  query: ParsedUrlQuery,
  appendExtension: boolean
) {
  const filename = loaderContext.resourcePath

  // template
  if (query.type === `template`) {
    // if we are receiving a query with type it can only come from a *.vue file
    // that contains that block, so the block is guaranteed to exist.
    const template = descriptor.template!
    if (appendExtension) {
      loaderContext.resourcePath += '.' + (template.lang || 'html')
    }
    const cacheKey = `${filename}:template`
    const map = getCachedMapOrUpdate(
      templateCache,
      cacheKey,
      template.content,
      template.map
    )
    loaderContext.callback(null, template.content, map as any)
    return
  }

  // script
  if (query.type === `script`) {
    const script = resolveScript(descriptor, scopeId, options, loaderContext)!
    if (appendExtension) {
      loaderContext.resourcePath += '.' + (script.lang || 'js')
    }
    const cacheKey = `${filename}:script`
    const map = getCachedMapOrUpdate(
      scriptCache,
      cacheKey,
      script.content,
      script.map
    )
    loaderContext.callback(null, script.content, map as any)
    return
  }

  // styles
  if (query.type === `style` && query.index != null) {
    const style = descriptor.styles[Number(query.index)]
    if (appendExtension) {
      loaderContext.resourcePath += '.' + (style.lang || 'css')
    }
    const cacheKey = `${filename}:style:${query.index}`
    const map = getCachedMapOrUpdate(
      styleCache,
      cacheKey,
      style.content,
      style.map
    )
    loaderContext.callback(null, style.content, map as any)
    return
  }

  // custom
  if (query.type === 'custom' && query.index != null) {
    const block = descriptor.customBlocks[Number(query.index)]
    const cacheKey = `${filename}:custom:${query.index}`
    const map = getCachedMapOrUpdate(
      customBlockCache,
      cacheKey,
      block.content,
      block.map
    )
    loaderContext.callback(null, block.content, map as any)
  }
}
