/**
 * Bankai — persisted runtime settings (currently: delay between messages).
 * Stored in settings.json at the project root, separate from src/config.js
 * (which holds the locked connection settings and is not runtime-editable).
 */
const fs = require('fs')
const path = require('path')
const logger = require('./logger')

const SETTINGS_FILE = path.join(__dirname, '..', 'settings.json')

// 1 minute floor — deliberately chosen so the tool is structurally
// incapable of rapid-fire sending, regardless of what anyone sets.
// 10 minutes ceiling — a real cap, nowhere near "leave it for an hour".
const MIN_DELAY_SECONDS = 0.1
const MAX_DELAY_SECONDS = 600

const DEFAULTS = {
  delaySeconds: MIN_DELAY_SECONDS,
  enabled: true, // gates the .... execution trigger; toggled via ".."
}

// Parses and clamps a delay value (supports decimals above the floor,
// e.g. "90.5"). Returns null for anything unparseable or out of range —
// callers should treat null as "reject, ask again", not "silently clamp".
function clampDelay(n) {
  const num = typeof n === 'string' ? parseFloat(n.trim().replace(',', '.')) : Number(n)
  if (!Number.isFinite(num)) return null
  if (num < MIN_DELAY_SECONDS || num > MAX_DELAY_SECONDS) return null
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

/**
 * Returns a guaranteed-valid delay to actually use for sending. Guards
 * against a stale settings.json holding a value from before the floor
 * was raised (e.g. an old 0.01s setting saved under a previous version)
 * — falling back to the floor instead of silently sending near-instantly,
 * and self-healing the file so this doesn't happen again next time.
 */
function getEffectiveDelaySeconds() {
  const { delaySeconds } = loadSettings()
  const valid = clampDelay(delaySeconds)
  if (valid !== null) return valid

  logger.error(
    `Stored delaySeconds (${delaySeconds}) is invalid or below the current minimum (${MIN_DELAY_SECONDS}s). Falling back to ${MIN_DELAY_SECONDS}s and correcting settings.json.`
  )
  saveSettings({ delaySeconds: MIN_DELAY_SECONDS })
  return MIN_DELAY_SECONDS
}

module.exports = {
  loadSettings,
  saveSettings,
  clampDelay,
  getEffectiveDelaySeconds,
  MIN_DELAY_SECONDS,
  MAX_DELAY_SECONDS,
}
