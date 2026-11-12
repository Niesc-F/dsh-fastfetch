/** 进度条与状态标记。 */

export function renderBar(percent, width = 10, elapsedChar = '■', totalChar = '-') {
  const n = Math.max(0, Math.min(100, Number(percent) || 0))
  const total = Math.max(1, Math.trunc(width))
  const filled = Math.round((n / 100) * total)
  const elapsed = elapsedChar.repeat(Math.min(total, Math.max(0, filled)))
  const rest = totalChar.repeat(Math.max(0, total - filled))
  return `[${elapsed}${rest}]`
}

export function statusMark(percent, threshold) {
  const n = Number(percent)
  if (!Number.isFinite(n)) return ''
  if (n >= threshold.crit) return '!!'
  if (n >= threshold.warn) return '!'
  return ''
}
