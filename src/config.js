/**
 * Swift — centralized configuration.
 *
 * Every setting Swift needs lives here and is read once at startup.
 * Nothing sensitive is hardcoded: the phone number and any secrets
 * come from environment variables or interactive input.
 */
require('dotenv').config()

const config = {
  // Directory where Baileys persists the multi-file auth state
  // (creds.json + key files). This IS the "session".
  sessionPath: './session',

  // Baileys socket behavior (kept identical to the Knight Bot reference
  // so device linking behaves the same way).
  browser: ['Ubuntu', 'Chrome', '20.0.04'],
  markOnlineOnConnect: true,
  generateHighQualityLinkPreview: true,
  syncFullHistory: false,
  defaultQueryTimeoutMs: 60_000,
  connectTimeoutMs: 60_000,
  keepAliveIntervalMs: 10_000,

  // Reconnect backoff after a dropped connection (ms)
  reconnectDelayMs: 5_000,

  logLevel: process.env.SWIFT_LOG_LEVEL || 'info',
}

module.exports = config
