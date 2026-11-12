/** /fastfetch 参数解析器。纯函数，不读取环境、不执行采集。 */

import {
  CATEGORY_NAMES,
  COLOR_MODE_NAMES,
  FORMAT_NAMES,
  ICON_NAMES,
  isValidColor,
  KEY_TYPE_NAMES,
  LANGUAGE_NAMES,
  LOGO_NAMES,
  LOGO_POSITION_NAMES,
} from './config.js'

const VALUE_SPECS = {
  '--structure': { path: 'structure', type: 'string', maxLength: 512 },
  '-s': { path: 'structure', type: 'string', maxLength: 512 },
  '--category': { path: 'category', type: 'enum', values: CATEGORY_NAMES },
  '--logo': { path: 'logo', type: 'enum', values: LOGO_NAMES },
  '--logo-position': { path: 'logoPosition', type: 'enum', values: LOGO_POSITION_NAMES },
  '--icons': { path: 'icons', type: 'enum', values: ICON_NAMES },
  '--key-type': { path: 'keyType', type: 'enum', values: KEY_TYPE_NAMES },
  '--key-width': { path: 'keyWidth', type: 'int', min: 0, max: 40 },
  '--separator': { path: 'separator', type: 'string', maxLength: 16 },
  '--width': { path: 'width', type: 'int', min: 0, max: 200 },
  '--bar-width': { path: 'barWidth', type: 'int', min: 1, max: 40 },
  '--bar-char-elapsed': { path: 'barCharElapsed', type: 'char' },
  '--bar-char-total': { path: 'barCharTotal', type: 'char' },
  '--color': { path: 'color', type: 'enum', values: COLOR_MODE_NAMES },
  '--color-keys': { path: 'colors.key', type: 'color' },
  '--color-output': { path: 'colors.output', type: 'color' },
  '--color-separator': { path: 'colors.separator', type: 'color' },
  '--color-title': { path: 'colors.title', type: 'color' },
  '--format': { path: 'format', type: 'enum', values: FORMAT_NAMES },
  '--language': { path: 'language', type: 'enum', values: LANGUAGE_NAMES },
}

const BOOL_SPECS = {
  '--no-logo': { path: 'logo', value: 'none' },
  '--compact': { path: 'compact', value: true },
  '--detailed': { path: 'detailed', value: true },
  '--json': { path: 'format', value: 'json' },
  '--show-errors': { path: 'showErrors', value: true },
  '--debug': { path: 'debug', value: true },
  '-h': { path: 'help', value: true },
  '--help': { path: 'help', value: true },
  '-v': { path: 'version', value: true },
  '--version': { path: 'version', value: true },
  '--list-modules': { path: 'listModules', value: true },
  '--diag': { path: 'diag', value: true },
}

function tokenize(input) {
  const text = String(input ?? '')
  const tokens = []
  let current = ''
  let quote = null
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quote) {
      if (ch === quote) quote = null
      else if (ch === '\\' && quote === '"' && i + 1 < text.length) current += text[++i]
      else current += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (quote) throw new Error('引号未闭合')
  if (current) tokens.push(current)
  return tokens
}

function setPath(target, path, value) {
  const parts = path.split('.')
  let node = target
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {}
    node = node[parts[i]]
  }
  node[parts[parts.length - 1]] = value
}

function coerce(spec, raw, flag) {
  const value = String(raw)
  if (spec.type === 'string') {
    if (!value || value.length > (spec.maxLength ?? 128)) throw new Error(`${flag} 的值无效`)
    return value
  }
  if (spec.type === 'enum') {
    if (!spec.values.includes(value)) {
      throw new Error(`${flag} 只接受: ${spec.values.join(' / ')}`)
    }
    return value
  }
  if (spec.type === 'int') {
    const n = Number(value)
    if (!Number.isInteger(n) || n < spec.min || n > spec.max) {
      throw new Error(`${flag} 需要 ${spec.min}–${spec.max} 的整数`)
    }
    return n
  }
  if (spec.type === 'char') {
    const chars = Array.from(value)
    if (chars.length !== 1) throw new Error(`${flag} 需要单个字符`)
    return value
  }
  if (spec.type === 'color') {
    if (!isValidColor(value)) throw new Error(`${flag} 需要 #RRGGBB 或颜色名`)
    return value
  }
  throw new Error(`内部错误: 未知参数类型 ${spec.type}`)
}

/**
 * 解析命令行。
 * @param {string} input /fastfetch 后面的原始文本
 * @returns {{overrides: object, help: boolean, version: boolean, listModules: boolean}}
 */
export function parseArgs(input) {
  const tokens = tokenize(input)
  const overrides = { colors: {} }
  let help = false
  let version = false
  let listModules = false

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token === '--') break
    if (!token.startsWith('-') || token === '-') {
      throw new Error(`不支持位置参数 "${token}"；模块请用 --structure 指定`)
    }

    const eq = token.indexOf('=')
    const flag = eq >= 0 ? token.slice(0, eq) : token
    const inline = eq >= 0 ? token.slice(eq + 1) : undefined

    if (BOOL_SPECS[flag]) {
      if (inline !== undefined) throw new Error(`${flag} 不接受值`)
      const spec = BOOL_SPECS[flag]
      if (spec.path === 'help') help = true
      else if (spec.path === 'version') version = true
      else if (spec.path === 'listModules') listModules = true
      else if (spec.path === 'compact') {
        overrides.logo = 'none'
      } else {
        setPath(overrides, spec.path, spec.value)
      }
      continue
    }

    const spec = VALUE_SPECS[flag]
    if (!spec) throw new Error(`未知参数 ${flag}；输入 /fastfetch --help 查看用法`)
    const raw = inline !== undefined ? inline : tokens[++i]
    if (raw === undefined) throw new Error(`${flag} 需要一个值`)
    const value = coerce(spec, raw, flag)
    setPath(overrides, spec.path, value)
  }

  return { overrides, help, version, listModules }
}

export { tokenize }
