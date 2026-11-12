# fastfetch 参考笔记

本文件记录 `reference/fastfetch`（不纳入 Git）的阅读结论，以及 dsh-fastfetch 的取舍。参考版本：

- 仓库：`https://github.com/fastfetch-cli/fastfetch`
- 分支：`dev`
- 当前 HEAD：`798e2ccc24b56711205709185e8a8dc6533c7a1a`

## 1. fastfetch 的分层

fastfetch 的核心分层可以概括为：

```text
CLI 参数 / JSONC 配置
        │
        ▼
   options/*（general、display、logo）
        │
        ▼
   detection/*（平台探测）
        │
        ▼
   modules/*（每个模块负责采集 + 输出自己的行）
        │
        ▼
   printing / logo / color（布局、logo、颜色）
```

对本插件有参考价值的是「模块注册表 + 每个模块只负责返回数据 + 统一渲染层」这一点，而不是它的 C 实现。

## 2. 参数体系（doc/help.json）

fastfetch 的帮助分 5 组：

| 分组 | 代表参数 | 本插件取舍 |
| --- | --- | --- |
| Informative | `--help`、`--version`、`--list-modules`、`--format`、`--json` | 全部保留（`--list-modules`、`--format`、`--json`） |
| Config | `--config`、`--gen-config` | 不采用配置文件路径；持久配置走 DSH 的插件 row config |
| General | `--thread`、`--processing-timeout` | 保留 `timeoutMs` 配置；不暴露线程参数 |
| Logo | `--logo`、`--logo-type`、`--logo-position`、`--logo-padding*`、`--file`/`--data` | 保留内置 logo、位置、padding；不读取任意文件/图片协议 |
| Display | `--structure`、`--color*`、`--key-*`、`--separator`、`--bar-*`、`--percent-*`、`--format` | 保留模块列表、颜色、key 列、分隔符、进度条、百分比；简化为更适合聊天的子集 |

fastfetch 的 `--structure` 使用 `:` 分隔模块，前缀 `-` 表示排除（例如 `os:kernel:-cpu`）。本插件沿用该语法，降低学习成本。

## 3. 配置键（src/options）

- `general`：`thread`、`processingTimeout`、`detectVersion`、`playerName`、`dsForceDrm`、`preload`。
- `display`：`separator`、`color`、`key`（type/paddingLeft/width）、`bar`（charElapsed/charTotal/border/width/color*）、`percent`（type/ndigits/color-green/yellow/red/width）、`size`、`freq`、`temp`、`duration`、`language`、`showErrors`、`pipe`。
- `logo`：`type`、`source`、`position`、`padding`、`width`、`height`、`preserveAspectRatio`、`color`、`printRemaining`、`cache`、`spin*`。

本插件把这些键重新组织为三个层级：`display`（外观）、`colors`（调色板）、`thresholds`（阈值），并补充 DSH 专属的 `dsh` 与 `general`。

## 4. 模块清单（src/modules）

fastfetch 的模块非常全，包括 `os`、`kernel`、`host`、`uptime`、`cpu`、`cpucache`、`cpuusage`、`memory`、`swap`、`disk`、`btrfs`、`zpool`、`localip`、`dns`、`wifi`、`netio`、`diskio`、`battery`、`poweradapter`、`gpu`、`display`、`brightness`、`sound`、`camera`、`gamepad`、`mouse`、`keyboard`、`tpm`、`weather`、`packages`、`processes`、`users`、`locale`、`datetime`、`version`、`colors` 等。

dsh-fastfetch 本期只取跨平台、低风险、与 DSH 相关的子集：

- 系统：`os`、`kernel`、`host`、`uptime`、`shell`、`terminal`、`cpu`、`memory`、`disk`、`localip`、`datetime`、`locale`。
- DSH：`dsh-version`、`dsh-model`、`dsh-plugins`、`dsh-skills`、`dsh-session`、`dsh-cwd`。
- 其余列为 P1 扩展位（见实施计划的模块章节）。

不采用的模块及原因：

| 模块 | 原因 |
| --- | --- |
| `command` / `custom` | 可执行任意命令，安全风险；本插件坚持只读、无 shell 注入 |
| `gpu` / `battery` / `display` / `brightness` / `sound` / `camera` / `gamepad` / `mouse` / `keyboard` / `tpm` | 平台差异大、探测成本高，且与 DSH 场景弱相关 |
| `weather` / `publicip` | 需要联网；默认关闭，后续可做 opt-in |

## 5. 布局与观感

fastfetch 的经典布局是「左 logo、右 key-value 信息」，key 列对齐，值列对齐；logo 支持 ASCII / 图片 / sixel / kitty 等。dsh-fastfetch 采用：

- 左 logo + 右信息两栏（默认），支持 `left/right/top` 和 `none`。
- 内置 DSH 字标，不读取任意文件。
- 信息行 `图标 + key + 分隔符 + value`；key 按显示宽度对齐。
- 内存/磁盘用 `[■■■■■-----] 50%` 进度条。
- 颜色通过内置调色板 + ANSI；Web 端由 Client 卡片解析 ANSI 渲染。
- 不实现 sixel/kitty/chafa 等终端图片协议，保证聊天/跨平台一致。

## 6. 本插件的取舍总结

| 维度 | fastfetch | dsh-fastfetch |
| --- | --- | --- |
| 语言 | C | 纯 ESM JavaScript |
| 配置 | JSONC 文件 | DSH 插件 row config（JSON 对象） |
| 模块 | 70+ | 20 个 P0，P1 可扩展 |
| 输入 | CLI 参数 | `/fastfetch` 命令 + `fastfetch` 工具 |
| 颜色 | ANSI/终端 | ANSI + Client 彩色卡片 |
| 网络 | 支持公网 IP/天气 | 默认不联网 |
| Logo | 文件/图片/协议 | 内置字标，安全只读 |
| 目标 | 终端 | DSH Web 聊天 + 工具结果 |
