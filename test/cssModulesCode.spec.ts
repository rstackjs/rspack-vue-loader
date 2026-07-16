import { genCSSModulesCode } from '../src/cssModules'

test('normalizes default and namespace CSS module exports', () => {
  const code = genCSSModulesCode(
    'component-id',
    0,
    '"./style.css"',
    true,
    false
  )

  expect(code).toContain(
    'import * as style0Namespace from "./style.css"'
  )
  expect(code).toContain(
    'const style0 = style0Namespace.default || style0Namespace'
  )
  expect(code).toContain('cssModules["$style"] = style0')
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
    'cssModules["classes"] = style2Namespace.default || style2Namespace'
  )
  expect(code).toContain(
    '__VUE_HMR_RUNTIME__.rerender("component-id")'
  )
})
