/**
 * Swift — Message Sender (Swift Core, built from scratch)
 *
 * Sends WhatsApp messages via an active, READY socket. Refuses to send
 * before the connection is ready, and reports failures clearly instead
 * of swallowing them.
 */
const logger = require('./logger')
const { STATE } = require('./deviceLinking')

class SendError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'SendError'
    this.code = code
  }
}

class MessageSender {
  /**
   * @param {() => import('@whiskeysockets/baileys').WASocket | null} getSock
   * @param {() => string} getState
   */
  constructor(getSock, getState) {
    this.getSock = getSock
    this.getState = getState
  }

  /**
   * Send a text message.
   * @param {string} jid recipient JID, e.g. '15551234567@s.whatsapp.net'
   * @param {string} text message body
   */
  async sendText(jid, text) {
    if (!jid || typeof jid !== 'string') {
      throw new SendError('Invalid recipient: jid must be a non-empty string.', 'INVALID_RECIPIENT')
    }
    if (!text || typeof text !== 'string') {
      throw new SendError('Invalid message: text must be a non-empty string.', 'INVALID_MESSAGE')
    }
    if (this.getState() !== STATE.READY) {
      throw new SendError(
        `Connection not available (state: ${this.getState()}). Cannot send until Swift is READY.`,
        'CONNECTION_UNAVAILABLE'
      )
    }

    const sock = this.getSock()
    if (!sock) {
      throw new SendError('Connection not available: no active socket.', 'CONNECTION_UNAVAILABLE')
    }

    try {
      const result = await sock.sendMessage(jid, { text })
      logger.info(`Message sent to ${jid}`)
      return result
    } catch (error) {
      // Distinguish a disconnect mid-send from any other send failure.
      if (this.getState() !== STATE.READY) {
        throw new SendError('Connection dropped while sending.', 'DISCONNECTED_DURING_SEND')
      }
      logger.error(`Failed to send message to ${jid}.`, error)
      throw new SendError(`Send failed: ${error.message}`, 'SEND_FAILED')
    }
  }
}

module.exports = { MessageSender, SendError }
