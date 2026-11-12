/** 系统信息模块（跨平台，Node 标准库优先）。 */

import fs from 'node:fs'
import os from 'node:os'
import { PLUGIN_VERSION } from '../config.js'
import { runFile } from '../util/exec.js'
import { formatBytes, formatFrequency, formatUptime } from '../util/units.js'

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

function parseOsRelease(text) {
  const map = new Map()
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (!match) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    map.set(match[1], value)
  }
  return map
}

async function detectOs() {
  const platform = process.platform
  if (platform === 'win32') {
    const name = typeof os.version === 'function' ? os.version() : 'Windows'
    return `${name} (${os.release()})`
  }
  if (platform === 'darwin') {
    const result = await runFile('sw_vers', ['-productVersion'], { timeoutMs: 800 })
    return result.ok ? `macOS ${result.stdout}` : `macOS (${os.release()})`
  }
  const release = parseOsRelease(safeRead('/etc/os-release'))
  if (release.get('PRETTY_NAME')) return release.get('PRETTY_NAME')
  if (release.get('NAME')) return `${release.get('NAME')} ${release.get('VERSION') ?? ''}`.trim()
  return `${os.type()} ${os.release()}`
}

// 只认这三家的消费级/工作站显卡；虚拟显示器、国产卡、远程显卡一律不显示。
// Apple 单列：macOS 上那是真实硬件，不列进来那里永远是 unknown。
const GPU_WHITELIST = /nvidia|geforce|quadro|tesla|radeon|\bamd\b|intel|iris|uhd graphics|arc graphics|apple/i

function pickKnownGpus(names) {
  const seen = new Set()
  for (const raw of names) {
    const name = String(raw ?? '').trim()
    if (!name) continue
    if (!GPU_WHITELIST.test(name)) continue
    seen.add(name)
  }
  return [...seen]
}

async function detectGpu() {
  if (process.platform === 'win32') {
    for (const command of ['powershell.exe', 'pwsh.exe']) {
      const result = await runFile(
        command,
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          '(Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name) -join "`n"',
        ],
        { timeoutMs: 1500 },
      )
      if (result.ok && result.stdout) {
        const picked = pickKnownGpus(result.stdout.split('\n'))
        if (picked.length) return picked.join(' / ')
      }
    }
    return ''
  }
  if (process.platform === 'darwin') {
    const result = await runFile('system_profiler', ['SPDisplaysDataType'], { timeoutMs: 2500 })
    if (result.ok) {
      const matches = [...result.stdout.matchAll(/Chipset Model:\s*(.+)/g)].map((m) => m[1].trim())
      const picked = pickKnownGpus(matches)
      if (picked.length) return picked.join(' / ')
    }
    return ''
  }
  const lspci = await runFile('lspci', [], { timeoutMs: 1200 })
  if (lspci.ok) {
    const lines = lspci.stdout
      .split('\n')
      .filter((line) => /VGA compatible controller|3D controller|Display controller/i.test(line))
      .map((line) => line.split(': ').slice(1).join(': ').replace(/\s*\[[0-9a-f]{4}\]:?/gi, '').trim())
      .filter(Boolean)
    const picked = pickKnownGpus(lines)
    if (picked.length) return picked.join(' / ')
  }
  // 没有 lspci 时读 DRM 设备号
  try {
    const cards = fs.readdirSync('/sys/class/drm').filter((name) => /^card\d+$/.test(name))
    const names = []
    for (const card of cards) {
      const vendor = safeRead(`/sys/class/drm/${card}/device/vendor`).trim()
      const device = safeRead(`/sys/class/drm/${card}/device/device`).trim()
      if (vendor && device) names.push(`${vendor}:${device}`)
    }
    const picked = pickKnownGpus(names)
    if (picked.length) return picked.join(' / ')
  } catch {
    // 忽略
  }
  return ''
}

async function detectHostModel() {
  if (process.platform === 'win32') {
    for (const command of ['powershell.exe', 'pwsh.exe']) {
      const result = await runFile(
        command,
        ['-NoProfile', '-NonInteractive', '-Command', '(Get-CimInstance Win32_ComputerSystem).Model'],
        { timeoutMs: 800 },
      )
      if (result.ok && result.stdout) return result.stdout
    }
    return ''
  }
  if (process.platform === 'darwin') {
    const result = await runFile('sysctl', ['-n', 'hw.model'], { timeoutMs: 600 })
    return result.ok ? result.stdout : ''
  }
  return safeRead('/sys/devices/virtual/dmi/id/product_name').trim()
}

