const { SourceMapConsumer, SourceNode } = require('source-map')

module.exports = function (content, inMap) {
  const prefix = '/* injected-1 */\n/* injected-2 */\n/* injected-3 */\n'
  if (!inMap) {
    this.callback(null, prefix + content)
    return
  }
  const node = SourceNode.fromStringWithSourceMap(
    content,
    new SourceMapConsumer(inMap)
  )
  node.prepend(prefix)
  const { code, map } = node.toStringWithSourceMap()
  this.callback(null, code, map.toJSON())
}
