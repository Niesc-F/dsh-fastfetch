/** DSH 上下文适配：会话、模型、插件、技能、版本、工作目录。 */

import fs from 'node:fs'
import path from 'node:path'
import { resolveLanguage } from './i18n.js'

function safeGet(ctx, name) {
  try {
    return ctx?.get?.(name)
  } catch {
    return undefined
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

function readDshVersion() {
  const candidates = []
  if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, 'package.json'))
  const execDir = path.dirname(process.execPath)
  candidates.push(path.join(execDir, 'resources', 'package.json'))
  candidates.push(path.join(execDir, '..', 'resources', 'package.json'))
  for (const file of candidates) {
    const pkg = readJson(file)
    if (pkg && typeof pkg.version === 'string' && pkg.version) return pkg.version
  }
  return process.env.DSH_VERSION || 'unknown'
}

function readProfileBundles() {
  const dir = process.env.DSH_PROFILE_DIR
  if (!dir) return []
  const pkg = readJson(path.join(dir, 'package.json'))
  const bundles = pkg?.dsh?.profile?.bundles
  return Array.isArray(bundles) ? bundles.filter((x) => typeof x === 'string') : []
}

/** DSH 官方插件包统一使用 @deepseek-ai/ 作用域。 */
function isDshBuiltinPackage(name) {
  return typeof name === 'string' && name.startsWith('@deepseek-ai/')
}

function groupCounts(items, isBuiltin) {
  const builtin = items.filter(isBuiltin)
  const thirdParty = items.filter((item) => !isBuiltin(item))
  return { builtin, thirdParty, builtinCount: builtin.length, thirdPartyCount: thirdParty.length }
}

const CACHE = new Map()

function cached(key, ttlMs, loader) {
  const ttl = Number(ttlMs) || 0
  if (ttl <= 0) return loader()
  const now = Date.now()
  const hit = CACHE.get(key)
  if (hit && now - hit.time < ttl) return hit.value
  const value = loader()
  CACHE.set(key, { time: now, value })
  return value
}

/**
 * @param {object} ctx Cordis context
 * @param {object} agent Agent
 * @param {object} config 归一化后的插件配置
 */
export function createContext(ctx, agent, config) {
  const session = agent?.session ?? (agent?.id ? safeGet(ctx, 'sessions')?.get?.(agent.id) : undefined)
  const cwd = session?.header?.cwd
    ?? (session ? safeGet(ctx, 'workingDirectory')?.get?.(session) : undefined)
  const hostLocale = Intl.DateTimeFormat().resolvedOptions().locale
  const language = resolveLanguage(config?.display?.language, hostLocale)
  const cacheTtl = config?.general?.cacheTtlMs ?? 0
  const agentKey = String(agent?.id ?? 'global')

  let modelPromise
  let pluginsPromise
  let skillsPromise

  function getModel() {
    if (!modelPromise) {
      modelPromise = cached(`model:${agentKey}`, cacheTtl, async () => {
        try {
          const header = session?.requestHeader?.()
          if (header?.config?.provider && header?.config?.model) {
            const model = {
              provider: header.config.provider,
              model: header.config.model,
            }
            if (header.config.reasoningEffort) model.reasoningEffort = header.config.reasoningEffort
            return model
          }
        } catch {
          // 没有请求头时回退到默认模型选择
        }
        try {
          const selection = safeGet(ctx, 'agentDefaultModel')?.currentSelection?.()
          if (selection?.provider && selection?.model) {
            const model = {
              provider: selection.provider,
              model: selection.model,
            }
            if (selection.reasoningEffort) model.reasoningEffort = selection.reasoningEffort
            return model
          }
        } catch {
          // 服务不可用时返回 null
        }
        return null
      })
    }
    return modelPromise
  }

  function getPlugins() {
    if (!pluginsPromise) {
      pluginsPromise = cached(`plugins:${process.env.DSH_PROFILE_DIR ?? 'default'}`, cacheTtl, async () => {
        const names = []
        try {
          const entries = safeGet(ctx, 'configEditor')?.entries?.()
          if (Array.isArray(entries)) {
            for (const entry of entries) {
              const options = entry?.options ?? entry
              const name = String(options?.name ?? options?.id ?? '')
              if (!name || name.startsWith('cordis:')) continue
              if (options?.disabled === true || entry?.disabled === true) continue
              names.push(name)
            }
          }
        } catch {
          // 忽略，走 profile 回退
        }
        if (names.length === 0) names.push(...readProfileBundles())
        const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b))
        return {
          names: unique,
          count: unique.length,
          ...groupCounts(unique, isDshBuiltinPackage),
          source: unique.length ? 'runtime' : 'none',
        }
      })
    }
    return pluginsPromise
  }

  function getSkills() {
    if (!skillsPromise) {
      skillsPromise = cached(`skills:${agentKey}:${cwd ?? ''}`, cacheTtl, async () => {
        try {
          const service = safeGet(ctx, 'skills')
          if (!service?.list) return { names: [], count: 0, builtin: [], thirdParty: [], builtinCount: 0, thirdPartyCount: 0 }
          const list = await service.list({ scope: agent, cwd })
          const byName = new Map()
          for (const skill of Array.isArray(list) ? list : []) {
            if (typeof skill?.name !== 'string' || !skill.name) continue
            byName.set(skill.name, {
              name: skill.name,
              source: skill.source,
              provider: skill.provider,
            })
          }
          const entries = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
          const isBuiltin = (entry) => entry.source === 'bundled'
            || (entry.source === 'runtime' && isDshBuiltinPackage(entry.provider))
          return {
            names: entries.map((entry) => entry.name),
            count: entries.length,
            ...groupCounts(entries, isBuiltin),
          }
        } catch {
          return {
            names: [],
            count: 0,
            builtin: [],
            thirdParty: [],
            builtinCount: 0,
            thirdPartyCount: 0,
            error: 'skills unavailable',
          }
        }
      })
    }
    return skillsPromise
  }

  return {
    ctx,
    agent,
    config,
    session,
    cwd,
    language,
    hostLocale,
    platform: process.platform,
    now: () => new Date(),
    getModel,
    getPlugins,
    getSkills,
    getDshVersion: readDshVersion,
    getSessionInfo() {
      return {
        id: session?.id ? String(session.id) : 'unknown',
        preset: session?.header?.agentPreset ?? null,
        createdAt: session?.header?.createdAt ?? null,
      }
    },
  }
}
