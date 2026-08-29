/**
 * Swift — Publishing System (Swift + Bankai)
 *
 * Two independent, file-backed broadcast channels layered on top of the
 * existing (locked) WhatsApp connection. Nothing here touches auth,
 * session, or the socket lifecycle — it only listens to messages.upsert
 * on the socket it's given and calls sock.sendMessage().
 *
 *   .swift   -> view/update SwiftKey.txt   (self-chat only)
 *   ..        -> publish SwiftKey.txt, one message per non-empty line
 *
 *   .bankai  -> view/update bankai.txt     (self-chat only)
 *   ....      -> publish bankai.txt, one message per non-empty line
 *
 *   .menu    -> beginner-friendly numbered menu (self-chat only). Reply
 *               with just a digit to run that option — no commands to
 *               remember. (Native WhatsApp "tap" buttons were skipped on
 *               purpose: WhatsApp deprecated that API for personal
 *               accounts, so buttons frequently fail to render. A
 *               numbered reply works on every client.)
 *
 * If the target file is empty when a trigger fires, Swift sends a
 * heads-up to the bot's own self-chat instead of silently doing nothing,
 * so the owner notices and can configure it.
 *
 * Execution triggers (.. / ....) are restricted to the bot's own account
 * (fromMe), same as the config commands. That's a deliberate default —
 * an unauthenticated group member typing ".." should not be able to
 * blast the configured content into a group. If you want any group
 * member to be able to trigger publishing, relax the `fromMe` check in
 * handleExecutionTrigger() below.
 */
const fs = require('fs')
const path = require('path')
const logger = require('./logger')

const SWIFT_FILE = path.join(__dirname, '..', 'SwiftKey.txt')
const BANKAI_FILE = path.join(__dirname, '..', 'bankai.txt')

const SWIFT_CONFIG_PREFIX = '.swift'
const BANKAI_CONFIG_PREFIX = '.bankai'
const SWIFT_TRIGGER = '..'
const BANKAI_TRIGGER = '....'
const MENU_COMMAND = '.menu'

const MENU_TEXT = [
  'Swift Menu — reply with a number:',
  '',
  '1. View Swift content',
  '2. Publish Swift now (same as typing "..")',
  '3. How to edit Swift',
  '',
  '4. View Bankai content',
  '5. Publish Bankai now (same as typing "....")',
  '6. How to edit Bankai',
  '',
  '0. Cancel',
].join('\n')

// --- File helpers ----------------------------------------------------------

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8')
    logger.info(`Created missing file: ${path.basename(filePath)}`)
  }
}

function readRaw(filePath) {
  ensureFile(filePath)
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    logger.error(`Failed to read ${path.basename(filePath)}.`, err)
    return ''
  }
}

function readLines(filePath) {
  const raw = readRaw(filePath)
  return raw
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function writeRaw(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8')
    return true
  } catch (err) {
    logger.error(`Failed to write ${path.basename(filePath)}.`, err)
    return false
  }
}

// --- Message helpers ---------------------------------------------------

function unwrapMessage(message) {
  if (!message) return message
  if (message.ephemeralMessage) return message.ephemeralMessage.message
  return message
}

function getText(message) {
  const m = unwrapMessage(message)
  if (!m) return ''
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  )
}

function jidsMatch(a, b) {
  if (!a || !b) return false
  return a.split(':')[0].split('@')[0] === b.split(':')[0].split('@')[0]
}

// Resolves the bot's own self-chat JID from its session identity
// (e.g. "15551234567:12@s.whatsapp.net" -> "15551234567@s.whatsapp.net").
function getSelfChatJid(botJid) {
  if (!botJid) return null
  const number = botJid.split(':')[0].split('@')[0]
  return `${number}@s.whatsapp.net`
}

// --- Config commands (self-chat only) ---------------------------------

async function handleConfigCommand({ sock, jid, text, prefix, filePath, label }) {
  if (text === prefix) {
    const current = readRaw(filePath)
    const body = current.trim().length > 0 ? current : `(${label} is empty)`
    await sock.sendMessage(jid, { text: `${label} current content:\n\n${body}` })
    return true
  }

  const withSpace = prefix + ' '
  const withNewline = prefix + '\n'
  if (text.startsWith(withSpace) || text.startsWith(withNewline)) {
    const newContent = text.slice(prefix.length).replace(/^\s+/, '')
    const ok = writeRaw(filePath, newContent)
    await sock.sendMessage(jid, {
      text: ok ? `${label} updated.` : `${label} update failed — see logs.`,
    })
    return true
  }

  return false
}

// --- Execution triggers -------------------------------------------------

async function publishLines(sock, jid, filePath, label, configPrefix) {
  const lines = readLines(filePath)
  if (lines.length === 0) {
    logger.info(`${label} publish requested but file is empty — notifying self-chat.`)
    const selfChat = getSelfChatJid(sock.user?.id)
    if (selfChat) {
      try {
        await sock.sendMessage(selfChat, {
          text: `${label} is empty — nothing to publish. Set it up with "${configPrefix} <content>" first.`,
        })
      } catch (err) {
        logger.error(`Failed to notify self-chat about empty ${label}.`, err)
      }
    }
    return
  }

  logger.info(`Publishing ${lines.length} line(s) from ${label} to ${jid}.`)
  for (const line of lines) {
    try {
      await sock.sendMessage(jid, { text: line })
    } catch (err) {
      logger.error(`Failed to send a ${label} line; continuing with the rest.`, err)
    }
  }
}