function diskRoot() {
  if (process.platform === 'win32') {
    const drive = process.env.SystemDrive || 'C:'
    return `${drive}\\`
  }
  return '/'
}

function statfsInfo(root) {
  try {
    const stats = fs.statfsSync(root)
    const total = Number(stats.bsize) * Number(stats.blocks)
    const free = Number(stats.bsize) * Number(stats.bavail)
    if (!Number.isFinite(total) || total <= 0) return null
    const used = Math.max(0, total - free)
    return { total, free, used, percent: (used / total) * 100 }
  } catch {
    return null
  }
}

function windowsDisks() {
  const rows = []
  for (let code = 65; code <= 90; code += 1) {
    const letter = String.fromCharCode(code)
    const root = `${letter}:\\`
    const info = statfsInfo(root)
    if (!info) continue
    rows.push({
      label: letter,
      value: `${formatBytes(info.used)} / ${formatBytes(info.total)}`,
      detailValue: `free ${formatBytes(info.free)} · ${root}`,
      percent: info.percent,
      bar: true,
    })
  }
  return rows
}

async function unixDisks() {
  const result = await runFile('df', ['-P', '-k'], { timeoutMs: 800 })
  if (result.ok) {
    const rows = []
    const seen = new Set()
    for (const line of result.stdout.split(/\r?\n/).slice(1)) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 6) continue
      const fsName = parts[0]
      if (/^(tmpfs|devtmpfs|devfs|proc|sysfs|none|overlay|udev|efivarfs|cgroup.*)$/i.test(fsName)) continue
      if (seen.has(fsName)) continue
      const totalK = Number(parts[1])
      const usedK = Number(parts[2])
      const freeK = Number(parts[3])
      if (!Number.isFinite(totalK) || totalK <= 0) continue
      const mount = parts.slice(5).join(' ')
      if (!mount.startsWith('/')) continue
      seen.add(fsName)
      const total = totalK * 1024
      const used = usedK * 1024
      const free = freeK * 1024
      rows.push({
        label: mount,
        value: `${formatBytes(used)} / ${formatBytes(total)}`,
        detailValue: `free ${formatBytes(free)} · ${fsName}`,
        percent: (used / total) * 100,
        bar: true,
      })
    }
    if (rows.length > 0) return rows
  }
  const root = statfsInfo('/')
  return root
    ? [{
        label: '/',
        value: `${formatBytes(root.used)} / ${formatBytes(root.total)}`,
        detailValue: `free ${formatBytes(root.free)} · /`,
        percent: root.percent,
        bar: true,
      }]
    : []
}

async function detectDisks() {
  if (process.platform === 'win32') return windowsDisks()
  return unixDisks()
}

function detectLocalIp() {
  const interfaces = os.networkInterfaces()
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.internal) continue
      if (address.family !== 'IPv4') continue
      if (address.address.startsWith('169.254.')) continue
      return {
        value: address.address,
        detailValue: `${name}${address.mac && address.mac !== '00:00:00:00:00:00' ? ` · ${address.mac}` : ''}`,
      }
    }
  }
  return null
}

