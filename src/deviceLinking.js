const { Boom } = require('@hapi/boom')
const { rmSync } = require('fs')
const NodeCache = require('node-cache')
const pino = require('pino')
const readline = require('readline')
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

const STATE = {
  IDLE: 'IDLE',
  LINKING: 'LINKING',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  READY: 'READY',
  DISCONNECTED: 'DISCONNECTED',
  RECONNECTING: 'RECONNECTING',
}

const groupMetadataCache = new NodeCache({
  stdTTL: 5 * 60,
  useClones: false,
})

function askPhoneNumber() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question('WhatsApp Number: ', (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function startDeviceLinking({
  onStateChange = () => {},
  onReady = () => {},
} = {}) {
  const setState = (s) => {
    logger.debug(`state -> ${s}`)
    onStateChange(s)
  }

  async function connect() {
    setState(STATE.CONNECTING)

    const { version } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionPath)
    const msgRetryCounterCache = new NodeCache()

    const needsLinking = !state.creds?.registered

    let phoneNumber = null

    // ============================================================
    // FIRST RUN ONLY:
    // Ask for the WhatsApp number directly from the terminal.
    // ============================================================
    if (needsLinking) {
      phoneNumber = await askPhoneNumber()
      phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

      const pn = require('awesome-phonenumber')

      if (!pn('+' + phoneNumber).isValid()) {
        logger.error(
          'Invalid phone number. Use the full international number without + or spaces.'
        )
        process.exit(1)
      }
    }

    const pairingCode = needsLinking

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: !pairingCode,
      browser: config.browser,

      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
          state.keys,
          pino({ level: 'fatal' }).child({ level: 'fatal' })
        ),
      },

      markOnlineOnConnect: config.markOnlineOnConnect,
      generateHighQualityLinkPreview:
        config.generateHighQualityLinkPreview,
      syncFullHistory: config.syncFullHistory,

      getMessage: async () => undefined,

      msgRetryCounterCache,

      cachedGroupMetadata: async (jid) =>
        groupMetadataCache.get(jid),

      defaultQueryTimeoutMs: config.defaultQueryTimeoutMs,
      connectTimeoutMs: config.connectTimeoutMs,
      keepAliveIntervalMs: config.keepAliveIntervalMs,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('groups.update', async (updates) => {
      for (const update of updates) {
        if (!update.id) continue

        try {
          groupMetadataCache.set(
            update.id,
            await sock.groupMetadata(update.id)
          )
        } catch (err) {
          logger.error(
            `Failed to refresh cached metadata for group ${update.id}.`,
            err
          )
        }
      }
    })

    sock.ev.on('group-participants.update', async (event) => {
      if (!event.id) return

      try {
        groupMetadataCache.set(
          event.id,
          await sock.groupMetadata(event.id)
        )
      } catch (err) {
        logger.error(
          `Failed to refresh cached metadata for group ${event.id}.`,
          err
        )
      }
    })

    // ============================================================
    // PAIRING CODE
    // ============================================================
    if (pairingCode) {
      setState(STATE.LINKING)

      setTimeout(async () => {
        try {
          let code = await sock.requestPairingCode(phoneNumber)

          code = code?.match(/.{1,4}/g)?.join('-') || code

          logger.info(`Pairing code: ${code}`)
          logger.info(
            'Enter this code in WhatsApp: Settings > Linked Devices > Link a Device'
          )
        } catch (error) {
          logger.error('Failed to request pairing code.', error)
        }
      }, 3000)
    }

    // ============================================================
    // CONNECTION LIFECYCLE
    // ============================================================
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        logger.info(
          'QR code generated. Scan with WhatsApp if not using pairing code.'
        )
      }

      if (connection === 'connecting') {
        logger.info('Connecting to WhatsApp...')
      }

      if (connection === 'open') {
        setState(STATE.CONNECTED)
        logger.info('Device connected.')

        try {
          const allGroups = await sock.groupFetchAllParticipating()

          for (const [jid, metadata] of Object.entries(allGroups)) {
            groupMetadataCache.set(jid, metadata)
          }

          logger.info(
            `Cached metadata for ${Object.keys(allGroups).length} group(s).`
          )
        } catch (err) {
          logger.error(
            'Failed to pre-cache group metadata (non-fatal — will fetch lazily instead).',
            err
          )
        }

        setState(STATE.READY)
        logger.info('Bankai is ready.')
        onReady(sock)
      }

      if (connection === 'close') {
        const statusCode =
          lastDisconnect?.error instanceof Boom
            ? lastDisconnect.error.output?.statusCode
            : lastDisconnect?.error?.output?.statusCode

        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut

        setState(STATE.DISCONNECTED)

        logger.warn(
          `Connection lost (status ${statusCode ?? 'unknown'}).`
        )

        if (
          statusCode === DisconnectReason.loggedOut ||
          statusCode === 401
        ) {
          try {
            rmSync(config.sessionPath, {
              recursive: true,
              force: true,
            })

            logger.warn(
              'Session invalidated (logged out). Removed local session; re-linking required.'
            )
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

module.exports = {
  startDeviceLinking,
  STATE,
}

