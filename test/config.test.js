import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG, normalizeConfig, resolveOptions } from '../src/config.js'

test('空配置会得到完整默认值', () => {
  const cfg = normalizeConfig(undefined)
  assert.deepEqual(cfg.modules, DEFAULT_CONFIG.modules)
  assert.equal(cfg.display.separator, ': ')
  assert.equal(cfg.general.timeoutMs, 1500)
})

test('部分配置只覆盖指定字段', () => {
  const cfg = normalizeConfig({
    display: { width: 100 },
    dsh: { showSkills: false },
  })
  assert.equal(cfg.display.width, 100)
  assert.equal(cfg.display.logo, 'dsh')
  assert.equal(cfg.dsh.showSkills, false)
  assert.equal(cfg.dsh.showModel, true)
})

test('非法值回退默认值', () => {
  const cfg = normalizeConfig({
    display: { keyWidth: -1, separator: '' },
    general: { timeoutMs: 1 },
  })
  assert.equal(cfg.display.keyWidth, 0)
  assert.equal(cfg.display.separator, ': ')
  assert.equal(cfg.general.timeoutMs, 100)
})

test('颜色只保留显式配置，避免覆盖主题', () => {
  const cfg = normalizeConfig({ colors: { key: '#ff0000', bad: 'not-a-color' } })
  assert.equal(cfg.colors.key, '#ff0000')
  assert.equal(cfg.colors.output, undefined)
})

test('resolveOptions 合并 CLI 覆盖项', () => {
  const cfg = normalizeConfig({ display: { keyWidth: 20 } })
  const options = resolveOptions(cfg, {
    detail: 'full',
    logo: 'none',
    separator: ' = ',
    colors: { key: '#00ff00' },
    format: 'json',
  })
  assert.equal(options.display.keyWidth, 20)
  assert.equal(options.display.logo, 'none')
  assert.equal(options.display.separator, ' = ')
  assert.equal(options.colors.key, '#00ff00')
  assert.equal(options.format, 'json')
})

test('旧的 osLogo 配置被忽略', () => {
  const cfg = normalizeConfig({ display: { osLogo: false, osLogoName: 'arch' } })
  assert.equal(cfg.display.osLogo, undefined)
  assert.equal(cfg.display.osLogoName, undefined)
})
