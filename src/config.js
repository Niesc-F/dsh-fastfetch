/**
 * dsh-fastfetch 默认配置与配置归一化。
 *
 * 插件不依赖 Schemastery：DSH 的 row config 是一个普通 JSON 对象，这里做深合并、
 * 类型校验和范围收敛。用户只写想覆盖的字段，其余取默认值。
 */

export const PLUGIN_VERSION = '0.6.5'

export const DEFAULT_MODULES = [
  'title',
  'separator',
  'os',
  'kernel',
  'host',
  'uptime',
  'terminal',
  'cpu',
  'gpu',
  'memory',
  'disk',
  'localip',
  'dsh-version',
  'dsh-plugins',
  'dsh-skills',
  'dsh-session',
  'dsh-mode',
  'dsh-cwd',
  'dsh-model',
]

export const DEFAULT_CONFIG = Object.freeze({
  modules: [...DEFAULT_MODULES],
  display: {
    logo: 'dsh',
    logoPosition: 'left',
    logoPadding: 1,
    icons: 'emoji',
    keyType: 'string',
    keyWidth: 12,
    separator: ': ',
    width: 0,
    barWidth: 10,
    barCharElapsed: '■',
    barCharTotal: '-',
    color: 'always',
    language: 'auto',
  },
  colors: {
    title: '#ffd75f',
    key: '#7ad7f0',
    output: '#e6edf3',
    separator: '#8b949e',
    ok: '#7bd88f',
    warn: '#f2c94c',
    crit: '#ff6b6b',
    accent: '#4fc3f7',
  },
  thresholds: {
    memory: { warn: 70, crit: 90 },
    disk: { warn: 80, crit: 95 },
    cpuTemp: { warn: 70, crit: 90 },
  },
  dsh: {
    showVersion: true,
    showMode: true,
    showModel: true,
    showPlugins: true,
    showSkills: true,
    showSession: true,
    showCwd: true,
    maxPlugins: 0,
    maxSkills: 0,
  },
  general: {
    timeoutMs: 1500,
    cacheTtlMs: 5000,
    showErrors: false,
  },
})

export const ICON_NAMES = ['emoji', 'none']
export const KEY_TYPE_NAMES = ['string', 'icon', 'none']
export const COLOR_MODE_NAMES = ['auto', 'always', 'never']
export const LOGO_NAMES = ['dsh', 'none']
export const LOGO_POSITION_NAMES = ['left', 'right', 'top']
export const LANGUAGE_NAMES = ['auto', 'zh', 'en']
export const CATEGORY_NAMES = ['all', 'system', 'dsh']
export const FORMAT_NAMES = ['text', 'json']

const NAMED_COLORS = new Set([
  'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'light_black', 'light_red', 'light_green', 'light_yellow', 'light_blue',
  'light_magenta', 'light_cyan', 'light_white',
])

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isValidColor(value) {
  if (typeof value !== 'string') return false
  const v = value.trim().toLowerCase()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return true
  return NAMED_COLORS.has(v)
}

function normalizeColor(value, fallback) {
  return isValidColor(value) ? String(value).trim() : fallback
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

function normalizeInt(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

function normalizeBool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeString(value, fallback, maxLength = 64) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) return fallback
  return value
}

function normalizeModuleList(value, fallback) {
  if (!Array.isArray(value)) return [...fallback]
  const list = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
  return list.length > 0 ? list : [...fallback]
}

function normalizeChar(value, fallback) {
  if (typeof value !== 'string') return fallback
  const chars = Array.from(value)
  return chars.length === 1 ? value : fallback
}

/**
 * 把任意 row config 归一化成完整配置。
 * 未知字段会被忽略；非法值回退到默认值，不抛异常。
 */
