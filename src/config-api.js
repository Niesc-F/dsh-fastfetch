/**
 * 配置读写 API（Host 半）。
 *
 * Client 半的设置页通过 `/api` 共享通道调用这里的方法：
 * - `get()`  读取当前生效配置 + 可选值清单
 * - `save()` 写回 profile 的 cordis.patch.yml（只写与默认值不同的字段）
 * - `reset()` 清空本插件的配置覆盖，回到内置默认
 *
 * 持久化一律走 `configEditor.edit`，不直接改 patch 文件。
 */

import {
  COLOR_MODE_NAMES,
  DEFAULT_CONFIG,
  ICON_NAMES,
  KEY_TYPE_NAMES,
  LANGUAGE_NAMES,
  LOGO_NAMES,
  LOGO_POSITION_NAMES,
  PLUGIN_VERSION,
  normalizeConfig,
} from './config.js'

/** Client 设置页调用的服务名；endpoint 形如 `fastfetchApi/get`。 */
export const SERVICE_KEY = 'fastfetchApi'

/** 只保留与默认值不同的字段，避免把整份默认配置写进 patch。 */
export function diffConfig(value, base = DEFAULT_CONFIG) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return Array.isArray(base) && value.length === base.length && value.every((item, index) => item === base[index])
      ? undefined
      : value
  }
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    const reference = base?.[key]
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      const nested = diffConfig(item, reference)
      if (nested !== undefined && Object.keys(nested).length > 0) out[key] = nested
      continue
    }
    if (Array.isArray(item)) {
      const nested = diffConfig(item, reference)
      if (nested !== undefined) out[key] = nested
      continue
    }
    if (item !== reference) out[key] = item
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** 深合并：draft 覆盖 base。 */
export function mergeConfig(base, draft) {
  if (draft === null || typeof draft !== 'object' || Array.isArray(draft)) return draft
  const out = { ...(base ?? {}) }
  for (const [key, value] of Object.entries(draft)) {
    out[key] = mergeConfig(out[key], value)
  }
  return out
}

/** 供 client 半渲染表单的字段说明。 */
export function describeSchema() {
  const d = DEFAULT_CONFIG
  return {
    version: PLUGIN_VERSION,
    defaults: d,
    // 选项一律取自 config.js 的常量，避免表单和归一化各写一份而漂移。
    display: {
      logo: { options: LOGO_NAMES, default: d.display.logo },
      logoPosition: { options: LOGO_POSITION_NAMES, default: d.display.logoPosition },
      icons: { options: ICON_NAMES, default: d.display.icons },
      keyType: { options: KEY_TYPE_NAMES, default: d.display.keyType },
      color: { options: COLOR_MODE_NAMES, default: d.display.color },
      language: { options: LANGUAGE_NAMES, default: d.display.language },
      logoPadding: { min: 0, max: 16, default: d.display.logoPadding },
      keyWidth: { min: 0, max: 40, default: d.display.keyWidth },
      width: { min: 0, max: 200, default: d.display.width },
      barWidth: { min: 1, max: 40, default: d.display.barWidth },
    },
    thresholds: {
      memory: { warn: d.thresholds.memory.warn, crit: d.thresholds.memory.crit },
      disk: { warn: d.thresholds.disk.warn, crit: d.thresholds.disk.crit },
    },
    dsh: d.dsh,
    general: d.general,
  }
}

/**
 * 组装给 Client 的配置 API。
 * @param ctx 插件上下文
 * @param rawConfig 当前 row 的原始 config
 * @param listModules 模块元数据来源
 */
