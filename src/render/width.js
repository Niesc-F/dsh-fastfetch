/** 显示宽度计算：把 ANSI、东亚全角字符、emoji、组合字符都算对。 */

const ANSI_RE = /\x1b\[[0-9;]*m/g

export function stripAnsi(text) {
  return String(text ?? '').replace(ANSI_RE, '')
}

function isCombining(cp) {
  return (
    cp === 0xfe0f ||
    cp === 0x200d ||
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x1dc0 && cp <= 0x1dff) ||
    (cp >= 0x20d0 && cp <= 0x20ff) ||
    (cp >= 0xfe20 && cp <= 0xfe2f)
  )
}

function isWide(cp) {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    // ⌚⏰⏱⏳⌨⚙ 这类老 emoji：终端按两格渲染，这里必须跟着算两格
    (cp >= 0x2300 && cp <= 0x23ff) ||
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x2b00 && cp <= 0x2bff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  )
}

function codePointWidth(cp) {
  if (cp === 0x09) return 4
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0
  if (isCombining(cp)) return 0
  if (isWide(cp)) return 2
  return 1
}

export function displayWidth(text) {
  const plain = stripAnsi(text)
  let width = 0
  for (const ch of plain) {
    width += codePointWidth(ch.codePointAt(0))
  }
  return width
}

export function padEndDisplay(text, width, fill = ' ') {
  const current = displayWidth(text)
  if (current >= width) return text
  return text + fill.repeat(width - current)
}

export function padStartDisplay(text, width, fill = ' ') {
  const current = displayWidth(text)
  if (current >= width) return text
  return fill.repeat(width - current) + text
}

export function truncateDisplay(text, width, ellipsis = '…') {
  if (width <= 0) return ''
  if (displayWidth(text) <= width) return text
  const ellipsisWidth = displayWidth(ellipsis)
  const budget = Math.max(0, width - ellipsisWidth)
  let out = ''
  let used = 0
  for (const ch of stripAnsi(text)) {
    const w = codePointWidth(ch.codePointAt(0))
    if (used + w > budget) break
    out += ch
    used += w
  }
  return out + ellipsis
}
