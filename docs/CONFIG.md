# dsh-fastfetch 配置参考

配置文件是插件在 DSH profile 的 `cordis.patch.yml` 中的 row `config`。插件内置默认值并做深合并，**只需要写想改的字段**；未知字段忽略，非法值回退默认值。

> 也可以直接改：打开 **设置 → Fastfetch**，用图形界面改相同的字段（保存时只写入与默认值不同的部分）。

> 注意：DSH 的 patch 对 `config` 是整块替换，不是深合并；本插件在自己的代码里做深合并，所以用户写部分字段不会丢掉其余默认值。

## 完整示例

```yaml
- id: dsh-fastfetch
  name: dsh-fastfetch
  config:
    modules:
      - title
      - separator
      - os
      - kernel
      - host
      - uptime
      - cpu
      - memory
      - disk
      - localip
      - dsh-version
      - dsh-mode
      - dsh-model
      - dsh-plugins
      - dsh-skills
      - dsh-session
      - dsh-cwd
    display:
      logo: dsh
      logoPosition: left
      logoPadding: 1
      icons: emoji
      keyType: string
      keyWidth: 12
      separator: ': '
      width: 0
      barWidth: 10
      barCharElapsed: '■'
      barCharTotal: '-'
      color: auto
      language: auto
    colors:
      title: '#ffd75f'
      key: '#7ad7f0'
    thresholds:
      memory:
        warn: 70
        crit: 90
      disk:
        warn: 80
        crit: 95
      cpuTemp:
        warn: 70
        crit: 90
    dsh:
      showVersion: true
      showMode: true
      showModel: true
      showPlugins: true
      showSkills: true
      showSession: true
      showCwd: true
      maxPlugins: 0
      maxSkills: 0
    general:
      timeoutMs: 1500
      cacheTtlMs: 5000
      showErrors: false
```

## 顶层字段

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `modules` | `string[]` | 见完整示例 | 默认显示模块及顺序；支持 `-id` 排除 |
| `display` | `object` | — | 外观、布局、颜色模式 |
| `colors` | `object` | 见下文默认色板 | 显式颜色覆盖；只写想覆盖的颜色 |
| `thresholds` | `object` | — | 内存/磁盘/温度阈值 |
| `dsh` | `object` | — | DSH 信息显示开关 |
| `general` | `object` | — | 超时、缓存、错误显示 |

## display

| 字段 | 类型 | 默认 | 可选值/范围 | 说明 |
| --- | --- | --- | --- | --- |
| `logo` | string | `dsh` | `dsh` `none` | 内置 logo，不读取文件 |
| `logoPosition` | string | `left` | `left` `right` `top` | logo 位置 |
| `logoPadding` | integer | `1` | 0–16 | logo 与信息列间距 |
| `icons` | string | `emoji` | `emoji` `none` | 图标风格 |
| `keyType` | string | `string` | `string` `icon` `none` | key 列显示方式 |
| `keyWidth` | integer | `12` | 0–40 | key 列显示宽度 |
| `separator` | string | `": "` | 1–16 字符 | key/value 分隔符 |
| `width` | integer | `0` | 0–200 | 0 = 自动（100 列） |
| `barWidth` | integer | `10` | 1–40 | 进度条宽度 |
| `barCharElapsed` | string | `■` | 单个字符 | 进度条已用字符 |
| `barCharTotal` | string | `-` | 单个字符 | 进度条未用字符 |
| `color` | string | `auto` | `auto` `always` `never` | ANSI 颜色模式 |
| `language` | string | `auto` | `auto` `zh` `en` | 标签语言 |

关于 `color`：

- `auto`：`/fastfetch` 在 Web 端按 `always` 输出 ANSI，由 Client 卡片渲染彩色终端；工具路径默认 `never`，模型看到纯文本。
- `always`：强制输出 ANSI；Web 的 Client 卡片会解析成彩色。
- `never`：纯文本，用 `[WARN]`/`!` 等标记表达状态。

## colors

颜色支持 `#RRGGBB`、`#RGB`、以及命名色：

