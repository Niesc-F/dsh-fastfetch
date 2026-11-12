import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeConfig, resolveOptions } from '../src/config.js'
import { renderJson } from '../src/render/json.js'
import { renderText } from '../src/render/text.js'

const snapshot = {
  generatedAt: '2026-11-10T00:00:00.000Z',
  errors: [],
  platform: { platform: 'win32', arch: 'x64', hostname: 'test', node: 'v24' },
  modules: [
    { id: 'title', category: 'system', label: '标题', icon: '🐋', value: 'DSH FastFetch v0.1.0' },
    { id: 'separator', category: 'system', label: '分隔线', icon: '', value: '', separator: true },
    { id: 'os', category: 'system', label: '操作系统', icon: '🖥️', value: 'Windows 11' },
    { id: 'memory', category: 'system', label: '内存', icon: '🧠', value: '8 GiB / 16 GiB', percent: 50, bar: true },
  ],
}

test('无颜色、无 logo 的文本渲染', () => {
  const options = resolveOptions(normalizeConfig({ display: { color: 'never', logo: 'none' } }), {})
  const text = renderText(snapshot, options, 'zh')
  assert.match(text, /DSH FastFetch/)
  assert.match(text, /Windows 11/)
  assert.match(text, /\[■■■■■-----\] 50%/)
  assert.equal(text.includes('\x1b['), false)
})

test('color always 会产生 ANSI', () => {
  const options = resolveOptions(normalizeConfig({ display: { color: 'always', logo: 'none' } }), {})
  const text = renderText(snapshot, options, 'en')
  assert.ok(text.includes('\x1b['))
})

test('logo 默认渲染在信息左侧', () => {
  const options = resolveOptions(normalizeConfig({ display: { color: 'never', logo: 'dsh' } }), {})
  const text = renderText(snapshot, options, 'en')
  const lines = text.split('\n')
  assert.ok(lines.length >= 7)
  assert.ok(lines[0].includes('██████'))
})

test('JSON 输出结构稳定', () => {
  const json = JSON.parse(renderJson(snapshot))
  assert.equal(json.schemaVersion, 1)
  assert.equal(json.system.memory.percent, 50)
  assert.equal(json.system.os.value, 'Windows 11')
  assert.deepEqual(json.errors, [])
})

test('多行模块按盘符展开并保留标签', () => {
  const withDisks = {
    ...snapshot,
    modules: [
      {
        id: 'disk',
        category: 'system',
        label: '磁盘',
        icon: '💽',
        value: '2 drives',
        rows: [
          { label: 'C:', value: '100 GiB / 200 GiB', percent: 50, bar: true },
          { label: 'D:', value: '300 GiB / 400 GiB', percent: 75, bar: true },
        ],
      },
    ],
  }
  const options = resolveOptions(normalizeConfig({ display: { color: 'never', logo: 'none' } }), {})
  const text = renderText(withDisks, options, 'zh')
  assert.match(text, /磁盘 C:/)
  assert.match(text, /磁盘 D:/)
  assert.equal(text.split('\n').length, 2)
})
