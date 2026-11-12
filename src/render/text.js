/** 文本渲染：logo + 两栏 key-value、进度条、颜色。 */

import { colorEnabled, paint, resolveColors, statusColor, statusOf } from './color.js'
import { renderBar, statusMark } from './bars.js'
import { displayWidth, padEndDisplay, truncateDisplay } from './width.js'

/** 分隔线固定长度：够当视觉断开即可，不随信息列拉长。 */
const SEPARATOR_WIDTH = 44

const LOGO_DSH = [
  '██████╗ ███████╗██╗  ██╗',
  '██╔══██╗██╔════╝██║  ██║',
  '██║  ██║███████╗███████║',
  '██║  ██║╚════██║██╔══██║',
  '██████╔╝███████║██║  ██║',
  '╚═════╝ ╚══════╝╚═╝  ╚═╝',
  '  DeepSeek Harness',
]

function buildLogo(options, palette, colorOn) {
  if (options.display.logo === 'none') return []
  return LOGO_DSH.map((line) => paint(line, palette.accent, colorOn))
}

function iconPrefix(module, options) {
  if (options.display.icons === 'none') return ''
  if (!module.icon) return '   '
  // 图标位定宽，避免不同 emoji 宽度不一把整行顶歪
  return padEndDisplay(`${module.icon} `, 3)
}

/** 百分比统一用进度条样式：`[■■■■------] 42%`，无颜色时附状态标记。 */
function percentSuffix(module, options, palette, colorOn) {
  if (!Number.isFinite(module.percent)) return ''
  const marker = colorOn ? '' : statusMark(module.percent, options.thresholds.memory)
  const bar = renderBar(
    module.percent,
    options.display.barWidth,
    options.display.barCharElapsed,
    options.display.barCharTotal,
  )
  return ` ${bar} ${module.percent.toFixed(0)}%${marker}`
}

function makeSingleInfoLines(module, options, palette, colorOn, infoWidth) {
  if (module.separator) {
    // 分隔线固定长度，不跟着信息列宽走，避免终端里横穿整屏
    const ruleWidth = Math.min(Math.max(1, infoWidth), SEPARATOR_WIDTH)
    return [paint('─'.repeat(ruleWidth), palette.separator, colorOn)]
  }

  const prefix = iconPrefix(module, options)
  let key = ''
  if (options.display.keyType === 'string') {
    key = padEndDisplay(module.label, options.display.keyWidth) + options.display.separator
  }
  const suffix = percentSuffix(module, options, palette, colorOn)
  const baseWidth = displayWidth(prefix) + displayWidth(key) + displayWidth(suffix)
  const value = truncateDisplay(String(module.value ?? 'n/a'), Math.max(4, infoWidth - baseWidth))

  let line
  if (module.id === 'title') {
    line = paint(`${prefix}${value}`, palette.title, colorOn, { bold: true })
  } else {
    line = paint(prefix, palette.accent, colorOn)
    line += paint(key, palette.key, colorOn)
    line += paint(value, palette.output, colorOn)
    if (suffix) {
      const threshold = module.id === 'disk' ? options.thresholds.disk : options.thresholds.memory
      line += paint(suffix, statusColor(statusOf(module.percent, threshold), palette), colorOn)
    }
  }

  return [line]
}

/** 一个模块可以返回多行（例如所有磁盘）；普通模块仍是单行。 */
function makeInfoLines(module, options, palette, colorOn, infoWidth) {
  if (Array.isArray(module.rows) && module.rows.length > 0) {
    return module.rows.flatMap((row) => makeSingleInfoLines({
      ...module,
      ...row,
      label: row.label ? `${module.label} ${row.label}` : module.label,
      rows: undefined,
    }, options, palette, colorOn, infoWidth))
  }
  return makeSingleInfoLines(module, options, palette, colorOn, infoWidth)
}

/**
 * 字标与信息之间的零宽分隔符。
 * 客户端据此把同一行拆成两段分别套字体：字标留 Consolas（块字符在别的字体里会变全角、
 * 整块撑裂），信息段用严格等宽的中文字体。
 */
const COLUMN_MARK = '\u200B'

function mergeColumns(leftLines, rightLines, leftWidth, gap) {
  const height = Math.max(leftLines.length, rightLines.length)
  const out = []
  for (let i = 0; i < height; i += 1) {
    const left = leftLines[i] ?? ''
    const right = rightLines[i] ?? ''
    if (right) {
      out.push(`${padEndDisplay(left, leftWidth)}${' '.repeat(gap)}${COLUMN_MARK}${right}`.trimEnd())
    } else {
      out.push(left.trimEnd())
    }
  }
  return out
}

function centerDisplay(text, width) {
  const pad = Math.max(0, width - displayWidth(text))
  const left = Math.floor(pad / 2)
  return ' '.repeat(left) + text
}

/**
 * @param {{generatedAt: string, modules: object[], errors: object[], platform: object}} snapshot
 * @param {object} options resolveOptions 的结果
 * @param {'zh'|'en'} language
 */
export function renderText(snapshot, options, language) {
  const palette = resolveColors(options.colors)
  const colorOn = colorEnabled(options.display.color)
  const totalWidth = Math.max(40, options.display.width || 100)
  const logoLines = buildLogo(options, palette, colorOn)
  const logoWidth = logoLines.reduce((max, line) => Math.max(max, displayWidth(line)), 0)
  const gap = Math.max(0, options.display.logoPadding)
  const useColumns = logoLines.length > 0 && options.display.logoPosition !== 'top'
  const infoWidth = useColumns
    ? Math.max(30, totalWidth - logoWidth - gap)
    : totalWidth

  const infoLines = []
  for (const module of snapshot.modules) {
    infoLines.push(...makeInfoLines(module, options, palette, colorOn, infoWidth))
  }
  if (options.general.showErrors && snapshot.errors.length > 0) {
    for (const error of snapshot.errors) {
      infoLines.push(paint(`⚠ ${error.module}: ${error.message}`, palette.warn, colorOn))
    }
  }

  const logoBlock = logoLines
  const logoBlockWidth = logoBlock.reduce((max, line) => Math.max(max, displayWidth(line)), 0)
  const useLogoBlock = logoBlock.length > 0

  let lines
  if (!useLogoBlock) {
    lines = infoLines
  } else if (options.display.logoPosition === 'top') {
    lines = [...logoBlock.map((line) => centerDisplay(line, totalWidth)), '', ...infoLines]
  } else if (options.display.logoPosition === 'right') {
    lines = mergeColumns(infoLines, logoBlock, infoWidth, gap)
  } else {
    lines = mergeColumns(logoBlock, infoLines, logoBlockWidth, gap)
  }

  if (options.debug) {
    const total = snapshot.modules.reduce((sum, module) => sum + (module.durationMs ?? 0), 0)
    lines.push(paint(`[dsh-fastfetch] ${snapshot.modules.length} modules · ${total}ms`, palette.separator, colorOn))
  }
  return lines.join('\n')
}
