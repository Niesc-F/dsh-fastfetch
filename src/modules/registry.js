/** 模块注册表：排序、过滤、超时、错误隔离。 */

import { DEFAULT_MODULES } from '../config.js'
import { systemModules } from './system.js'
import { dshModules } from './dsh.js'

export const ALL_MODULES = [...systemModules, ...dshModules]
const MODULE_MAP = new Map(ALL_MODULES.map((module) => [module.id, module]))

export function listModules() {
  return ALL_MODULES.map((module) => ({
    id: module.id,
    category: module.category,
    default: DEFAULT_MODULES.includes(module.id),
    labels: module.labels,
    icons: module.icons,
  }))
}

function parseStructure(structure, defaults) {
  const raw = Array.isArray(structure) ? structure : String(structure ?? '').split(':')
  const tokens = raw.map((item) => String(item).trim()).filter(Boolean)
  if (tokens.length === 0) return [...defaults]
  const includes = []
  const excludes = []
  for (const token of tokens) {
    if (token === 'all') {
      includes.push(...ALL_MODULES.map((module) => module.id))
    } else if (token.startsWith('-')) {
      excludes.push(token.slice(1))
    } else {
      includes.push(token)
    }
  }
  const base = includes.length > 0 ? includes : [...defaults]
  for (const token of [...base, ...excludes]) {
    if (!MODULE_MAP.has(token)) {
      throw new Error(`未知模块 "${token}"；可用模块: ${ALL_MODULES.map((module) => module.id).join(', ')}`)
    }
  }
  const excluded = new Set(excludes)
  const result = []
  for (const id of base) {
    if (excluded.has(id)) continue
    if (!result.includes(id)) result.push(id)
  }
  return result
}

/**
 * 计算本次要显示的模块 id。
 * @param {string|string[]|null} structure --structure 值；null 用 defaults
 * @param {'all'|'system'|'dsh'} category
 * @param {string[]} defaults 配置里的默认模块
 */
export function resolveModuleList(structure, category, defaults = DEFAULT_MODULES) {
  const ids = parseStructure(structure ?? defaults, defaults)
  return ids.filter((id) => {
    if (category === 'all') return true
    return MODULE_MAP.get(id)?.category === category
  })
}

function withTimeout(promise, timeoutMs, id) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`模块 ${id} 超过 ${timeoutMs}ms`)), timeoutMs)
    timer.unref?.()
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * 并行采集模块，单个模块失败不影响其他模块。
 * @returns {Promise<{modules: object[], errors: {module: string, message: string}[]}>}
 */
export async function collectModules(ids, env, options) {
  const errors = []
  const results = await Promise.all(
    ids.map(async (id) => {
      const module = MODULE_MAP.get(id)
      if (!module) return null
      if (module.enabled && !module.enabled(env, options)) return null
      const started = Date.now()
      try {
        const value = await withTimeout(
          Promise.resolve(module.collect(env, options)),
          options.general.timeoutMs,
          id,
        )
        if (!value) return null
        return {
          id: module.id,
          category: module.category,
          label: module.labels[env.language] ?? module.labels.en ?? module.id,
          icon: module.icons[options.display.icons] ?? module.icons.emoji ?? '',
          durationMs: Date.now() - started,
          ...value,
        }
      } catch (error) {
        errors.push({ module: id, message: String(error?.message || error) })
        return null
      }
    }),
  )
  return { modules: results.filter(Boolean), errors }
}
