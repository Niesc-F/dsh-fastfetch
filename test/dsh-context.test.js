import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeConfig } from '../src/config.js'
import { createContext } from '../src/context.js'

function makeCtx() {
  const entries = [
    { options: { id: 'a', name: 'dsh-drawai' } },
    { options: { id: 'b', name: 'dsh-fastfetch' } },
    { options: { id: 'c', name: '@deepseek-ai/dsh-agent' } },
    { options: { id: 'd', name: 'cordis:group' } },
  ]
  return {
    get(name) {
      if (name === 'configEditor') return { entries: () => entries }
      if (name === 'skills') {
        return {
          list: async () => [
            { name: 'office', source: 'bundled', provider: 'skill-filesystem' },
            { name: 'drawai-canvas', source: 'runtime', provider: 'runtime' },
            { name: 'my-skill', source: 'user-dsh', provider: 'skill-filesystem' },
          ],
        }
      }
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'fallback', model: 'fallback-model' }) }
      return undefined
    },
  }
}

test('从 session 读取模型、工作目录、预设', async () => {
  const session = {
    id: 's1',
    header: { cwd: 'E:\\work', agentPreset: 'desktop', createdAt: 123 },
    requestHeader: () => ({ config: { provider: 'p', model: 'm', reasoningEffort: 'max' } }),
  }
  const env = createContext(makeCtx(), { id: 's1', session }, normalizeConfig({}))
  assert.equal(env.cwd, 'E:\\work')
  assert.deepEqual(await env.getModel(), { provider: 'p', model: 'm', reasoningEffort: 'max' })
  assert.equal(env.getSessionInfo().preset, 'desktop')
})

test('没有 requestHeader 时回退默认模型', async () => {
  const session = {
    id: 's2',
    header: { cwd: 'E:\\work' },
    requestHeader: () => undefined,
  }
  const env = createContext(makeCtx(), { id: 's2', session }, normalizeConfig({}))
  assert.deepEqual(await env.getModel(), { provider: 'fallback', model: 'fallback-model' })
})

test('插件与技能列表去重并区分 DSH 自带/第三方', async () => {
  const session = { id: 's3', header: { cwd: 'E:\\work' }, requestHeader: () => undefined }
  const env = createContext(makeCtx(), { id: 's3', session }, normalizeConfig({}))
  const plugins = await env.getPlugins()
  const skills = await env.getSkills()
  assert.deepEqual(plugins.names, ['@deepseek-ai/dsh-agent', 'dsh-drawai', 'dsh-fastfetch'])
  assert.equal(plugins.count, 3)
  assert.equal(plugins.builtinCount, 1)
  assert.equal(plugins.thirdPartyCount, 2)
  assert.deepEqual(skills.names, ['drawai-canvas', 'my-skill', 'office'])
  assert.equal(skills.count, 3)
  assert.equal(skills.builtinCount, 1)
  assert.equal(skills.thirdPartyCount, 2)
})
