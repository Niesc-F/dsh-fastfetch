import test from 'node:test'
import assert from 'node:assert/strict'
import { displayWidth, padEndDisplay, truncateDisplay } from '../src/render/width.js'

test('ASCII 宽度', () => {
  assert.equal(displayWidth('abc'), 3)
  assert.equal(displayWidth(''), 0)
})

test('中文与全角字符按 2 计算', () => {
  assert.equal(displayWidth('中文'), 4)
  assert.equal(displayWidth('ＡＢ'), 4)
})

test('emoji 按宽字符计算', () => {
  assert.equal(displayWidth('🐋'), 2)
})

test('ANSI 不计宽度', () => {
  assert.equal(displayWidth('\x1b[31mabc\x1b[0m'), 3)
})

test('padEndDisplay 按显示宽度补齐', () => {
  assert.equal(displayWidth(padEndDisplay('中文', 10)), 10)
  assert.equal(padEndDisplay('abc', 5), 'abc  ')
})

test('truncateDisplay 按显示宽度截断', () => {
  assert.ok(displayWidth(truncateDisplay('中文中文中文', 6)) <= 6)
  assert.equal(truncateDisplay('abc', 3), 'abc')
})