export const systemModules = [
  {
    id: 'title',
    category: 'system',
    default: true,
    labels: { en: 'Title', zh: '标题' },
    icons: { emoji: '🐋', ascii: 'DSH', nerd: '\uf17a' },
    async collect() {
      return { value: `DSH FastFetch v${PLUGIN_VERSION}` }
    },
  },
  {
    id: 'separator',
    category: 'system',
    default: true,
    labels: { en: 'Separator', zh: '分隔线' },
    icons: { emoji: '', ascii: '', nerd: '' },
    async collect() {
      return { value: '', separator: true }
    },
  },
  {
    id: 'os',
    category: 'system',
    default: true,
    labels: { en: 'OS', zh: '操作系统' },
    icons: { emoji: '🖥️', ascii: 'OS', nerd: '\uf17a' },
    async collect() {
      return { value: await detectOs() }
    },
  },
  {
    id: 'kernel',
    category: 'system',
    default: true,
    labels: { en: 'Kernel', zh: '内核' },
    icons: { emoji: '🧩', ascii: 'KRN', nerd: '\uf17c' },
    async collect() {
      return { value: os.release() }
    },
  },
  {
    id: 'host',
    category: 'system',
    default: true,
    labels: { en: 'Host', zh: '主机' },
    icons: { emoji: '🏷️', ascii: 'HOST', nerd: '\uf108' },
    async collect(env, options) {
      const model = options.display.detail === 'full' ? await detectHostModel() : ''
      return {
        value: `${os.hostname()} (${os.arch()})`,
        detailValue: model || undefined,
      }
    },
  },
  {
    id: 'uptime',
    category: 'system',
    default: true,
    labels: { en: 'Uptime', zh: '运行时长' },
    icons: { emoji: '⏱️', ascii: 'UP', nerd: '\uf017' },
    async collect() {
      return { value: formatUptime(os.uptime()) }
    },
  },
  {
    id: 'shell',
    category: 'system',
    default: true,
    labels: { en: 'Shell', zh: 'Shell' },
    icons: { emoji: '🐚', ascii: 'SH', nerd: '\uf120' },
    async collect() {
      const value = process.platform === 'win32'
        ? (process.env.ComSpec || 'cmd.exe')
        : (process.env.SHELL || 'unknown')
      return { value }
    },
  },
  {
    id: 'terminal',
    category: 'system',
    default: true,
    labels: { en: 'Terminal', zh: '终端' },
    icons: { emoji: '⌨️', ascii: 'TERM', nerd: '\uf120' },
    async collect() {
      // 桌面端与 WebUI 都跑在 DSH 自己的进程里，不一定有终端环境变量；
      // 识别不到时按运行形态区分：Electron 是桌面端，纯 Node 是 Web 端。
      let value = process.versions.electron
        ? 'DeepSeek Harness Desktop'
        : 'DeepSeek Harness Web'
      const term = process.env.TERM
      if (process.env.WT_SESSION) value = 'Windows Terminal'
      else if (process.env.TERM_PROGRAM) value = process.env.TERM_PROGRAM
      // dumb / unknown 不算真实终端，交给上面的运行形态判断兜底
      else if (term && term !== 'dumb' && term !== 'unknown') value = term
      return { value }
    },
  },
  {
    id: 'cpu',
    category: 'system',
    default: true,
    labels: { en: 'CPU', zh: 'CPU' },
    icons: { emoji: '⚙️', ascii: 'CPU', nerd: '\uf085' },
    async collect(env, options) {
      const cpus = os.cpus()
      if (!cpus.length) return { value: 'n/a' }
      const model = cpus[0].model.trim()
      const speed = cpus[0].speed
      return {
        value: `${model} (${cpus.length} cores)`,
        detailValue: options.display.detail === 'full' ? formatFrequency(speed) : undefined,
      }
    },
  },
  {
    id: 'gpu',
    category: 'system',
    default: true,
    labels: { en: 'GPU', zh: '显卡' },
    icons: { emoji: '🎮', ascii: 'GPU', nerd: '\uf11b' },
    async collect() {
      const value = await detectGpu()
      return { value: value || 'unknown' }
    },
  },
  {
    id: 'memory',
    category: 'system',
    default: true,
    labels: { en: 'Memory', zh: '内存' },
    icons: { emoji: '🧠', ascii: 'MEM', nerd: '\uf035' },
    async collect() {
      const total = os.totalmem()
      const free = os.freemem()
      const used = Math.max(0, total - free)
      return {
        value: `${formatBytes(used)} / ${formatBytes(total)}`,
        detailValue: `free ${formatBytes(free)}`,
        percent: total > 0 ? (used / total) * 100 : 0,
        bar: true,
      }
    },
  },
  {
    id: 'disk',
    category: 'system',
    default: true,
    labels: { en: 'Disk', zh: '磁盘' },
    icons: { emoji: '💽', ascii: 'DSK', nerd: '\uf0a0' },
    async collect() {
      const disks = await detectDisks()
      if (disks.length === 0) return { value: 'n/a' }
      return {
        value: `${disks.length} drives`,
        rows: disks,
      }
    },
  },
  {
    id: 'localip',
    category: 'system',
    default: true,
    labels: { en: 'Local IP', zh: '本地 IP' },
    icons: { emoji: '🌐', ascii: 'IP', nerd: '\uf0ac' },
    async collect() {
      return detectLocalIp() ?? { value: 'n/a' }
    },
  },
  {
    id: 'datetime',
    category: 'system',
    default: false,
    labels: { en: 'Date & time', zh: '日期时间' },
    icons: { emoji: '🕒', ascii: 'TIME', nerd: '\uf017' },
    async collect(env) {
      const locale = env.language === 'zh' ? 'zh-CN' : 'en-US'
      return {
        value: new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date()),
      }
    },
  },
  {
    id: 'locale',
    category: 'system',
    default: false,
    labels: { en: 'Locale', zh: '区域设置' },
    icons: { emoji: '🌍', ascii: 'LOC', nerd: '\uf0ac' },
    async collect() {
      return {
        value: process.env.LANG || process.env.LC_ALL || Intl.DateTimeFormat().resolvedOptions().locale || 'unknown',
      }
    },
  },
]
