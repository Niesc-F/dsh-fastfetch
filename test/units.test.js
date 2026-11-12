import test from 'node:test'
import assert from 'node:assert/strict'
import { formatBytes, formatPercent, formatUptime, formatFrequency } from '../src/util/units.js'

test('字节格式化', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(1024), '1.00 KiB')
  assert.equal(formatBytes(1024 ** 3), '1.00 GiB')
  assert.equal(formatBytes(-1), 'n/a')
})

test('百分比与时长', () => {
  assert.equal(formatPercent(50.4), '50%')
  assert.equal(formatPercent(50.4, 1), '50.4%')
  assert.equal(formatUptime(0), '0s')
  assert.equal(formatUptime(3660), '1h 1m')
  assert.equal(formatUptime(90061), '1d 1h')
})

test('频率', () => {
  assert.equal(formatFrequency(2900), '2.90 GHz')
  assert.equal(formatFrequency(800), '800 MHz')
  assert.equal(formatFrequency(0), 'n/a')
})
