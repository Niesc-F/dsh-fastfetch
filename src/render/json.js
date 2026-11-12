/** JSON 输出：稳定、无 ANSI、无 logo。 */

import { PLUGIN_VERSION } from '../config.js'

export function renderJson(snapshot) {
  const system = {}
  const dsh = {}
  for (const module of snapshot.modules) {
    const entry = { value: module.value }
    if (module.detailValue !== undefined) entry.detail = module.detailValue
    if (Number.isFinite(module.percent)) entry.percent = Math.round(module.percent * 10) / 10
    if (Array.isArray(module.rows)) {
      entry.rows = module.rows.map((row) => {
        const item = { label: row.label, value: row.value }
        if (row.detailValue !== undefined) item.detail = row.detailValue
        if (Number.isFinite(row.percent)) item.percent = Math.round(row.percent * 10) / 10
        return item
      })
    }
    if (module.category === 'system') system[module.id] = entry
    else dsh[module.id] = entry
  }
  return JSON.stringify(
    {
      schemaVersion: 1,
      pluginVersion: PLUGIN_VERSION,
      generatedAt: snapshot.generatedAt,
      platform: snapshot.platform,
      system,
      dsh,
      errors: snapshot.errors,
    },
    null,
    2,
  )
}
