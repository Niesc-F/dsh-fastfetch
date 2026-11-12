import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeConfig, resolveOptions } from '../src/config.js'
import { collectModules, listModules, resolveModuleList } from '../src/modules/registry.js'

test('默认模块列表', () => {
  const ids = resolveModuleList(null, 'all', ['title', 'os', 'memory'])
  assert.deepEqual(ids, ['title', 'os', 'memory'])
})

test('structure 支持排序与排除', () => {
  const ids = resolveModuleList('os:kernel:-cpu:memory', 'all', ['os'])
  assert.deepEqual(ids, ['os', 'kernel', 'memory'])
})

test('category 过滤', () => {
  const ids = resolveModuleList('all', 'dsh', ['os'])
  assert.ok(ids.includes('dsh-mode'))
  assert.ok(ids.includes('dsh-model'))
  assert.ok(!ids.includes('os'))
})

test('未知模块报错并列出可用模块', () => {
  assert.throws(() => resolveModuleList('os:wat', 'all', ['os']), /未知模块 "wat"/)
})

test('listModules 返回元数据', () => {
  const modules = listModules()
  assert.ok(modules.length >= 15)
  const memory = modules.find((module) => module.id === 'memory')
  assert.equal(memory.category, 'system')
  assert.equal(memory.default, true)
})

function mockEnv() {
  return {
    config: normalizeConfig({}),
    language: 'en',
    hostLocale: 'en-US',
    getModel: async () => ({ provider: 'p', model: 'm' }),
    getPlugins: async () => ({
      names: ['@deepseek-ai/dsh-agent', 'third-party-plugin'],
      count: 2,
      builtin: ['@deepseek-ai/dsh-agent'],
      thirdParty: ['third-party-plugin'],
      builtinCount: 1,
      thirdPartyCount: 1,
    }),
    getSkills: async () => ({
      names: ['bundled-skill', 'user-skill'],
      count: 2,
      builtin: [{ name: 'bundled-skill' }],
      thirdParty: [{ name: 'user-skill' }],
      builtinCount: 1,
      thirdPartyCount: 1,
    }),
    getDshVersion: () => '0.2.2-rc.1',
    getSessionInfo: () => ({ id: 's1', preset: 'standard', createdAt: 0 }),
    cwd: 'E:\\work',
  }
}

test('collectModules 并行采集且不因单模块失败整体失败', async () => {
  const env = mockEnv()
  const options = resolveOptions(env.config, {})
  const { modules, errors } = await collectModules(['os', 'memory', 'dsh-mode', 'dsh-plugins', 'dsh-skills'], env, options)
  assert.equal(errors.length, 0)
  assert.equal(modules.length, 5)
  assert.ok(modules.some((module) => module.id === 'memory'))
  assert.ok(modules.find((module) => module.id === 'memory').percent >= 0)
  assert.equal(modules.find((module) => module.id === 'dsh-mode').value, 'Standard')
  assert.match(modules.find((module) => module.id === 'dsh-plugins').value, /DSH 1/)
  assert.match(modules.find((module) => module.id === 'dsh-skills').value, /DSH 1/)
})