export function createConfigApi(ctx, rawConfig, listModules) {
  const readEntry = () => ctx?.fiber?.entry
  const readEditor = () => ctx?.get?.('configEditor')

  const snapshot = () => {
    const entry = readEntry()
    const raw = entry?.options?.config ?? rawConfig ?? {}
    return {
      config: normalizeConfig(raw),
      explicit: diffConfig(normalizeConfig(raw)) ?? {},
      schema: describeSchema(),
      modules: listModules(),
      patchId: entry?.options?.id ?? null,
      documentPath: readEditor()?.documentPath ?? null,
    }
  }

  const write = async (next) => {
    const entry = readEntry()
    const editor = readEditor()
    if (!entry || typeof editor?.edit !== 'function') {
      throw new Error('当前 profile 不支持写回配置（configEditor 不可用）')
    }
    const normalized = normalizeConfig(next)
    const trimmed = diffConfig(normalized)
    await editor.edit(entry, () => trimmed ?? {})
    return trimmed ?? {}
  }

  const api = {
    /** 读取当前配置与可选值。 */
    async get() {
      return snapshot()
    },

    /** 保存一份完整配置（只落盘与默认值不同的字段）。 */
    async save(config) {
      // typert 按 parameters 逐项传参，这里收到的是 config 本身；
      // 兼容直接传 { config } 的调用方。
      const draft = config && typeof config === 'object' && config.config !== undefined && config.written === undefined
        ? config.config
        : config
      if (draft === undefined || draft === null || typeof draft !== 'object') {
        throw new Error('缺少要保存的配置对象')
      }
      const written = await write(draft)
      return { saved: true, written, ...snapshot() }
    },

    /** 只改一个字段，便于小步调整。 */
    async patch(changes) {
      if (changes && typeof changes === 'object' && changes.changes !== undefined && changes.saved === undefined) {
        changes = changes.changes
      }
      if (!changes || typeof changes !== 'object') throw new Error('缺少要修改的字段')
      const current = normalizeConfig(readEntry()?.options?.config ?? rawConfig ?? {})
      const written = await write(mergeConfig(current, changes))
      return { saved: true, written, ...snapshot() }
    },

    /** 保存链路自检：entry 身份、configEditor 可用性、当前 row 配置。 */
    async diagnose() {
      const entry = readEntry()
      const editor = readEditor()
      return {
        entryId: entry?.options?.id ?? null,
        entryName: entry?.options?.name ?? null,
        hasEditor: typeof editor?.edit === 'function',
        documentPath: editor?.documentPath ?? null,
        rowConfig: entry?.options?.config ?? null,
        fiberState: ctx?.fiber?.state ?? null,
        normalized: normalizeConfig(entry?.options?.config ?? rawConfig ?? {}),
        explicit: diffConfig(normalizeConfig(entry?.options?.config ?? rawConfig ?? {})) ?? {},
      }
    },

    /** 清空本插件的覆盖，回到内置默认值。 */
    async reset() {
      const entry = readEntry()
      const editor = readEditor()
      if (!entry || typeof editor?.edit !== 'function') {
        throw new Error('当前 profile 不支持写回配置（configEditor 不可用）')
      }
      await editor.edit(entry, () => ({}))
      return { saved: true, written: {}, ...snapshot() }
    },
  }

  // typert gateway 只认带 `typertRemote` 绑定的服务对象；缺了它，
  // `/api` 上的端点会报 "has no visible typertRemote binding"。
  Object.defineProperty(api, 'typertRemote', {
    value: Object.freeze({
      service: api,
      serviceKey: SERVICE_KEY,
      namespace: SERVICE_KEY,
    }),
  })

  return api
}

/** typert 远端方法描述。 */
export function remoteContribution(packageName, service, methods) {
  const param = (name) => ({ name, wire: name, source: 'json', codec: { mode: 'src-json' } })
  const invocation = (method, params) => ({
    id: `${packageName}#${service}/${method}`,
    service,
    namespace: service,
    method,
    invocation: { kind: 'direct' },
    parameters: params.map(param),
    result: { mode: 'src-json' },
  })
  return {
    package: packageName,
    face: 'host',
    schemas: [],
    model: { services: [], events: [], objects: [] },
    invocations: methods.map(([method, params]) => invocation(method, params)),
  }
}
