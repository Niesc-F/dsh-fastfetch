import test from 'node:test'
import assert from 'node:assert/strict'
import { diffConfig, mergeConfig, describeSchema, remoteContribution } from '../src/config-api.js'
import { DEFAULT_CONFIG } from '../src/config.js'

test('diffConfig 只保留与默认值不同的字段', () => {
  const changed = { ...DEFAULT_CONFIG, display: { ...DEFAULT_CONFIG.display, keyWidth: 20 } }
  const diff = diffConfig(changed)
  assert.deepEqual(diff, { display: { keyWidth: 20 } })
})

test('diffConfig 全默认时返回 undefined', () => {
  assert.equal(diffConfig(DEFAULT_CONFIG), undefined)
})

test('mergeConfig 深合并草稿', () => {
  const merged = mergeConfig({ display: { keyWidth: 8, width: 0 } }, { display: { width: 48 } })
  assert.equal(merged.display.keyWidth, 8)
  assert.equal(merged.display.width, 48)
})

test('describeSchema 暴露可选值', () => {
  const schema = describeSchema()
  assert.equal(schema.display.osLogo, undefined)
  assert.equal(schema.display.osLogoName, undefined)
  assert.equal(schema.display.width.max, 200)
  assert.equal(schema.version.length > 0, true)
  // 表单选项必须与配置常量一致，不允许再出现已删除的值
  assert.deepEqual(schema.display.icons.options, ['emoji', 'none'])
  assert.ok(!schema.display.icons.options.includes('ascii'))
  assert.ok(!schema.display.icons.options.includes('nerd'))
  assert.equal(schema.display.detail, undefined)
})

test('remoteContribution 生成 fastfetchApi 方法', () => {
  const contribution = remoteContribution('dsh-fastfetch', 'fastfetchApi', [['get', []], ['save', ['config']]])
  assert.equal(contribution.package, 'dsh-fastfetch')
  assert.equal(contribution.invocations.length, 2)
  assert.equal(contribution.invocations[0].namespace, 'fastfetchApi')
  assert.equal(contribution.invocations[0].method, 'get')
  assert.equal(contribution.invocations[1].parameters[0].name, 'config')
})
