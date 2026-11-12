/**
 * dsh-fastfetch 的 Client 半：把 /fastfetch 的命令结果渲染成彩色终端卡片。
 * 只做展示；命令执行与数据采集全部在 Host 半。
 */

window.__ModuleLoader__.load({
  id: 'dsh-fastfetch',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const BASIC_COLORS = {
      30: '#1f2328',
      31: '#ff6b6b',
      32: '#7bd88f',
      33: '#f2c94c',
      34: '#4fc3f7',
      35: '#d2a8ff',
      36: '#56d4dd',
      37: '#e6edf3',
      90: '#8b949e',
      91: '#ff9b9b',
      92: '#a5e8b0',
      93: '#ffe08a',
      94: '#8fd7ff',
      95: '#e3c2ff',
      96: '#8ceef2',
      97: '#ffffff',
    }

    // 信息区：严格中英等宽的字体，顺序与之前下拉框里选中的那套一致。
    const INFO_FONT_STACK =
      '"Sarasa Mono SC", "等距更纱黑体 SC", "Sarasa Fixed SC", ui-monospace, monospace'
    // 字标：块字符只在这组字体里是半角，换到 CJK 等宽字体会被排成全角、整块撑裂。
    const LOGO_FONT_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
    // Host 渲染时插在字标与信息之间的零宽分隔符
    const COLUMN_MARK = '\u200B'

    /**
     * 先按行拆、再把每行按零宽标记拆成「字标段」与「信息段」，最后各自解析 ANSI。
     * 顺序不能反：ANSI 分段边界落在标记前面，按分段拆会把字标漏到信息字体里。
     */
    function renderRows(text) {
      const rows = String(text ?? '').split('\n')
      const nodes = []
      rows.forEach((row, rowIndex) => {
        const at = row.indexOf(COLUMN_MARK)
        const segments = at >= 0
          ? [{ text: row.slice(0, at), art: true }, { text: row.slice(at + 1), art: false }]
          : [{ text: row, art: false }]
        for (const segment of segments) {
          if (!segment.text) continue
          parseAnsi(segment.text).forEach((part, partIndex) => {
            nodes.push(h('span', {
              key: `${rowIndex}-${segment.art ? 'a' : 'b'}-${partIndex}`,
              style: {
                color: part.fg || undefined,
                fontWeight: part.bold ? 600 : undefined,
                fontFamily: segment.art ? LOGO_FONT_STACK : undefined,
              },
            }, part.text))
          })
        }
        if (rowIndex < rows.length - 1) nodes.push('\n')
      })
      return nodes
    }

    function xterm256(n) {
      if (n < 16) return BASIC_COLORS[n < 8 ? 30 + n : 90 + (n - 8)] || '#e6edf3'
      if (n >= 232) {
        const v = 8 + (n - 232) * 10
        const hex = v.toString(16).padStart(2, '0')
        return `#${hex}${hex}${hex}`
      }
      const value = n - 16
      const r = Math.floor(value / 36)
      const g = Math.floor((value % 36) / 6)
      const b = value % 6
      const to = (x) => (x === 0 ? 0 : 55 + x * 40).toString(16).padStart(2, '0')
      return `#${to(r)}${to(g)}${to(b)}`
    }

    function applySgr(state, params) {
      const codes = params.length ? params : [0]
      for (let i = 0; i < codes.length; i += 1) {
        const code = codes[i]
        if (code === 0) {
          state.fg = null
          state.bold = false
        } else if (code === 1) {
          state.bold = true
        } else if (code === 22) {
          state.bold = false
        } else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
          state.fg = BASIC_COLORS[code] || null
        } else if (code === 39) {
          state.fg = null
        } else if (code === 38 && codes[i + 1] === 5) {
          state.fg = xterm256(codes[i + 2])
          i += 2
        } else if (code === 38 && codes[i + 1] === 2) {
          const r = codes[i + 2]
          const g = codes[i + 3]
          const b = codes[i + 4]
          if ([r, g, b].every((x) => Number.isFinite(x))) {
            state.fg = `rgb(${r}, ${g}, ${b})`
          }
          i += 4
        }
      }
    }

    function parseAnsi(text) {
      const parts = []
      const source = String(text ?? '')
      const state = { fg: null, bold: false }
      const regex = /\x1b\[([0-9;]*)m/g
      let last = 0
      let match
      const push = (value) => {
        if (!value) return
        parts.push({ text: value, fg: state.fg, bold: state.bold })
      }
      while ((match = regex.exec(source)) !== null) {
        push(source.slice(last, match.index))
        applySgr(state, match[1] ? match[1].split(';').map((v) => Number(v)) : [])
        last = regex.lastIndex
      }
      push(source.slice(last))
      return parts
    }

    function FastfetchCard(props) {
      const command = props?.node
      // conversation.chat.commandview 的 owner props 是 CommandNode 本身；
      // 兼容某些客户端包一层 data 的形态。
      const text = command?.outcome?.text ?? command?.data?.outcome?.text
      if (!text) {
        return h('div', {
          style: {
            padding: '8px 12px',
            color: 'var(--dsw-alias-label-secondary, #8b949e)',
            fontFamily: INFO_FONT_STACK,
            fontSize: 'var(--dsh-code-font-size, 11px)',
          },
        }, command?.name ?? command?.data?.name ?? 'fastfetch')
      }
      return h('div', {
        style: {
          margin: '6px 0',
          border: '1px solid var(--dsw-alias-border-primary, #30363d)',
          borderRadius: 8,
          background: 'var(--dsw-alias-bg-secondary, #0d1117)',
          padding: '10px 12px',
          overflowX: 'auto',
        },
      }, h('pre', {
        style: {
          margin: 0,
          fontFamily: INFO_FONT_STACK,
          fontSize: 'var(--dsh-code-font-size, 11px)',
          lineHeight: 1.5,
          whiteSpace: 'pre',
          color: 'var(--dsw-alias-label-primary, #e6edf3)',
        },
      }, renderRows(text)))
    }

    const NS = 'dsh-fastfetch'

    /** 完整的界面文案；设置页与导航名都从这里取。 */
    const DICT = {
      zh: {
        nav: 'FastFetch',
        title: 'FastFetch 系统信息',
        intro: '控制 /fastfetch、/ff 与 fastfetch 工具的输出内容与外观，三者共用同一份设置。保存后插件会重新加载。',
        loading: '正在读取配置…',
        retry: '重试',
        empty: '没有可用配置。',
        save: '保存',
        saving: '保存中…',
        reset: '恢复默认',
        savedAt: '已保存',
        sectionFeatures: '功能开关',
        sectionAppearance: '外观',
        sectionNumbers: '尺寸',
        sectionModules: '显示模块',
        sectionDsh: 'DSH 信息',
        sectionThresholds: '告警阈值',
        field_logo: 'DSH 字标',
        field_logoPosition: '字标位置',
        field_icons: '图标风格',
        field_keyType: '键列格式',
        hint_keyType: '键列是每行左边的名字：显示键=文字，仅图标=只画图标，无=只留值',
        field_color: '颜色模式',
        hint_color: '自动=聊天卡片着色、工具输出纯文本；始终=强制 ANSI；从不=关闭颜色',
        field_language: '打印语言',
        field_width: '输出宽度',
        field_keyWidth: '键列宽度',
        field_barWidth: '进度条宽度',
        field_logoPadding: '字标间距',
        field_memory: '内存',
        field_disk: '磁盘',
        field_warn: '警告',
        field_crit: '严重',
        value_windows: 'Windows',
        value_windows_11: 'Windows 11',
        value_macos: 'macOS',
        value_linux: 'Linux',
        value_ubuntu: 'Ubuntu',
        value_debian: 'Debian',
        value_linuxmint: 'Linux Mint',
        value_arch: 'Arch',
        value_endeavour: 'EndeavourOS',
        value_manjaro: 'Manjaro',
        value_fedora: 'Fedora',
        value_rhel: 'RHEL',
        value_centos: 'CentOS',
        value_rockylinux: 'Rocky Linux',
        value_almalinux: 'AlmaLinux',
        value_opensuse: 'openSUSE',
        value_alpine: 'Alpine',
        value_kali: 'Kali',
        value_raspbian: 'Raspbian',
        value_gentoo: 'Gentoo',
        value_nixos: 'NixOS',
        value_void: 'Void',
        value_slackware: 'Slackware',
        value_freebsd: 'FreeBSD',
        value_android: 'Android',
        value_haiku: 'Haiku',
        value_text: '文本',
        value_auto: '自动',
        value_none: '无',
        value_default: '默认',
        value_mono: '单色',
        value_neon: '霓虹',
        value_minimal: '极简',
        value_dsh: 'DSH',
        value_left: '左侧',
        value_right: '右侧',
        value_top: '顶部',
        value_brief: '精简',
        value_normal: '标准',
        value_full: '详细',
        value_emoji: 'Emoji',
        value_ascii: 'ASCII',
        value_nerd: 'Nerd Font',
        value_string: '显示键',
        value_icon: '仅图标',
        value_bar: '进度条',
        value_number: '文本',
        value_always: '始终',
        value_never: '从不',
        value_zh: '中文',
        value_en: 'English',
        field_showVersion: 'DSH 版本',
        field_showMode: '会话模式',
        field_showModel: '当前模型',
        field_showPlugins: '插件数量',
        field_showSkills: '技能数量',
        field_showSession: '当前会话',
        field_showCwd: '工作目录',
      },
      en: {
        nav: 'FastFetch',
        title: 'FastFetch system info',
        intro: 'Controls the output and appearance of /fastfetch, /ff and the fastfetch tool, which all share one set of settings. Saving reloads the plugin.',
        loading: 'Loading configuration…',
        retry: 'Retry',
        empty: 'No configuration available.',
        save: 'Save',
        saving: 'Saving…',
        reset: 'Reset',
        savedAt: 'Saved',
        sectionFeatures: 'Features',
        sectionAppearance: 'Appearance',
        sectionNumbers: 'Sizes',
        sectionModules: 'Modules',
        sectionDsh: 'DSH sections',
        sectionThresholds: 'Thresholds',
        field_logo: 'DSH wordmark',
        field_logoPosition: 'Wordmark position',
        field_icons: 'Icons',
        field_keyType: 'Key column',
        hint_keyType: 'The key column is the name on the left of each row: Keys shows text, Icon shows only the icon, None leaves the value alone',
        field_color: 'Color mode',
        hint_color: 'Auto colors chat cards and keeps tool output plain; Always forces ANSI; Never disables color',
        field_language: 'Print language',
        field_width: 'Width',
        field_keyWidth: 'Key width',
        field_barWidth: 'Bar width',
        field_logoPadding: 'Wordmark gap',
        field_memory: 'Memory',
        field_disk: 'Disk',
        field_warn: 'Warn',
        field_crit: 'Critical',
        value_windows: 'Windows',
        value_windows_11: 'Windows 11',
        value_macos: 'macOS',
        value_linux: 'Linux',
        value_ubuntu: 'Ubuntu',
        value_debian: 'Debian',
        value_linuxmint: 'Linux Mint',
        value_arch: 'Arch',
        value_endeavour: 'EndeavourOS',
        value_manjaro: 'Manjaro',
        value_fedora: 'Fedora',
        value_rhel: 'RHEL',
        value_centos: 'CentOS',
        value_rockylinux: 'Rocky Linux',
        value_almalinux: 'AlmaLinux',
        value_opensuse: 'openSUSE',
        value_alpine: 'Alpine',
        value_kali: 'Kali',
        value_raspbian: 'Raspbian',
        value_gentoo: 'Gentoo',
        value_nixos: 'NixOS',
        value_void: 'Void',
        value_slackware: 'Slackware',
        value_freebsd: 'FreeBSD',
        value_android: 'Android',
        value_haiku: 'Haiku',
        value_text: 'Text',
        value_auto: 'Auto',
        value_none: 'None',
        value_default: 'Default',
        value_mono: 'Mono',
        value_neon: 'Neon',
        value_minimal: 'Minimal',
        value_dsh: 'DSH',
        value_left: 'Left',
        value_right: 'Right',
        value_top: 'Top',
        value_brief: 'Brief',
        value_normal: 'Normal',
        value_full: 'Full',
        value_emoji: 'Emoji',
        value_ascii: 'ASCII',
        value_nerd: 'Nerd Font',
        value_string: 'Keys',
        value_icon: 'Icon only',
        value_bar: 'Bar',
        value_number: 'Text',
        value_always: 'Always',
        value_never: 'Never',
        value_zh: '中文',
        value_en: 'English',
        field_showVersion: 'DSH version',
        field_showMode: 'Session mode',
        field_showModel: 'Current model',
        field_showPlugins: 'Plugin count',
        field_showSkills: 'Skill count',
        field_showSession: 'Current session',
        field_showCwd: 'Working directory',
      },
    }

    /** 设置页样式：外壳会接管根节点的 style，所以内边距必须走 CSS 类。 */
    const SETTINGS_CSS = [
      '.ff-settings{display:flex;flex-direction:column;gap:12px;padding:16px 30px 30px;box-sizing:border-box;max-width:100%;font-size:13px;color:var(--dsw-alias-label-primary,#e6edf3);}',
      '.ff-settings .ff-card{border:0.5px solid var(--dsw-alias-border-l2,#30363d);border-radius:10px;padding:14px 16px;background:var(--dsw-alias-bg-layer-1,#0d1117);}',
    ].join('')

    const CARD_STYLE = {
      border: '0.5px solid var(--dsw-alias-border-l2, #30363d)',
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 12,
      background: 'var(--dsw-alias-bg-layer-1, #0d1117)',
    }

    const LABEL_STYLE = {
      color: 'var(--dsw-alias-label-primary, #e6edf3)',
      fontSize: 13,
      fontWeight: 500,
    }

    const HINT_STYLE = {
      color: 'var(--dsw-alias-label-secondary, #8b949e)',
      fontSize: 12,
      lineHeight: 1.5,
    }

    const ROW_STYLE = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '6px 0',
    }

    const INPUT_STYLE = {
      background: 'var(--dsw-alias-bg-base, #010409)',
      color: 'var(--dsw-alias-label-primary, #e6edf3)',
      border: '0.5px solid var(--dsw-alias-border-l2, #30363d)',
      borderRadius: 6,
      padding: '3px 6px',
      fontSize: 13,
      minWidth: 72,
    }

    const BUTTON_STYLE = {
      border: '0.5px solid var(--dsw-alias-border-l2, #30363d)',
      borderRadius: 6,
      padding: '5px 12px',
      fontSize: 13,
      cursor: 'pointer',
      background: 'var(--dsw-alias-bg-layer-2, #161b22)',
      color: 'var(--dsw-alias-label-primary, #e6edf3)',
    }

    const PRIMARY_BUTTON_STYLE = {
      ...BUTTON_STYLE,
      background: 'var(--dsw-alias-brand-primary, #388bfd)',
      borderColor: 'var(--dsw-alias-brand-primary, #388bfd)',
      color: '#ffffff',
    }

    /** 调 Host 半的 fastfetchApi/*；业务错误直接抛出。 */
    function makeRemote(connection) {
      return function call(method, args, signal) {
        if (!connection || !connection.rpc || typeof connection.rpc.call !== 'function') {
          return Promise.reject(new Error('RPC channel unavailable'))
        }
        return connection.rpc.call('/api', `fastfetchApi/${method}`, { args }, signal).then((envelope) => {
          if (!envelope || envelope.ok !== true) {
            const message = envelope && envelope.error !== undefined
              ? String(envelope.error.message !== undefined ? envelope.error.message : envelope.error)
              : 'remote call failed'
            throw new Error(message)
          }
          return envelope.value
        })
      }
    }

    function setPath(target, path, value) {
      const next = { ...target }
      let node = next
      for (let i = 0; i < path.length - 1; i += 1) {
        node[path[i]] = { ...(node[path[i]] ?? {}) }
        node = node[path[i]]
      }
      node[path[path.length - 1]] = value
      return next
    }

    function getPath(target, path) {
      let node = target
      for (const key of path) {
        if (node === undefined || node === null) return undefined
        node = node[key]
      }
      return node
    }

    function FastfetchSettings(props) {
      const owner = props ?? {}
      const rpc = owner.rpc
      const t = owner.t

      const [state, setState] = React.useState({ status: 'loading', error: null, data: null })
      const [draft, setDraft] = React.useState(null)
      const [saved, setSaved] = React.useState(null)

      const load = React.useCallback(() => {
        setState({ status: 'loading', error: null, data: null })
        return rpc('get', {}, undefined)
          .then((data) => {
            setState({ status: 'ready', error: null, data })
            setDraft(data.config)
            // 磁盘配置是权威来源，顺手同步到本地，卡片才知道该用哪个字体
          })
          .catch((error) => setState({ status: 'error', error: String(error?.message ?? error), data: null }))
      }, [rpc])

      React.useEffect(() => {
        load()
      }, [load])

      const save = () => {
        setState({ ...state, status: 'saving', error: null })
        rpc('save', { config: draft })
          .then((data) => {
            setState({ status: 'ready', error: null, data })
            setDraft(data.config)
            setSaved(new Date().toLocaleTimeString())
          })
          .catch((error) => setState({ ...state, status: 'ready', error: String(error?.message ?? error) }))
      }

      const reset = () => {
        setState({ ...state, status: 'saving', error: null })
        rpc('reset', {})
          .then((data) => {
            setState({ status: 'ready', error: null, data })
            setDraft(data.config)
            setSaved(new Date().toLocaleTimeString())
          })
          .catch((error) => setState({ ...state, status: 'ready', error: String(error?.message ?? error) }))
      }

      const update = (path, value) => setDraft((current) => setPath(current, path, value))

      if (state.status === 'loading') {
        return h('div', { style: { padding: 16, ...HINT_STYLE } }, t('loading'))
      }
      if (state.status === 'error') {
        return h('div', { style: { padding: 16 } }, [
          h('div', { key: 'e', style: { color: 'var(--dsw-alias-state-error-primary, #f85149)', fontSize: 13 } }, state.error),
          h('button', { key: 'r', type: 'button', style: { ...BUTTON_STYLE, marginTop: 10 }, onClick: load }, t('retry')),
        ])
      }
      if (!draft) return h('div', { style: { padding: 16, ...HINT_STYLE } }, t('empty'))

      const schema = state.data.schema
      const modules = state.data.modules ?? []
      const enabled = new Set(draft.modules ?? [])
      const display = draft.display ?? {}

      const select = (path, options, current) => h('select', {
        style: INPUT_STYLE,
        value: current,
        onChange: (event) => update(path, event.target.value),
      }, options.map((option) => h('option', { key: option, value: option }, t(`value_${option}`) || option)))

      const number = (path, spec, current) => h('input', {
        style: { ...INPUT_STYLE, width: 76 },
        type: 'number',
        min: spec.min,
        max: spec.max,
        value: current,
        onChange: (event) => {
          const raw = Number(event.target.value)
          if (Number.isFinite(raw)) update(path, Math.min(spec.max, Math.max(spec.min, Math.round(raw))))
        },
      })

      const toggle = (path, current) => h('input', {
        type: 'checkbox',
        checked: current === true,
        onChange: (event) => update(path, event.target.checked),
      })

      const row = (label, control) => h('div', { key: label, style: ROW_STYLE }, [
        h('span', { key: 'l', style: LABEL_STYLE }, label),
        h('div', { key: 'c' }, control),
      ])

      const card = (key, title, children) => h('div', { key, className: 'ff-card' }, [
        h('div', { key: 't', style: { ...LABEL_STYLE, fontWeight: 600, marginBottom: 6 } }, title),
        ...children,
      ])

      const actions = (key) => h('div', {
        key,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBottom: 4,
        },
      }, [
        h('button', { key: 's', type: 'button', style: PRIMARY_BUTTON_STYLE, disabled: state.status === 'saving', onClick: save },
          state.status === 'saving' ? t('saving') : t('save')),
        h('button', { key: 'r', type: 'button', style: BUTTON_STYLE, disabled: state.status === 'saving', onClick: reset }, t('reset')),
        h('span', { key: 'm', style: { ...HINT_STYLE, marginLeft: 4 } },
          state.error
            ? h('span', { style: { color: 'var(--dsw-alias-state-error-primary, #f85149)' } }, state.error)
            : (saved ? `${t('savedAt')} ${saved}` : '')),
      ])

      const body = [
        h('div', { key: 'head' }, [
          h('div', { key: 'h', style: { ...LABEL_STYLE, fontSize: 15, fontWeight: 600 } }, t('title')),
          h('div', { key: 'i', style: { ...HINT_STYLE, marginTop: 4 } }, t('intro')),
        ]),
        actions('actions-top'),

        card('appearance', t('sectionAppearance'), [
          row(t('field_logo'), select(['display', 'logo'], schema.display.logo.options, display.logo)),
          row(t('field_logoPosition'), select(['display', 'logoPosition'], schema.display.logoPosition.options, display.logoPosition)),
          row(t('field_icons'), select(['display', 'icons'], schema.display.icons.options, display.icons)),
          row(t('field_keyType'), select(['display', 'keyType'], schema.display.keyType.options, display.keyType)),
          h('div', { key: 'hint-keyType', style: { ...HINT_STYLE, paddingBottom: 4 } }, t('hint_keyType')),
          row(t('field_color'), select(['display', 'color'], schema.display.color.options, display.color)),
          h('div', { key: 'hint-color', style: { ...HINT_STYLE, paddingBottom: 4 } }, t('hint_color')),
          row(t('field_language'), select(['display', 'language'], schema.display.language.options, display.language)),
        ]),

        card('numbers', t('sectionNumbers'), [
          row(t('field_width'), number(['display', 'width'], schema.display.width, display.width)),
          row(t('field_keyWidth'), number(['display', 'keyWidth'], schema.display.keyWidth, display.keyWidth)),
          row(t('field_barWidth'), number(['display', 'barWidth'], schema.display.barWidth, display.barWidth)),
          row(t('field_logoPadding'), number(['display', 'logoPadding'], schema.display.logoPadding, display.logoPadding)),
        ]),

        card('modules', t('sectionModules'), [
          h('div', { key: 'g', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 4 } },
            modules.map((module) => {
              const label = module.labels?.[owner.lang] ?? module.labels?.en ?? module.id
              return h('label', {
                key: module.id,
                style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--dsw-alias-label-primary, #e6edf3)' },
              }, [
                h('input', {
                  key: 'c',
                  type: 'checkbox',
                  checked: enabled.has(module.id),
                  onChange: (event) => {
                    const next = new Set(enabled)
                    if (event.target.checked) next.add(module.id)
                    else next.delete(module.id)
                    update(['modules'], modules.filter((item) => next.has(item.id)).map((item) => item.id))
                  },
                }),
                h('span', { key: 's' }, label),
              ])
            })),
        ]),

        card('dsh', t('sectionDsh'), [
          h('div', { key: 'g', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 4 } },
            Object.keys(draft.dsh ?? {}).filter((key) => typeof draft.dsh[key] === 'boolean').map((key) =>
              h('label', {
                key,
                style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--dsw-alias-label-primary, #e6edf3)' },
              }, [
                h('input', {
                  key: 'c',
                  type: 'checkbox',
                  checked: draft.dsh[key] === true,
                  onChange: (event) => update(['dsh', key], event.target.checked),
                }),
                h('span', { key: 's' }, t(`field_${key}`) || key),
              ]))),
        ]),

        card('thresholds', t('sectionThresholds'), [
          row(`${t('field_memory')} ${t('field_warn')}`, number(['thresholds', 'memory', 'warn'], { min: 0, max: 100 }, getPath(draft, ['thresholds', 'memory', 'warn']))),
          row(`${t('field_memory')} ${t('field_crit')}`, number(['thresholds', 'memory', 'crit'], { min: 0, max: 100 }, getPath(draft, ['thresholds', 'memory', 'crit']))),
          row(`${t('field_disk')} ${t('field_warn')}`, number(['thresholds', 'disk', 'warn'], { min: 0, max: 100 }, getPath(draft, ['thresholds', 'disk', 'warn']))),
          row(`${t('field_disk')} ${t('field_crit')}`, number(['thresholds', 'disk', 'crit'], { min: 0, max: 100 }, getPath(draft, ['thresholds', 'disk', 'crit']))),
        ]),

      ]

      // 根节点只挂 className：设置页外壳会覆盖根节点的 inline style，
      // 内边距写进注入的 CSS 才生效（与其它本地设置页一致）。
      return h('div', { className: 'ff-settings' }, [
        h('style', { key: '__css', dangerouslySetInnerHTML: { __html: SETTINGS_CSS } }),
        ...body,
      ])
    }

    return {
      inject: ['slots', 'connection', 'locale'],
      apply(ctx) {
        const connection = ctx.get('connection')
        const locale = ctx.get('locale')
        const rpc = makeRemote(connection)

        ctx.effect(() => locale.register(NS, DICT), 'dsh-fastfetch: dictionaries')

        // 默认中文：只有明确拿到英文 locale 时才切英文，避免识别失败时整页变英文。
        const currentLang = () => {
          const id = String(locale?.getLocale?.()?.id ?? '').toLowerCase()
          return id.startsWith('en') ? 'en' : 'zh'
        }

        const t = (key) => {
          const dict = DICT[currentLang()] ?? DICT.en
          const value = dict[key]
          if (typeof value === 'string') return value
          const fallback = DICT.en[key]
          if (typeof fallback === 'string') return fallback
          // 没有译文时不要把小写 key 画到界面上：value_xxx 退回 xxx。
          return String(key).replace(/^value_/, '').replace(/^field_/, '')
        }

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'fastfetch',
          order: 50,
          label: () => 'FastFetch',
          locale: NS,
        }, (ownerProps = {}) => h(FastfetchSettings, {
          ...ownerProps,
          rpc,
          t,
          lang: currentLang(),
        })))

        // 卡片槽位按命令名匹配，/ff 与 /fastfetch 各注册一个
        for (const commandKey of ['fastfetch', 'ff']) {
          ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register({
            name: 'conversation.chat.commandview',
            key: commandKey,
            id: `dsh-fastfetch-command-card-${commandKey}`,
            order: 10,
          }, FastfetchCard))
        }
      },
    }
  },
})
