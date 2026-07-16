import { genCSSModulesCode } from '../src/cssModules'

test('normalizes default and namespace CSS module exports', () => {
  const code = genCSSModulesCode(
    'component-id',
    0,
    '"./style.css"',
    true,
    false
  )

  expect(code).toContain('import * as style0Namespace from "./style.css"')
  expect(code).toContain(
    'const style0 = typeof style0Namespace.default === "object" ? style0Namespace.default : style0Namespace'
  )
  expect(code).toContain('cssModules["$style"] = style0')

  const cssModules: Record<string, unknown> = {}
  const nativeNamespace = {
    default: 'native-default-class',
    foo: 'native-foo-class',
  }
  const executable = code.replace(
    '\nimport * as style0Namespace from "./style.css"',
    ''
  )

  new Function('style0Namespace', 'cssModules', executable)(
    nativeNamespace,
    cssModules
  )

  expect(cssModules.$style).toBe(nativeNamespace)
})

test('refreshes named CSS module mappings during HMR', () => {
  const code = genCSSModulesCode(
    'component-id',
    2,
    '"./named.css"',
    'classes',
    true
  )

  expect(code).toContain('module.hot.accept("./named.css", () => {')
  expect(code).toContain(
    'cssModules["classes"] = typeof style2Namespace.default === "object" ? style2Namespace.default : style2Namespace'
  )
  expect(code).toContain('__VUE_HMR_RUNTIME__.rerender("component-id")')

  let acceptedRequest: string | undefined
  let acceptedCallback: (() => void) | undefined
  const hotModule = {
    hot: {
      accept(request: string, callback: () => void) {
        acceptedRequest = request
        acceptedCallback = callback
      },
    },
  }
  const rerenderedIds: string[] = []
  const rerender = (id: string) => rerenderedIds.push(id)
  const cssModules: Record<string, unknown> = {}
  const legacyNamespace = { default: { foo: 'old-class' } }
  const executable = code.replace(
    '\nimport * as style2Namespace from "./named.css"',
    ''
  )

  new Function(
    'style2Namespace',
    'cssModules',
    'module',
    '__VUE_HMR_RUNTIME__',
    executable
  )(legacyNamespace, cssModules, hotModule, { rerender })

  expect(cssModules.classes).toEqual({ foo: 'old-class' })
  expect(acceptedRequest).toBe('./named.css')

  legacyNamespace.default = { foo: 'new-class' }
  acceptedCallback!()

  expect(cssModules.classes).toEqual({ foo: 'new-class' })
  expect(rerenderedIds).toEqual(['component-id'])
})
