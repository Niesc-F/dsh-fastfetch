/** dsh-fastfetch 的 Host 入口：注册 /fastfetch 命令与 fastfetch 工具。 */

import { parseArgs } from './src/cli.js'
import { normalizeConfig, PLUGIN_VERSION } from './src/config.js'
import { createConfigApi, remoteContribution } from './src/config-api.js'
import { createContext } from './src/context.js'
import { runFastfetch } from './src/core.js'
import { helpText, resolveLanguage } from './src/i18n.js'
import { listModules } from './src/modules/registry.js'

export const name = 'dsh-fastfetch'
export const inject = ['tools', 'commands']

/** Client 设置页调用的服务名；endpoint 形如 `fastfetchApi/get`。 */
const API_SERVICE = 'fastfetchApi'

const API_METHODS = [
  ['get', []],
  ['diagnose', []],
  ['save', ['config']],
  ['patch', ['changes']],
  ['reset', []],
]

function hostLocale() {
  return Intl.DateTimeFormat().resolvedOptions().locale
}

function moduleListText(language) {
  const modules = listModules()
  const lines = [
    language === 'zh'
      ? `可用模块（${modules.length} 个，* 为默认显示）：`
      : `Available modules (${modules.length}, * = default):`,
  ]
  for (const module of modules) {
    const label = module.labels[language] ?? module.labels.en ?? module.id
    const marker = module.default ? '*' : ' '
    lines.push(`  ${marker} ${module.id.padEnd(14)} [${module.category}] ${label}`)
  }
  return lines.join('\n')
}

function toOverrides(args) {
  const input = args && typeof args === 'object' ? args : {}
  const overrides = {}
  if (Array.isArray(input.modules)) overrides.modules = input.modules
  if (input.category !== undefined) overrides.category = input.category
  if (input.detail !== undefined) overrides.detail = input.detail
  if (input.logo !== undefined) overrides.logo = input.logo ? 'dsh' : 'none'
  if (input.icons !== undefined) overrides.icons = input.icons
  if (input.color !== undefined) overrides.color = input.color
  if (input.format !== undefined) overrides.format = input.format
  if (input.width !== undefined) overrides.width = input.width
  // 工具默认不带 ANSI，模型看到的是纯文本；需要颜色时显式传 color: "always"。
  if (overrides.color === undefined) overrides.color = 'never'
  return overrides
}

export function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig)
  const envFor = (agent) => createContext(ctx, agent, config)

  // 设置页的读写通道。Client 半通过 `/api` 共享通道调用 `fastfetchApi/*`。
  const configApi = createConfigApi(ctx, rawConfig, listModules)
  ctx.provide(API_SERVICE, configApi)
  ctx.inject(['typert'], (remote) =>
    remote.typert.register(remoteContribution(name, API_SERVICE, API_METHODS)),
  )

  async function handleCommand(invocation) {
    try {
      const language = resolveLanguage(config.display.language, hostLocale())
      const parsed = parseArgs(invocation?.rawInput ?? '')
      if (parsed.help) return { kind: 'success', text: helpText(language) }
      if (parsed.version) return { kind: 'success', text: `dsh-fastfetch ${PLUGIN_VERSION}` }
      if (parsed.listModules) return { kind: 'success', text: moduleListText(language) }
      if (parsed.diag) {
        const info = await configApi.diagnose()
        const lines = [
          'dsh-fastfetch 配置诊断',
          `  entry id      : ${info.entryId ?? '(none)'}`,
          `  entry name    : ${info.entryName ?? '(none)'}`,
          `  fiber state   : ${info.fiberState ?? '(none)'}`,
          `  configEditor  : ${info.hasEditor ? 'available' : 'MISSING'}`,
          `  document      : ${info.documentPath ?? '(none)'}`,
          `  row config    : ${JSON.stringify(info.rowConfig ?? null)}`,
          `  explicit diff : ${JSON.stringify(info.explicit)}`,
        ]
        return { kind: 'success', text: lines.join('\n') }
      }
      // Web 端命令结果由 Client 卡片解析 ANSI，因此 auto 在命令路径下按 always 输出；
      // 工具路径的默认值是 never，模型始终看到纯文本。
      if (parsed.overrides.color === undefined && config.display.color === 'auto' && process.env.DSH_WEB_URL) {
        parsed.overrides.color = 'always'
      }
      const result = await runFastfetch(parsed.overrides, envFor(invocation?.agent))
      return { kind: 'success', text: result.text }
    } catch (error) {
      return { kind: 'error', text: `fastfetch: ${error?.message || error}` }
    }
  }

  // /fastfetch 与 /ff 是同一个命令的两个名字，参数与行为完全一致。
  for (const commandName of ['fastfetch', 'ff']) {
    ctx.effect(
      () => ctx.commands.register({
        name: commandName,
        description: '以 fastfetch 风格显示系统信息与 DSH 运行环境快照',
        input: { hint: `[选项] 输入 /${commandName} --help 查看全部参数` },
        handler: handleCommand,
      }),
      `dsh-fastfetch: /${commandName} command`,
    )
  }

  ctx.effect(
    () => ctx.tools.register({
      name: 'fastfetch',
      description:
        '显示当前机器的系统信息与 DSH 运行环境快照（操作系统、内核、主机、CPU、显卡、内存、磁盘、网络、运行时长、DSH 版本、会话模式、当前模型、已启用插件/技能、当前会话与工作目录）。当用户询问“当前环境/机器配置/DSH 运行情况”时使用。\n'
        + '调用约定：默认不传任何参数，直接使用用户当前的持久配置，把工具返回的文本原样完整贴给用户，不要总结、不要精简、不要改写、不要只挑几项复述，也不要自行补一句概括。\n'
        + '绝对不要为了“简洁”或“只讲重点”而传 modules、category、detail 去裁剪输出——除非用户在这一次请求里明确说了只看某几项。裁剪会隐藏用户已经开启的模块，等同于擅自改配置。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          modules: {
            type: 'array',
            items: { type: 'string' },
            description: '模块 id 及顺序；省略使用持久配置。可用模块见 /fastfetch --list-modules',
          },
          category: {
            type: 'string',
            enum: ['all', 'system', 'dsh'],
            description: '只显示系统或 DSH 信息，默认 all',
          },
          detail: {
            type: 'string',
            enum: ['brief', 'normal', 'full'],
            description: '精简 / 标准 / 详细，默认 normal',
          },
          logo: { type: 'boolean', description: '是否显示内置 logo' },
          icons: {
            type: 'string',
            enum: ['emoji', 'ascii', 'nerd', 'none'],
            description: '图标风格，默认 emoji',
          },
          color: {
            type: 'string',
            enum: ['auto', 'always', 'never'],
            description: '颜色模式；工具默认 never',
          },
          format: {
            type: 'string',
            enum: ['text', 'json'],
            description: '输出格式，默认 text',
          },
          width: {
            type: 'integer',
            minimum: 0,
            maximum: 200,
            description: '输出宽度，0 表示自动（横屏 100，竖屏 48）',
          },
        },
      },
      output: {
        schema: { type: 'string' },
        render(_args, value) {
          return [{ type: 'text', text: String(value) }]
        },
      },
      async execute(args, exec) {
        const result = await runFastfetch(toOverrides(args), envFor(exec?.agent))
        return result.text
      },
    }),
    'dsh-fastfetch: fastfetch tool',
  )
}
