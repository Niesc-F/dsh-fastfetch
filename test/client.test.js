import test from 'node:test'
import assert from 'node:assert/strict'

let loaded

globalThis.window = {
  __ModuleLoader__: {
    load(spec) {
      loaded = spec
    },
  },
}

await import('../client.js')

const ReactStub = {
  createElement(type, props, ...children) {
    return { type, props, children }
  },
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}]
  },
  useEffect() {},
  useCallback(fn) {
    return fn
  },
}

function mountPlugin() {
  const module = loaded.factory((name) => {
    if (name === 'react') return ReactStub
    throw new Error(`unexpected require: ${name}`)
  })
  const registrations = []
  const ctx = {
    slots: {
      inject(_name, callback) {
        callback()
        return () => {}
      },
      register(options, value) {
        registrations.push({ options, value })
        return () => {}
      },
    },
    get(name) {
      if (name === 'connection') return { rpc: { call: async () => ({ ok: true, value: {} }) } }
      if (name === 'locale') {
        return {
          register: () => () => {},
          getLocale: () => ({ id: 'zh-CN' }),
          bind: () => (key) => ({ nav: 'FastFetch', title: 'FastFetch 系统信息' })[key] ?? key,
        }
      }
      return undefined
    },
    effect() {
      return () => {}
    },
  }
  module.apply(ctx)
  return { module, registrations }
}

test('Client 卡片从 CommandNode.outcome.text 取结果', () => {
  const { registrations } = mountPlugin()
  const card = registrations.find((item) => item.options.name === 'conversation.chat.commandview')
  assert.ok(card, 'command view 应已注册')
  const tree = card.value({ node: { kind: 'command', name: 'fastfetch', outcome: { kind: 'success', text: 'hello fastfetch' } } })
  assert.match(JSON.stringify(tree), /hello fastfetch/)
  assert.match(JSON.stringify(tree), /--dsh-code-font-size/)
})

test('Client 卡片兼容 data 包装形态', () => {
  const { registrations } = mountPlugin()
  const card = registrations.find((item) => item.options.name === 'conversation.chat.commandview')
  const tree = card.value({ node: { data: { name: 'fastfetch', outcome: { kind: 'success', text: 'wrapped text' } } } })
  assert.match(JSON.stringify(tree), /wrapped text/)
})

test('Client 在设置页注册 fastfetch section', () => {
  const { module, registrations } = mountPlugin()
  assert.ok(module.inject.includes('slots'))
  assert.ok(module.inject.includes('connection'))
  assert.ok(module.inject.includes('locale'))
  const section = registrations.find((item) => item.options.name === 'settings.section')
  assert.ok(section, 'settings.section 应已注册')
  assert.equal(section.options.id, 'fastfetch')
  assert.equal(typeof section.options.label, 'function')
})
