#!/usr/bin/env node
/**
 * Capacitor CLI writes IPC logs under a user-owned path (macOS: ~/Library/Logs/capacitor).
 * If you ever ran `sudo npx cap sync`, that directory or ipc.log may be root-owned and
 * normal `npm run build:mobile` fails with EACCES. This script fails fast with a fix command.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const envPaths = require('env-paths')

const logDir = envPaths('capacitor', { suffix: '' }).log
const logFile = path.join(logDir, 'ipc.log')

function failWithHint() {
  console.error(`\nCapacitor cannot write logs under:\n  ${logDir}\n`)
  if (process.platform === 'win32') {
    console.error(
      'Delete that folder (or fix permissions) if it was created while running as Administrator, then retry.\n',
    )
  } else {
    console.error('Usually fixed once after a mistaken `sudo` cap/npm run:\n')
    console.error(`  sudo chown -R "$(whoami)" "${logDir}"\n`)
  }
  process.exit(1)
}

try {
  fs.mkdirSync(logDir, { recursive: true })
  fs.accessSync(logDir, fs.constants.W_OK)
  try {
    fs.appendFileSync(logFile, '')
  } catch (e) {
    if (e && (e.code === 'EACCES' || e.code === 'EPERM')) {
      try {
        fs.unlinkSync(logFile)
        fs.appendFileSync(logFile, '')
      } catch {
        failWithHint()
      }
    } else {
      throw e
    }
  }
} catch (e) {
  if (e && (e.code === 'EACCES' || e.code === 'EPERM')) failWithHint()
  throw e
}
