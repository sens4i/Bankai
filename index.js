/**
 * Bankai — WhatsApp broadcast automation.
 *
 * Uses the Device Linking implementation from the Knight Bot reference
 * (src/deviceLinking.js, LOCKED) as its auth/connection foundation.
 * Everything else is built from scratch under the name Bankai.
 *
 * Auto-restart: `npm run dev` runs this under nodemon, which watches
 * only index.js and src/ (see nodemon.json) — not Bankai.txt or
 * settings.json, which the bot writes to itself at runtime. Restarting
 * on every content/settings save would be unstable (it could interrupt
 * an in-progress publish); restarting only on real code edits is the
 * safe, intended behavior. The saved WhatsApp session survives a
 * restart, so reconnecting after one doesn't require re-pairing.
 */
const logger = require('./src/logger')
const { startDeviceLinking, STATE } = require('./src/deviceLinking')
const { MessageSender } = require('./src/sender')
const { attachBankai } = require('./src/bankai')

let currentSock = null
let currentState = STATE.IDLE
let shuttingDown = false

async function main() {
  logger.info('Bankai starting...')
  logger.info('Loading configuration...')
  logger.info('Loading authentication state...')

  const sender = new MessageSender(() => currentSock, () => currentState)

  await startDeviceLinking({
    onStateChange: (state) => {
      currentState = state
      if (state === STATE.RECONNECTING) logger.warn('Connection lost.')
    },
    onReady: (sock) => {
      currentSock = sock
      attachBankai(sock)
    },
  })

  return sender
}

// Closes the socket cleanly without touching the saved session. Shared by
// every shutdown path (Ctrl+C, process manager stop, nodemon restart) so
// there's exactly one place that decides how to disconnect.
function closeSocket() {
  if (!currentSock?.ws?.close) return
  try {
    currentSock.ws.close()
  } catch (err) {
    logger.error('Error closing socket during shutdown.', err)
  }
}

// Manual stop: Ctrl+C or a process manager sending SIGINT/SIGTERM.
// Exits the process for good.
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info(`Received ${signal}, shutting down gracefully...`)
  closeSocket()
  process.exit(0)
}

// nodemon restart: nodemon sends SIGUSR2 before restarting the process
// after a watched file changes. The correct pattern is to clean up and
// then re-signal ourselves with SIGUSR2 so nodemon's own handler (which
// only exists once we re-raise it) can proceed with the restart — just
// calling process.exit() here would skip nodemon's restart bookkeeping.
function restartForNodemon() {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('Source file changed — restarting (session preserved)...')
  closeSocket()
  process.kill(process.pid, 'SIGUSR2')
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGUSR2', restartForNodemon)

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception.', err)
})
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection.', err)
})

main().catch((error) => {
  logger.error('Fatal error during startup.', error)
  process.exit(1)
})

module.exports = { main }