async function handleExecutionTrigger({ sock, jid, text, fromMe }) {
  // Deliberate default: only the bot's own account can trigger a publish.
  // See file header if you want to open this up to any sender.
  if (!fromMe) return false

  if (text === BANKAI_TRIGGER) {
    await publishLines(sock, jid, BANKAI_FILE, 'bankai.txt', BANKAI_CONFIG_PREFIX)
    return true
  }
  if (text === SWIFT_TRIGGER) {
    await publishLines(sock, jid, SWIFT_FILE, 'SwiftKey.txt', SWIFT_CONFIG_PREFIX)
    return true
  }
  return false
}

// --- Beginner menu (numbered, self-chat only) ---------------------------
//
// .menu shows a numbered list. The owner replies with a bare digit
// (e.g. "2") and Swift runs that option. `menuActive` tracks whether
// the last thing Swift showed in self-chat was the menu, so a random
// "2" typed at some other time isn't misread as a menu selection.

async function showMenu(sock, jid) {
  await sock.sendMessage(jid, { text: MENU_TEXT })
}

async function runMenuOption({ sock, jid, option }) {
  switch (option) {
    case '1': {
      const current = readRaw(SWIFT_FILE)
      const body = current.trim().length > 0 ? current : '(SwiftKey.txt is empty)'
      await sock.sendMessage(jid, { text: `SwiftKey.txt current content:\n\n${body}` })
      return true
    }
    case '2':
      await publishLines(sock, jid, SWIFT_FILE, 'SwiftKey.txt', SWIFT_CONFIG_PREFIX)
      return true
    case '3':
      await sock.sendMessage(jid, {
        text: `To edit Swift, send:\n${SWIFT_CONFIG_PREFIX} <your content>\n\nEach line becomes a separate published message. Example:\n${SWIFT_CONFIG_PREFIX} Hello students\nToday's lesson starts at 8 PM`,
      })
      return true
    case '4': {
      const current = readRaw(BANKAI_FILE)
      const body = current.trim().length > 0 ? current : '(bankai.txt is empty)'
      await sock.sendMessage(jid, { text: `bankai.txt current content:\n\n${body}` })
      return true
    }
    case '5':
      await publishLines(sock, jid, BANKAI_FILE, 'bankai.txt', BANKAI_CONFIG_PREFIX)
      return true
    case '6':
      await sock.sendMessage(jid, {
        text: `To edit Bankai, send:\n${BANKAI_CONFIG_PREFIX} <your content>\n\nEach line becomes a separate published message.`,
      })
      return true
    case '0':
      await sock.sendMessage(jid, { text: 'Cancelled.' })
      return true
    default:
      return false
  }
}

// --- Wiring --------------------------------------------------------------

/**
 * Attaches the Swift/Bankai publishing layer to an already-connected
 * socket. Safe to call once per active connection (e.g. from onReady).
 * Does not create a second listener system — it's one messages.upsert
 * handler covering both config commands and both execution triggers.
 */
function attachPublishing(sock) {
  ensureFile(SWIFT_FILE)
  ensureFile(BANKAI_FILE)

  let busy = false // reentrancy guard: a publish run sends messages back
  // into the same chat; don't let those sends be re-parsed as commands.
  let menuActive = false // true right after .menu was shown, until a
  // digit reply (or any other command) consumes/cancels it.

  sock.ev.on('messages.upsert', async (update) => {
    if (busy) return
    try {
      const msg = update.messages?.[0]
      if (!msg?.message) return

      const jid = msg.key.remoteJid
      const fromMe = !!msg.key.fromMe
      const botJid = sock.user?.id
      const isSelfChat = fromMe && jidsMatch(jid, botJid)
      const text = getText(msg.message).trim()
      if (!text) return

      if (isSelfChat) {
        if (text === MENU_COMMAND) {
          await showMenu(sock, jid)
          menuActive = true
          return
        }

        if (menuActive && /^[0-6]$/.test(text)) {
          menuActive = false
          const handled = await runMenuOption({ sock, jid, option: text })
          if (handled) return
        }

        const handledSwift = await handleConfigCommand({
          sock,
          jid,
          text,
          prefix: SWIFT_CONFIG_PREFIX,
          filePath: SWIFT_FILE,
          label: 'SwiftKey.txt',
        })
        if (handledSwift) {
          menuActive = false
          return
        }

        const handledBankai = await handleConfigCommand({
          sock,
          jid,
          text,
          prefix: BANKAI_CONFIG_PREFIX,
          filePath: BANKAI_FILE,
          label: 'bankai.txt',
        })
        if (handledBankai) {
          menuActive = false
          return
        }
      }

      busy = true
      try {
        const executed = await handleExecutionTrigger({ sock, jid, text, fromMe })
        if (executed) menuActive = false
      } finally {
        busy = false
      }
    } catch (err) {
      logger.error('Error in Swift publishing handler.', err)
      busy = false
    }
  })

  logger.info('Swift publishing layer attached (Swift + Bankai + menu).')
}

module.exports = { attachPublishing, SWIFT_FILE, BANKAI_FILE, MENU_COMMAND }