export function normalizeConfig(raw) {
  const input = isPlainObject(raw) ? raw : {}
  const d = DEFAULT_CONFIG
  const displayIn = isPlainObject(input.display) ? input.display : {}
  const colorsIn = isPlainObject(input.colors) ? input.colors : {}
  const thresholdsIn = isPlainObject(input.thresholds) ? input.thresholds : {}
  const dshIn = isPlainObject(input.dsh) ? input.dsh : {}
  const generalIn = isPlainObject(input.general) ? input.general : {}

  const memoryIn = isPlainObject(thresholdsIn.memory) ? thresholdsIn.memory : {}
  const diskIn = isPlainObject(thresholdsIn.disk) ? thresholdsIn.disk : {}
  const cpuTempIn = isPlainObject(thresholdsIn.cpuTemp) ? thresholdsIn.cpuTemp : {}

  return {
    modules: normalizeModuleList(input.modules, d.modules),
    display: {
      logo: normalizeEnum(displayIn.logo, LOGO_NAMES, d.display.logo),
      logoPosition: normalizeEnum(displayIn.logoPosition, LOGO_POSITION_NAMES, d.display.logoPosition),
      logoPadding: normalizeInt(displayIn.logoPadding, d.display.logoPadding, 0, 16),
      icons: normalizeEnum(displayIn.icons, ICON_NAMES, d.display.icons),
      keyType: normalizeEnum(displayIn.keyType, KEY_TYPE_NAMES, d.display.keyType),
      keyWidth: normalizeInt(displayIn.keyWidth, d.display.keyWidth, 0, 40),
      separator: normalizeString(displayIn.separator, d.display.separator, 16),
      width: normalizeInt(displayIn.width, d.display.width, 0, 200),
      barWidth: normalizeInt(displayIn.barWidth, d.display.barWidth, 1, 40),
      barCharElapsed: normalizeChar(displayIn.barCharElapsed, d.display.barCharElapsed),
      barCharTotal: normalizeChar(displayIn.barCharTotal, d.display.barCharTotal),
      color: normalizeEnum(displayIn.color, COLOR_MODE_NAMES, d.display.color),
      language: normalizeEnum(displayIn.language, LANGUAGE_NAMES, d.display.language),
    },
    // 只保留用户显式配置的颜色；主题色由 render/color.js 的 THEMES 提供。
    colors: Object.fromEntries(
      ['title', 'key', 'output', 'separator', 'ok', 'warn', 'crit', 'accent']
        .filter((key) => colorsIn[key] !== undefined && isValidColor(colorsIn[key]))
        .map((key) => [key, String(colorsIn[key]).trim()]),
    ),
    thresholds: {
      memory: {
        warn: normalizeInt(memoryIn.warn, d.thresholds.memory.warn, 0, 100),
        crit: normalizeInt(memoryIn.crit, d.thresholds.memory.crit, 0, 100),
      },
      disk: {
        warn: normalizeInt(diskIn.warn, d.thresholds.disk.warn, 0, 100),
        crit: normalizeInt(diskIn.crit, d.thresholds.disk.crit, 0, 100),
      },
      cpuTemp: {
        warn: normalizeInt(cpuTempIn.warn, d.thresholds.cpuTemp.warn, 0, 120),
        crit: normalizeInt(cpuTempIn.crit, d.thresholds.cpuTemp.crit, 0, 120),
      },
    },
    dsh: {
      showVersion: normalizeBool(dshIn.showVersion, d.dsh.showVersion),
      showMode: normalizeBool(dshIn.showMode, d.dsh.showMode),
      showModel: normalizeBool(dshIn.showModel, d.dsh.showModel),
      showPlugins: normalizeBool(dshIn.showPlugins, d.dsh.showPlugins),
      showSkills: normalizeBool(dshIn.showSkills, d.dsh.showSkills),
      showSession: normalizeBool(dshIn.showSession, d.dsh.showSession),
      showCwd: normalizeBool(dshIn.showCwd, d.dsh.showCwd),
      maxPlugins: normalizeInt(dshIn.maxPlugins, d.dsh.maxPlugins, 0, 1000),
      maxSkills: normalizeInt(dshIn.maxSkills, d.dsh.maxSkills, 0, 1000),
    },
    general: {
      timeoutMs: normalizeInt(generalIn.timeoutMs, d.general.timeoutMs, 100, 30000),
      cacheTtlMs: normalizeInt(generalIn.cacheTtlMs, d.general.cacheTtlMs, 0, 600000),
      showErrors: normalizeBool(generalIn.showErrors, d.general.showErrors),
    },
  }
}

const DISPLAY_OVERRIDE_KEYS = [
  'logo', 'logoPosition', 'logoPadding', 'icons', 'keyType',
  'keyWidth', 'separator', 'width', 'barWidth', 'barCharElapsed', 'barCharTotal',
  'color', 'language',
]

/** 把配置与本次调用覆盖项合并成统一的 options。 */
export function resolveOptions(config, overrides = {}) {
  const cfg = normalizeConfig(config)
  const display = { ...cfg.display }
  for (const key of DISPLAY_OVERRIDE_KEYS) {
    if (overrides[key] !== undefined) display[key] = overrides[key]
  }
  return {
    modules: overrides.modules ?? cfg.modules,
    structure: overrides.structure ?? null,
    category: normalizeEnum(overrides.category, CATEGORY_NAMES, 'all'),
    display,
    colors: { ...cfg.colors, ...(isPlainObject(overrides.colors) ? overrides.colors : {}) },
    thresholds: cfg.thresholds,
    dsh: cfg.dsh,
    general: {
      ...cfg.general,
      showErrors: overrides.showErrors ?? cfg.general.showErrors,
    },
    format: normalizeEnum(overrides.format, FORMAT_NAMES, 'text'),
    debug: Boolean(overrides.debug),
  }
}
