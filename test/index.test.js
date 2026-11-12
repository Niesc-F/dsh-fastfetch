import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../index.js'

function makeHarness() {
  const captured = {}
  const ctx = {
    fiber: { entry: { options: { id: 'dsh-fastfetch', name: 'dsh-fastfetch', config: {} } } },
    effect(fn) {
      const dispose = fn()
      return typeof dispose === 'function' ? dispose : () => {}
    },
    provide() {
      return () => {}
    },
    inject(_names, callback) {
      callback({ typert: { register: () => () => {} } })
      return () => {}
    },
    commands: {
      register(definition) {
        // /fastfetch 与 /ff 注册两个命令，这里全收下来
        ;(captured.commands ??= []).push(definition)
        captured.command = definition
        return () => {}
      },
    },
    tools: {
      register(definition) {
        captured.tool = definition
        return () => {}
      },
    },
    get(name) {
      if (name === 'configEditor') return { entries: () => [{ name: 'dsh-fastfetch' }] }
      if (name === 'skills') return { list: async () => [{ name: 'office' }] }
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'p', model: 'm' }) }
      return undefined
    },
  }
  const session = {
    id: 's1',
    header: { cwd: 'E:\\work', agentPreset: 'standard' },
    requestHeader: () => ({ config: { provider: 'p', model: 'm' } }),
  }
  return { ctx, captured, agent: { id: 's1', session } }
}

test('Host 半注册命令与工具，且共用核心', async () => {
  const harness = makeHarness()
  apply(harness.ctx, { display: { color: 'never' } })
  const commandNames = harness.captured.commands.map((item) => item.name)
  assert.ok(commandNames.includes('fastfetch'))
  assert.ok(commandNames.includes('ff'), '/ff 应当与 /fastfetch 同时注册')
  assert.equal(harness.captured.command.name, 'ff')
  assert.equal(harness.captured.tool.name, 'fastfetch')
  assert.equal(harness.captured.tool.parameters.properties.osLogo, undefined)
  assert.equal(harness.captured.tool.parameters.properties.osLogoName, undefined)

  const response = await harness.captured.command.handler({
    rawInput: '-s os:memory --no-logo',
    agent: harness.agent,
  })
  assert.equal(response.kind, 'success')
  assert.match(response.text, /memory|内存/i)

  const toolText = await harness.captured.tool.execute(
    { modules: ['memory'], color: 'never' },
    { agent: harness.agent },
  )
  assert.match(toolText, /memory|内存/i)
})

test('/fastfetch --help 与 --list-modules', async () => {
  const harness = makeHarness()
  apply(harness.ctx, {})
  const help = await harness.captured.command.handler({ rawInput: '--help', agent: harness.agent })
  assert.equal(help.kind, 'success')
  assert.match(help.text, /--structure/)

  const list = await harness.captured.command.handler({ rawInput: '--list-modules', agent: harness.agent })
  assert.equal(list.kind, 'success')
  assert.match(list.text, /dsh-model/)
})

test('非法参数返回 command error', async () => {
  const harness = makeHarness()
  apply(harness.ctx, {})
  const result = await harness.captured.command.handler({ rawInput: '--nope', agent: harness.agent })
  assert.equal(result.kind, 'error')
  assert.match(result.text, /未知参数|--nope/)
})

test('/fastfetch --category dsh 显示会话模式', async () => {
  const harness = makeHarness()
  apply(harness.ctx, { display: { color: 'never' } })
  const result = await harness.captured.command.handler({
    rawInput: '--category dsh',
    agent: harness.agent,
  })
  assert.equal(result.kind, 'success')
  assert.match(result.text, /会话模式|Session mode/)
  assert.match(result.text, /标准|Standard/)
})
