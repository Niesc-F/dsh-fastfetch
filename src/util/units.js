/** 数值格式化：字节、时长、百分比。 */

const IEC_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']

export function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return 'n/a'
  if (n === 0) return '0 B'
  let value = n
  let unit = 0
  while (value >= 1024 && unit < IEC_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${IEC_UNITS[unit]}`
}

export function formatPercent(value, digits = 0) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'n/a'
  return `${n.toFixed(digits)}%`
}

export function formatUptime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (days === 0 && minutes > 0) parts.push(`${minutes}m`)
  if (parts.length === 0) parts.push(`${seconds}s`)
  return parts.join(' ')
}

export function formatFrequency(mhz) {
  const n = Number(mhz)
  if (!Number.isFinite(n) || n <= 0) return 'n/a'
  if (n >= 1000) return `${(n / 1000).toFixed(2)} GHz`
  return `${Math.round(n)} MHz`
}

export function formatTemperature(celsius) {
  const n = Number(celsius)
  if (!Number.isFinite(n)) return 'n/a'
  return `${n.toFixed(1)} °C`
}
