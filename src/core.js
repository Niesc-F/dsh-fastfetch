/** 命令与工具共用的唯一核心：collect → snapshot → render。 */

import os from 'node:os'
import { resolveOptions } from './config.js'
import { collectModules, resolveModuleList } from './modules/registry.js'
import { renderJson } from './render/json.js'
import { renderText } from './render/text.js'
import { resolveLanguage } from './i18n.js'

/**
 * @param {object} overrides 本次调用覆盖项
 * @param {object} env createContext() 的返回值
 * @returns {Promise<{text: string, data: object, errors: object[], options: object}>}
 */
export async function runFastfetch(overrides, env) {
  const options = resolveOptions(env.config, overrides)
  env.language = resolveLanguage(options.display.language, env.hostLocale)
  const ids = resolveModuleList(options.structure ?? options.modules, options.category, env.config.modules)
  const { modules, errors } = await collectModules(ids, env, options)
  const snapshot = {
    generatedAt: new Date().toISOString(),
    modules,
    errors,
    platform: {
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      node: process.version,
    },
  }
  const text = options.format === 'json' ? renderJson(snapshot) : renderText(snapshot, options, env.language)
  return { text, data: snapshot, errors, options }
}
