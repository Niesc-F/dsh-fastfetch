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

/**
 * 从 app.asar 头部读出主包版本。
 * DSH 新版把版本号收进了 asar，磁盘上不再有 resources/package.json；
 * 这里自己解析 asar 目录再来定位 package.json，不依赖 Electron 的 fs 补丁，
 * 普通 node 进程也能读。只读头部和一个小文件，不会把整个 asar 读进内存。
 */
function readAsarVersion(asarPath) {
  let fd
  try {
    fd = fs.openSync(asarPath, 'r')
    const head = Buffer.alloc(16)
    if (fs.readSync(fd, head, 0, 16, 0) < 16) return undefined
    if (head.readUInt32LE(0) !== 4) return undefined
    const headerPickleSize = head.readUInt32LE(4)
    const jsonLength = head.readUInt32LE(12)
    if (!headerPickleSize || !jsonLength || jsonLength > 64 * 1024 * 1024) return undefined
    const headerBuffer = Buffer.alloc(jsonLength)
    fs.readSync(fd, headerBuffer, 0, jsonLength, 16)
    const node = JSON.parse(headerBuffer.toString('utf8'))?.files?.['package.json']
    if (!node || typeof node.size !== 'number') return undefined
    const dataStart = 8 + headerPickleSize
    const fileBuffer = Buffer.alloc(node.size)
    fs.readSync(fd, fileBuffer, 0, node.size, dataStart + Number(node.offset ?? 0))
    const pkg = JSON.parse(fileBuffer.toString('utf8'))
    return typeof pkg?.version === 'string' && pkg.version ? pkg.version : undefined
  } catch {
    return undefined
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd)
      } catch {
        // 关闭失败不影响结果
      }
    }
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
  // 新版只有 asar：依次试 <安装目录>/resources/app.asar 和进程自身的 resources
  const asarCandidates = []
  if (process.resourcesPath) asarCandidates.push(path.join(process.resourcesPath, 'app.asar'))
  asarCandidates.push(path.join(execDir, 'resources', 'app.asar'))
  asarCandidates.push(path.join(execDir, '..', 'resources', 'app.asar'))
  if (process.env.DSH_INSTALL_DIR) {
    // DSH_INSTALL_DIR 指向 ...\app.asar\dsh\node_modules\@deepseek-ai\dsh
    const marker = `${path.sep}app.asar${path.sep}`
    const at = process.env.DSH_INSTALL_DIR.indexOf(marker)
    if (at > 0) {
      asarCandidates.unshift(`${process.env.DSH_INSTALL_DIR.slice(0, at + marker.length - 1)}`)
    }
  }
  for (const asar of asarCandidates) {
    const version = readAsarVersion(asar)
    if (version) return version
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
