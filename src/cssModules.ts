export function genCSSModulesCode(
  id: string,
  index: number,
  request: string,
  moduleName: string | boolean,
  needsHotReload: boolean
): string {
  const styleVar = `style${index}`
  const styleNamespaceVar = `${styleVar}Namespace`
  const normalizedStyle = `typeof ${styleNamespaceVar}.default === "object" ? ${styleNamespaceVar}.default : ${styleNamespaceVar}`
  let code = `\nimport * as ${styleNamespaceVar} from ${request}`
  code += `\nconst ${styleVar} = ${normalizedStyle}`

  // inject variable
  const name = typeof moduleName === 'string' ? moduleName : '$style'
  code += `\ncssModules["${name}"] = ${styleVar}`

  if (needsHotReload) {
    code += `
if (module.hot) {
  module.hot.accept(${request}, () => {
    cssModules["${name}"] = ${normalizedStyle}
    __VUE_HMR_RUNTIME__.rerender("${id}")
  })
}`
  }

  return code
}
