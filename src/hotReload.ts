// __VUE_HMR_RUNTIME__ is injected to global scope by @vue/runtime-core

export function genHotReloadCode(
  id: string,
  templateRequest: string | undefined,
  renderFnName: 'render' | 'ssrRender' = 'render'
): string {
  return `
/* hot reload */
if (module.hot) {
  __exports__.__hmrId = "${id}"
  const api = __VUE_HMR_RUNTIME__
  module.hot.accept()
  if (!api.createRecord('${id}', __exports__)) {
    api.reload('${id}', __exports__)
  }
  ${
    templateRequest
      ? genTemplateHotReloadCode(id, templateRequest, renderFnName)
      : ''
  }
}
`
}

function genTemplateHotReloadCode(
  id: string,
  request: string,
  renderFnName: 'render' | 'ssrRender'
) {
  // A server build imports `ssrRender`, which `api.rerender` cannot handle: it
  // assigns whatever it is given to `render` and re-renders the mounted
  // instances, and a server build has none (only the DOM renderer registers
  // them). Write the new function back to the component definition instead -
  // that object is what parent modules hold a reference to, so the next render
  // on the server picks it up.
  if (renderFnName === 'ssrRender') {
    return `
  module.hot.accept(${request}, () => {
    __exports__.ssrRender = ssrRender
  })
`
  }

  return `
  module.hot.accept(${request}, () => {
    api.rerender('${id}', render)
  })
`
}
