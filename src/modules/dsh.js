/** DSH 自身信息模块。 */

const MODE_LABELS = {
  standard: { en: 'Standard', zh: '标准' },
  ptc: { en: 'PTC', zh: 'PTC' },
  minimal: { en: 'Minimal', zh: '极简' },
  cordis: { en: 'Cordis', zh: 'Cordis' },
}

function modeLabel(preset, language) {
  if (!preset) return 'n/a'
  const mapped = MODE_LABELS[preset]
  return mapped ? (mapped[language] ?? mapped.en) : preset
}

function countBreakdown(env, total, builtinCount, thirdPartyCount) {
  if (env.language === 'zh') return `${total} 个（DSH 自带 ${builtinCount} · 第三方 ${thirdPartyCount}）`
  return `${total} (DSH ${builtinCount} · third-party ${thirdPartyCount})`
}

function detailBreakdown(env, builtin, thirdParty) {
  const names = (items) => items.map((item) => (typeof item === 'string' ? item : item.name)).join(', ')
  const parts = []
  if (builtin.length > 0) parts.push(`${env.language === 'zh' ? 'DSH 自带' : 'DSH'}: ${names(builtin)}`)
  if (thirdParty.length > 0) parts.push(`${env.language === 'zh' ? '第三方' : 'third-party'}: ${names(thirdParty)}`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

export const dshModules = [
  {
    id: 'dsh-version',
    category: 'dsh',
    default: true,
    labels: { en: 'DSH version', zh: 'DSH 版本' },
    icons: { emoji: '🐋', ascii: 'DSH', nerd: '\uf17a' },
    async collect(env, options) {
      if (!options.dsh.showVersion) return null
      return { value: env.getDshVersion() }
    },
  },
  {
    id: 'dsh-mode',
    category: 'dsh',
    default: true,
    labels: { en: 'Mode', zh: '会话模式' },
    icons: { emoji: '🧭', ascii: 'MODE', nerd: '\uf0eb' },
    async collect(env, options) {
      if (!options.dsh.showMode) return null
      const preset = env.getSessionInfo().preset
      return {
        value: modeLabel(preset, env.language),
        detailValue: preset && modeLabel(preset, env.language) !== preset ? `preset: ${preset}` : undefined,
      }
    },
  },
  {
    id: 'dsh-model',
    category: 'dsh',
    default: true,
    labels: { en: 'Model', zh: '当前模型' },
    icons: { emoji: '🤖', ascii: 'MODEL', nerd: '\uf085' },
    async collect(env, options) {
      if (!options.dsh.showModel) return null
      const model = await env.getModel()
      if (!model) return { value: 'n/a' }
      return {
        value: `${model.provider}/${model.model}`,
        detailValue: model.reasoningEffort ? `reasoning: ${model.reasoningEffort}` : undefined,
      }
    },
  },
  {
    id: 'dsh-plugins',
    category: 'dsh',
    default: true,
    labels: { en: 'Plugins', zh: '插件' },
    icons: { emoji: '🧩', ascii: 'PLUG', nerd: '\uf1e6' },
    async collect(env, options) {
      if (!options.dsh.showPlugins) return null
      const plugins = await env.getPlugins()
      const limit = options.dsh.maxPlugins > 0 ? options.dsh.maxPlugins : plugins.names.length
      const builtin = plugins.builtin.slice(0, limit)
      const thirdParty = plugins.thirdParty.slice(0, limit)
      return {
        value: countBreakdown(env, plugins.count, plugins.builtinCount, plugins.thirdPartyCount),
        detailValue: detailBreakdown(env, builtin, thirdParty),
      }
    },
  },
  {
    id: 'dsh-skills',
    category: 'dsh',
    default: true,
    labels: { en: 'Skills', zh: '技能' },
    icons: { emoji: '📚', ascii: 'SKILL', nerd: '\uf02d' },
    async collect(env, options) {
      if (!options.dsh.showSkills) return null
      const skills = await env.getSkills()
      const limit = options.dsh.maxSkills > 0 ? options.dsh.maxSkills : skills.names.length
      const builtin = skills.builtin.slice(0, limit)
      const thirdParty = skills.thirdParty.slice(0, limit)
      return {
        value: countBreakdown(env, skills.count, skills.builtinCount, skills.thirdPartyCount),
        detailValue: detailBreakdown(env, builtin, thirdParty),
      }
    },
  },
  {
    id: 'dsh-session',
    category: 'dsh',
    default: true,
    labels: { en: 'Session', zh: '当前会话' },
    icons: { emoji: '💬', ascii: 'SESS', nerd: '\uf075' },
    async collect(env, options) {
      if (!options.dsh.showSession) return null
      const session = env.getSessionInfo()
      const details = []
      if (session.preset) details.push(`preset: ${session.preset}`)
      if (session.createdAt) details.push(`created: ${new Date(session.createdAt).toISOString()}`)
      return {
        value: session.id,
        detailValue: details.length ? details.join(' · ') : undefined,
      }
    },
  },
  {
    id: 'dsh-cwd',
    category: 'dsh',
    default: true,
    labels: { en: 'Directory', zh: '工作目录' },
    icons: { emoji: '📁', ascii: 'CWD', nerd: '\uf07b' },
    async collect(env, options) {
      if (!options.dsh.showCwd) return null
      return { value: env.cwd || 'n/a' }
    },
  },
]
