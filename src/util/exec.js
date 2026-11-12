/** 固定参数子进程探测：无 shell、超时、失败降级。 */

import { execFile } from 'node:child_process'

/**
 * @param {string} file
 * @param {string[]} args
 * @param {{timeoutMs?: number, cwd?: string}} [options]
 * @returns {Promise<{ok: boolean, stdout: string, error?: string}>}
 */
export function runFile(file, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 800
  return new Promise((resolve) => {
    try {
      execFile(
        file,
        args,
        {
          cwd: options.cwd,
          timeout: timeoutMs,
          windowsHide: true,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024,
        },
        (error, stdout) => {
          if (error) {
            resolve({ ok: false, stdout: '', error: String(error.message || error) })
            return
          }
          resolve({ ok: true, stdout: String(stdout ?? '').trim() })
        },
      )
    } catch (error) {
      resolve({ ok: false, stdout: '', error: String(error?.message || error) })
    }
  })
}
