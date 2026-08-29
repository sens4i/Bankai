const { Boom } = require('@hapi/boom')
const { rmSync } = require('fs')
const readline = require('readline')
const NodeCache = require('node-cache')
const pino = require('pino')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay,
} = require('@whiskeysockets/baileys')

const config = require('./config')
const logger = require('./logger')

// Connection lifecycle states, tracked alongside (not instead of) Baileys'
// own connection.update events. Purely additive bookkeeping.
const STATE = {
  IDLE: 'IDLE',
  LINKING: 'LINKING',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  READY: 'READY',
  DISCONNECTED: 'DISCONNECTED',
  RECONNECTING: 'RECONNECTING',
}

/**
 * Prompt for a phone number on the terminal, if one wasn't supplied via
 * config/env and we're in an interactive TTY. Falls back to config value
 * in non-interactive environments (e.g. running under a process manager).
 */
function makeQuestion() {
  const rl = process.stdin.isTTY
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null

  return (text) => {
    if (rl) {
      return new Promise((resolve) => rl.question(text, resolve))
    }
    return Promise.resolve(config.phoneNumber)
  }
}

/**
 * Starts (or restarts, on reconnect) the WhatsApp socket, wires up
 * device linking / pairing, session persistence, and the reconnect
 * loop. Returns the live socket instance.
 *
 * onStateChange(state) is called whenever Swift's lifecycle state changes.
 * onReady(sock) is called once the connection reaches READY (i.e. 'open').
 */
async function startDeviceLinking({ onStateChange = () => {}, onReady = () => {} } = {}) {
  const setState = (s) => {
    logger.debug(`state -> ${s}`)
    onStateChange(s)
  }

  async function connect() {
    setState(STATE.CONNECTING)

    const { version } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionPath)
    const msgRetryCounterCache = new NodeCache()

    // Matches Knight's original condition exactly: pairing-code mode is
    // chosen when a phone number is configured (or --pairing-code is
    // passed), regardless of registration state. If neither applies,
    // Swift falls back to QR, same as the reference.
    const pairingCode = !!config.phoneNumber || process.argv.includes('--pairing-code')

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: !pairingCode,
      browser: config.browser,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
      },
      markOnlineOnConnect: config.markOnlineOnConnect,
      generateHighQualityLinkPreview: config.generateHighQualityLinkPreview,
      syncFullHistory: config.syncFullHistory,
      // Swift has no message store; retry-decrypt lookups simply miss.
      getMessage: async () => undefined,
      msgRetryCounterCache,
      defaultQueryTimeoutMs: config.defaultQueryTimeoutMs,
      connectTimeoutMs: config.connectTimeoutMs,
      keepAliveIntervalMs: config.keepAliveIntervalMs,
    })

    // Session persistence: save credentials whenever Baileys updates them.
    sock.ev.on('creds.update', saveCreds)

    // --- Device Linking / Pairing Code ---------------------------------
    if (pairingCode && !sock.authState?.creds?.registered) {
      setState(STATE.LINKING)

      let phoneNumber = config.phoneNumber
      const question = makeQuestion()
      if (!phoneNumber) {
        phoneNumber = await question(
          'Please type your WhatsApp number \nFormat: 2010XXXXXX (without + or spaces) : '
        )
      }

      phoneNumber = String(phoneNumber).replace(/[^0-9]/g, '')

      const pn = require('awesome-phonenumber')
      if (!pn('+' + phoneNumber).isValid()) {
        logger.error('Invalid phone number. Provide the full international number without + or spaces.')
        process.exit(1)
      }

      setTimeout(async () => {
        try {
          let code = await sock.requestPairingCode(phoneNumber)
          code = code?.match(/.{1,4}/g)?.join('-') || code
          logger.info(`Pairing code: ${code}`)
          logger.info('Enter this code in WhatsApp: Settings > Linked Devices > Link a Device')
        } catch (error) {
          logger.error('Failed to request pairing code.', error)
        }
      }, 3000)
    }

    // --- Connection lifecycle ------------------------------------------
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        logger.info('QR code generated. Scan with WhatsApp if not using pairing code.')
      }

      if (connection === 'connecting') {
        logger.info('Connecting to WhatsApp...')
      }

      if (connection === 'open') {
        setState(STATE.CONNECTED)
        logger.info('Device connected.')
        setState(STATE.READY)
        logger.info('Swift is ready.')
        onReady(sock)
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : lastDisconnect?.error?.output?.statusCode

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        setState(STATE.DISCONNECTED)
        logger.warn(`Connection lost (status ${statusCode ?? 'unknown'}).`)

        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          try {
            rmSync(config.sessionPath, { recursive: true, force: true })
            logger.warn('Session invalidated (logged out). Removed local session; re-linking required.')
          } catch (error) {
            logger.error('Error deleting session.', error)
          }
        }

        if (shouldReconnect) {
          setState(STATE.RECONNECTING)
          logger.info('Reconnecting...')
          await delay(config.reconnectDelayMs)
          connect()
        }
      }
    })

    return sock
  }

  return connect()
}

module.exports = { startDeviceLinking, STATE }
