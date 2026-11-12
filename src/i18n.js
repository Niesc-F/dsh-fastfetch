/** 中英文标签与命令帮助文本。 */

export const LABELS = {
  en: {
    title: 'DSH FastFetch',
    unknown: 'unknown',
    notAvailable: 'n/a',
    errors: 'Errors',
    plugins: 'Plugins',
    skills: 'Skills',
    model: 'Model',
    session: 'Session',
    cwd: 'Working directory',
    version: 'DSH version',
    none: 'none',
    enabled: 'enabled',
    module: 'module',
    warning: 'warning',
    detail: 'detail',
    preset: 'preset',
    created: 'created',
  },
  zh: {
    title: 'DSH FastFetch',
    unknown: '未知',
    notAvailable: 'n/a',
    errors: '错误',
    plugins: '插件',
    skills: '技能',
    model: '模型',
    session: '会话',
    cwd: '工作目录',
    version: 'DSH 版本',
    none: '无',
    enabled: '已启用',
    module: '模块',
    warning: '警告',
    detail: '详情',
    preset: '预设',
    created: '创建于',
  },
}

export function resolveLanguage(displayLanguage, hostLocale) {
  if (displayLanguage === 'zh' || displayLanguage === 'en') return displayLanguage
  const locale = String(hostLocale || '').toLowerCase()
  return locale.startsWith('zh') ? 'zh' : 'en'
}

const HELP_EN = `Usage: /fastfetch [options]   (/ff is the same command)

Selection:
  -s, --structure <list>       module ids separated by ':', prefix '-' to exclude
  --category <all|system|dsh>  only system or DSH information
  --list-modules               list all modules
  -h, --help                   show this help
  -v, --version                show plugin version

Presentation:
  --logo <dsh|none>            built-in logo (default: dsh)
  --logo-position <left|right|top>
  --no-logo                    same as --logo none
  --icons <emoji|ascii|nerd|none>
  --key-type <string|icon|none>
  --key-width <n>              key column width (default: 12)
  --separator <text>           key/value separator (default: ": ")
  --width <n>                  output width, 0 = auto (default: 0)
  --language <auto|zh|en>

Density:
  --compact                    no logo, compact output
  --bar-width <n>
  --bar-char-elapsed <char>
  --bar-char-total <char>

Colors:
  --color <auto|always|never>
  --color-keys <color>
  --color-output <color>
  --color-separator <color>
  --color-title <color>

Output:
  --format <text|json>
  --json                       same as --format json
  --detailed                   show full values instead of abbreviated ones
  --show-errors                show module collection errors
  --debug                      show timing and error details
  --diag                       print configuration diagnostics

Examples:
  /fastfetch
  /fastfetch -s os:kernel:cpu:memory:disk --no-logo --compact
  /fastfetch --category dsh
  /fastfetch --format json`

const HELP_ZH = `用法: /fastfetch [选项]   （/ff 是同一个命令）

选择:
  -s, --structure <列表>       模块 id 用 ':' 分隔，前缀 '-' 表示排除
  --category <all|system|dsh>  只显示系统或 DSH 信息
  --list-modules               列出全部模块
  -h, --help                   显示帮助
  -v, --version                显示插件版本

外观:
  --logo <dsh|none>            内置 logo（默认 dsh）
  --logo-position <left|right|top>
  --no-logo                    等价 --logo none
  --icons <emoji|ascii|nerd|none>
  --key-type <string|icon|none>
  --key-width <n>              key 列宽度（默认 12）
  --separator <文本>           key/value 分隔符（默认 ": "）
  --width <n>                  输出宽度，0=自动（默认 0）
  --language <auto|zh|en>

密度:
  --compact                    不显示 logo，只留紧凑信息
  --bar-width <n>
  --bar-char-elapsed <字符>
  --bar-char-total <字符>

颜色:
  --color <auto|always|never>
  --color-keys <颜色>
  --color-output <颜色>
  --color-separator <颜色>
  --color-title <颜色>

输出:
  --format <text|json>
  --json                       等价 --format json
  --detailed                   显示完整数值，不缩写
  --show-errors                显示模块采集错误
  --debug                      显示耗时与错误详情
  --diag                       输出配置诊断信息

示例:
  /fastfetch
  /fastfetch -s os:kernel:cpu:memory:disk --no-logo --compact
  /fastfetch --category dsh
  /fastfetch --format json`

export function helpText(lang) {
  return lang === 'zh' ? HELP_ZH : HELP_EN
}
