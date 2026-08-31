require('dotenv').config()

const config = {
  // WhatsApp number is entered from the terminal when needed.
  phoneNumber: '',

  // Directory where Baileys persists the multi-file auth state
  sessionPath: process.env.BANKAI_SESSION_PATH || './session',

  browser: ['Ubuntu', 'Chrome', '20.0.04'],
  markOnlineOnConnect: true,
  generateHighQualityLinkPreview: true,
  syncFullHistory: false,
  defaultQueryTimeoutMs: 60_000,
  connectTimeoutMs: 60_000,
  keepAliveIntervalMs: 10_000,

  reconnectDelayMs: 5_000,

  logLevel: process.env.BANKAI_LOG_LEVEL || 'info',
}

module.exports = config
