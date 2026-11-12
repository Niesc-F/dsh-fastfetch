/** ANSI 颜色与主题。 */

const NAMED_SGR = {
  black: '30', red: '31', green: '32', yellow: '33', blue: '34',
  magenta: '35', cyan: '36', white: '37',
  light_black: '90', light_red: '91', light_green: '92', light_yellow: '93',
  light_blue: '94', light_magenta: '95', light_cyan: '96', light_white: '97',
}

export const DEFAULT_PALETTE = {
  title: '#ffd75f',
  key: '#7ad7f0',
  output: '#e6edf3',
  separator: '#8b949e',
  ok: '#7bd88f',
  warn: '#f2c94c',
  crit: '#ff6b6b',
  accent: '#4fc3f7',
}

export function resolveColors(explicit = {}) {
  return { ...DEFAULT_PALETTE, ...explicit }
}

export function colorToSgr(color) {
  if (typeof color !== 'string') return ''
  const value = color.trim().toLowerCase()
  if (NAMED_SGR[value]) return NAMED_SGR[value]
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value)
  if (!hex) return ''
  let raw = hex[1]
  if (raw.length === 3) raw = raw.split('').map((ch) => ch + ch).join('')
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  return `38;2;${r};${g};${b}`
}

export function colorEnabled(mode) {
  if (mode === 'always') return true
  if (mode === 'never') return false
  if (process.env.DSH_WEB_URL) return false
  return Boolean(process.stdout?.isTTY)
}

/**
 * @param {string} text
 * @param {string} color
 * @param {boolean} enabled
 * @param {{bold?: boolean}} [options]
 */
export function paint(text, color, enabled, options = {}) {
  if (!enabled) return text
  const sgr = colorToSgr(color)
  if (!sgr && !options.bold) return text
  const codes = []
  if (options.bold) codes.push('1')
  if (sgr) codes.push(sgr)
  return `\x1b[${codes.join(';')}m${text}\x1b[0m`
}

export function statusOf(percent, threshold) {
  const n = Number(percent)
  if (!Number.isFinite(n)) return 'ok'
  if (n >= threshold.crit) return 'crit'
  if (n >= threshold.warn) return 'warn'
  return 'ok'
}

export function statusColor(status, colors) {
  if (status === 'crit') return colors.crit
  if (status === 'warn') return colors.warn
  return colors.ok
}