`black`、`red`、`green`、`yellow`、`blue`、`magenta`、`cyan`、`white`、`light_black`、`light_red`、`light_green`、`light_yellow`、`light_blue`、`light_magenta`、`light_cyan`、`light_white`。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `title` | `#ffd75f` | 标题颜色 |
| `key` | `#7ad7f0` | key 颜色 |
| `output` | `#e6edf3` | value 颜色 |
| `separator` | `#8b949e` | 分隔符/次要文字 |
| `ok` | `#7bd88f` | 正常状态 |
| `warn` | `#f2c94c` | 警告状态 |
| `crit` | `#ff6b6b` | 危险状态 |
| `accent` | `#4fc3f7` | 图标/logo 强调色 |

示例：

```yaml
colors:
  key: '#00e5ff'
  output: '#ffffff'
  crit: '#ff5c8a'
```

## thresholds

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `thresholds.memory.warn` | integer | `70` | 内存黄色阈值（%） |
| `thresholds.memory.crit` | integer | `90` | 内存红色阈值（%） |
| `thresholds.disk.warn` | integer | `80` | 磁盘黄色阈值（%） |
| `thresholds.disk.crit` | integer | `95` | 磁盘红色阈值（%） |
| `thresholds.cpuTemp.warn` | integer | `70` | CPU 温度黄色阈值（℃） |
| `thresholds.cpuTemp.crit` | integer | `90` | CPU 温度红色阈值（℃） |

## dsh

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `showVersion` | boolean | `true` | 显示 DSH 版本 |
| `showMode` | boolean | `true` | 显示当前会话模式（标准/PTC/极简/Cordis） |
| `showModel` | boolean | `true` | 显示当前模型 |
| `showPlugins` | boolean | `true` | 显示已启用插件数量/列表（区分 DSH 自带与第三方） |
| `showSkills` | boolean | `true` | 显示已启用技能数量/列表（区分 DSH 自带与第三方） |
| `showSession` | boolean | `true` | 显示当前会话 |
| `showCwd` | boolean | `true` | 显示工作目录 |
| `maxPlugins` | integer | `0` | 0 = 全部；否则只显示前 N 个 |
| `maxSkills` | integer | `0` | 0 = 全部；否则只显示前 N 个 |

## general

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `timeoutMs` | integer | `1500` | 单模块采集超时（100–30000ms） |
| `cacheTtlMs` | integer | `5000` | 昂贵探测缓存时间（0–600000ms） |
| `showErrors` | boolean | `false` | 是否把采集错误显示为 `⚠` 行 |

## 命令行覆盖对照

`/fastfetch` 参数只影响本次调用，不写回配置。对应关系：

| 命令行 | 配置字段 |
| --- | --- |
| `--structure` / `-s` | `modules`（仅本次） |
| `--category` | 无（仅本次） |
| `--compact` | `display.logo: none` |
| `--logo` / `--no-logo` | `display.logo` |
| `--logo-position` | `display.logoPosition` |
| `--icons` | `display.icons` |
| `--key-type` | `display.keyType` |
| `--key-width` | `display.keyWidth` |
| `--separator` | `display.separator` |
| `--width` | `display.width` |
| `--bar-width` / `--bar-char-*` | `display.barWidth` / `display.barChar*` |
| `--color` | `display.color` |
| `--color-keys` / `--color-output` / `--color-separator` / `--color-title` | `colors.key` / `colors.output` / `colors.separator` / `colors.title` |
| `--language` | `display.language` |
| `--format` / `--json` | 无（仅本次） |
| `--show-errors` | `general.showErrors`（仅本次） |
| `--debug` | 无（仅本次） |

## 校验规则

- 枚举值非法 → 回退默认值。
- 数字超范围 → 收敛到边界值（CLI 参数则直接报错）。
- 颜色非法 → 忽略该颜色，使用默认色板。
- `modules` 中未知模块 → 命令报错并列出可用模块。
- 分隔符/进度条字符为空或非单字符 → 回退默认值。
