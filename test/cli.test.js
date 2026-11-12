import test from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs, tokenize } from '../src/cli.js'

test('空参数返回空覆盖项', () => {
  const parsed = parseArgs('')
  assert.deepEqual(parsed.overrides, { colors: {} })
  assert.equal(parsed.help, false)
})

test('--structure 与排除项', () => {
  const parsed = parseArgs('-s os:kernel:-cpu:memory')
  assert.equal(parsed.overrides.structure, 'os:kernel:-cpu:memory')
})

test('--format 与 --json', () => {
  assert.equal(parseArgs('--format json').overrides.format, 'json')
  assert.equal(parseArgs('--json').overrides.format, 'json')
})

test('--compact 只关闭 logo', () => {
  const parsed = parseArgs('--compact')
  assert.equal(parsed.overrides.logo, 'none')
})

test('已移除的参数会被拒绝', () => {
  assert.throws(() => parseArgs('--layout portrait'), /未知参数|--layout/)
  assert.throws(() => parseArgs('--os-logo arch'), /未知参数|--os-logo/)
})

test('颜色参数写入 colors', () => {
  const parsed = parseArgs('--color-keys #ff0000 --color-output light_blue')
  assert.equal(parsed.overrides.colors.key, '#ff0000')
  assert.equal(parsed.overrides.colors.output, 'light_blue')
})

test('支持引号分隔符', () => {
  assert.deepEqual(tokenize('--separator " => "'), ['--separator', ' => '])
  const parsed = parseArgs('--separator " => "')
  assert.equal(parsed.overrides.separator, ' => ')
})

test('非法枚举与未知参数会报错', () => {
  assert.throws(() => parseArgs('--theme nope'), /未知参数|--theme/)
  assert.throws(() => parseArgs('--wat'), /未知参数/)
  assert.throws(() => parseArgs('--key-width -1'), /key-width/)
  assert.throws(() => parseArgs('--bar-char-total ab'), /单个字符/)
})

test('位置参数会报错并提示 --structure', () => {
  assert.throws(() => parseArgs('os:kernel'), /--structure/)
})

test('--help / --version / --list-modules', () => {
  assert.equal(parseArgs('--help').help, true)
  assert.equal(parseArgs('-v').version, true)
  assert.equal(parseArgs('--list-modules').listModules, true)
})
