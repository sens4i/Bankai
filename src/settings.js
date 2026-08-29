/**
 * Bankai — persisted runtime settings (currently: delay between messages).
 * Stored in settings.json at the project root, separate from src/config.js
 * (which holds the locked connection settings and is not runtime-editable).
 */
const fs = require('fs')
const path = require('path')
const logger = require('./logger')

const SETTINGS_FILE = path.join(__dirname, '..', 'settings.json')

const DEFAULTS = {
  delaySeconds: 3,
}

const MIN_DELAY_SECONDS = 0.01 // 10 milliseconds
const MAX_DELAY_SECONDS = 300 // 5 minutes — deliberately far below an hour

// Parses and clamps a delay value. Supports decimals (e.g. "0.1", "0.01")
// down to MIN_DELAY_SECONDS. Returns null for anything unparseable or out
// of range — callers should treat null as "reject, ask again" rather than
// silently clamping, so a mistyped huge number doesn't get quietly
// rewritten to the max.
function clampDelay(n) {
  const num = typeof n === 'string' ? parseFloat(n.trim().replace(',', '.')) : Number(n)
  if (!Number.isFinite(num)) return null
  if (num < MIN_DELAY_SECONDS || num > MAX_DELAY_SECONDS) return null
  // Round to 2 decimal places to avoid float noise (0.1 + 0.2 style issues)
  // while still allowing values as small as 0.01.
  return Math.round(num * 100) / 100
}

function loadSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULTS, null, 2), 'utf8')
    return { ...DEFAULTS }
  }
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch (err) {
    logger.error('Failed to read settings.json — falling back to defaults.', err)
    return { ...DEFAULTS }
  }
}

function saveSettings(partial) {
  const current = loadSettings()
  const updated = { ...current, ...partial }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8')
  return updated
}

module.exports = { loadSettings, saveSettings, clampDelay, MIN_DELAY_SECONDS, MAX_DELAY_SECONDS }
