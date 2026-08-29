// Bankai Automation System By MaRO EL BaSHa
const fs = require('fs')
const path = require('path')
const logger = require('./logger')
const { loadSettings, saveSettings, clampDelay, MIN_DELAY_SECONDS, MAX_DELAY_SECONDS } = require('./settings')

const BANKAI_FILE = path.join(__dirname, '..', 'Bankai.txt')
const CONFIG_COMMANDS = ['.b','.bankai']
const CONFIG_COMMAND = CONFIG_COMMANDS[0]
const EXECUTION_TRIGGER = '....'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// --- Files ---------------------------------------

function ensureFile() {
  if (!fs.existsSync(BANKAI_FILE)) {
    fs.writeFileSync(BANKAI_FILE, '', 'utf8')
    logger.info('Created missing file: Bankai.txt')
  }
}

function readRaw() {
  ensureFile()
  try {
    return fs.readFileSync(BANKAI_FILE, 'utf8')
  } catch (err) {
    logger.error('Failed to read Bankai.txt.', err)
    return ''
  }
}

function readLines() {
  return readRaw()
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function writeRaw(content) {
  try {
    fs.writeFileSync(BANKAI_FILE, content, 'utf8')
    return true
  } catch (err) {
    logger.error('Failed to write Bankai.txt.', err)
    return false
  }
}

function isEmpty() {
  return readLines().length === 0
}

// Bankai System Configration

const TEXT = {
  ready: '*⤹ 𝖡𝖺𝗇𝗄𝖺𝗂 𝖲𝗒𝗌𝗍𝖾𝗆 𝗂𝗌 𝖱𝖾𝖺𝖽𝗒*\n\n> 𝖬𝖺𝖱𝖮 𝖤𝖫 𝖡𝖺𝖲𝖧𝖺',
  needsSetup:
    '*⤹ 𝖧𝖾𝗒 !*\n⤹ 𝖡𝖺𝗇𝗄𝖺𝗂 𝖢𝗈𝗇𝖿𝗂𝗀 𝖲𝖾𝗍𝗍𝗂𝗇𝗀𝗌\n\n*⤹ 𝖧𝗈𝗐 𝗍𝗈 𝗎𝗌𝖾*\n𝖲𝖾𝗇𝖽 𝖤𝗏𝖾𝗋𝗒 𝗆𝖾𝗌𝗌𝖺𝗀𝖾 𝗂𝗇 𝖮𝗇𝖾 𝖫𝗂𝗇𝖾.\n𝖲𝖾𝗇𝖽 𝗍𝗁𝖾 𝗍𝖾𝗑𝗍 𝗂𝗇 𝗋𝖾𝗉𝗅𝗒 𝗍𝗈 𝗍𝗁𝗂𝗌 𝗆𝖾𝗌𝗌𝖺𝗀𝖾.\n𝖲𝖾𝗇𝖽 *𝟢* 𝗍𝗈 𝖼𝖺𝗇𝖼𝖾𝗅.\n\n> 𝖬𝖺𝖱𝖮 𝖤𝖫 𝖡𝖺𝖲𝖧𝖺',
  menu: (delaySeconds) =>
    [
      '𝖧𝖾𝗒, 𝗍𝗁𝗂𝗌 𝗂𝗌 𝖺 𝖻𝖺𝗇𝗄𝖺𝗂 𝗌𝖾𝗍𝗎𝗉 𝗆𝖾𝗌𝗌𝖺𝗀𝖾!',
      '',
      `𝟣 - 𝖳𝗁𝖾 𝗍𝗂𝗆𝖾 𝖻𝖾𝗍𝗐𝖾𝖾𝗇 𝖾𝖺𝖼𝗁 𝗆𝖾𝗌𝗌𝖺𝗀𝖾 [𝖼𝗎𝗋𝗋𝖾𝗇𝗍: ${delaySeconds} 𝗌𝖾𝖼𝗈𝗇𝖽𝗌]`,
      '𝟤 - 𝖤𝖽𝗂𝗍 𝖡𝖺𝗇𝗄𝖺𝗂 𝖢𝗈𝗇𝗍𝖾𝗇𝗍',
      '',
      '- 𝖱𝖾𝗉𝗅𝗒 𝗍𝗈 𝗍𝗁𝗂𝗌 𝗆𝖾𝗌𝗌𝖺𝗀𝖾 𝗐𝗂𝗍𝗁 𝗍𝗁𝖾 𝖲𝖾𝖼𝗍𝗂𝗈𝗇 𝗇𝗎𝗆𝖻𝖾𝗋, 𝖮𝗋 𝗌𝖾𝗇𝖽 *𝟢* 𝗍𝗈 𝖼𝖺𝗇𝖼𝖾𝗅.\n\n> 𝖬𝖺𝖱𝖮 𝖤𝖫 𝖡𝖺𝖲𝖧𝖺',
    ].join('\n'),
  askDelay: `𝖲𝖾𝗇𝖽 𝗍𝗁𝖾 𝗍𝗂𝗆𝖾 𝖻𝖾𝗍𝗐𝖾𝖾𝗇 𝗆𝖾𝗌𝗌𝖺𝗀𝖾𝗌 𝗂𝗇 𝗌𝖾𝖼𝗈𝗇𝖽𝗌 (${MIN_DELAY_SECONDS} 𝗍𝗈 ${MAX_DELAY_SECONDS}), 𝗈𝗋 0 𝗍𝗈 𝖼𝖺𝗇𝖼𝖾𝗅:\n\n> 𝖬𝖺𝖱𝖮 𝖤𝖫 𝖡𝖺𝖲𝖧𝖺`,
  delayInvalid: `𝖨𝗇𝗏𝖺𝗅𝗂𝖽 𝗏𝖺𝗅𝗎𝖾. 𝖲𝖾𝗇𝖽 𝖺 𝗐𝗁𝗈𝗅𝖾 𝗇𝗎𝗆𝖻𝖾𝗋 𝖻𝖾𝗍𝗐𝖾𝖾𝗇 ${MIN_DELAY_SECONDS} 𝖺𝗇𝖽 ${MAX_DELAY_SECONDS} 𝗌𝖾𝖼𝗈𝗇𝖽𝗌, 𝗈𝗋 0 𝗍𝗈 𝖼𝖺𝗇𝖼𝖾𝗅.\n\n> 𝖬𝖺𝖱𝖮 𝖤𝖫 𝖡𝖺𝖲𝖧𝖺`,
  delaySaved: (n) => `𝖳𝗁𝖾 𝗍𝗂𝗆𝖾 𝖻𝖾𝗍𝗐𝖾𝖾𝗇 𝗆𝖾𝗌𝗌𝖺𝗀𝖾𝗌 𝗁𝖺𝗌 𝖻𝖾𝖾𝗇 𝗌𝖾𝗍 𝗍𝗈: ${n} 𝗌𝖾𝖼𝗈𝗇𝖽𝗌 ✅\n\n> 𝖬𝖺𝖱𝖮 𝖤𝖫 𝖡𝖺𝖲𝖧𝖺`,
  contentEmpty: '𝖳𝗁𝖾 𝖼𝗈𝗇𝗍𝖾𝗇𝗍 𝗒𝗈𝗎 𝗌𝖾𝗇𝗍 𝗂𝗌 𝖾𝗆𝗉𝗍𝗒. 𝖳𝗋𝗒 𝖺𝗀𝖺𝗂𝗇, 𝗈𝗋 𝗌𝖾𝗇𝖽 0 𝗍𝗈 𝖼𝖺𝗇𝖼𝖾𝗅.\n\n> 𝖬𝖺𝖱𝖮 𝖤𝖫 𝖡𝖺𝖲𝖧𝖺',
  contentSaved: (count) => `𝖡𝖺𝗇𝗄𝖺𝗂 𝖼𝗈𝗇𝗍𝖾𝗇𝗍 𝗌𝖺𝗏𝖾𝖽 𝗌𝗎𝖼𝖼𝖾𝗌𝗌𝖿𝗎𝗅𝗅𝗒 ✅ (𝖭𝗎𝗆𝖻𝖾𝗋 𝗈𝖿 𝗆𝖾𝗌𝗌𝖺𝗀𝖾𝗌: ${count})\n\n> 𝖬𝖺𝖱𝖮 𝖤𝖫 𝖡𝖺𝖲𝖧𝖺`,
  cancelled: '𝖢𝖺𝗇𝖼𝖾𝗅𝗅𝖾𝖽.',
  invalidChoice: '𝖨𝗇𝗏𝖺𝗅𝗂𝖽 𝖼𝗁𝗈𝗂𝖼𝖾. 𝖯𝗅𝖾𝖺𝗌𝖾 𝗌𝖾𝗇𝖽 𝖺 𝗇𝗎𝗆𝖻𝖾𝗋 𝖿𝗋𝗈𝗆 𝗍𝗁𝖾 𝗆𝖾𝗇𝗎, 𝗈𝗋 0 𝗍𝗈 𝖼𝖺𝗇𝖼𝖾𝗅.\n\n> 𝖬𝖺𝖱𝖮 𝖤𝖫 𝖡𝖺𝖲𝖧𝖺',
}

// --- التعامل مع الرسائل --------------------------------------------------

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

// نفس منطق كشف "محادثة النفس" المُقوّى: يتحقق من كل الهويات التي يعرضها
// Baileys لحساب البوت نفسه (رقم الهاتف و/أو LID)، وليس شكلاً واحدًا فقط.
function isSelfChatMessage(sock, jid) {
  if (!jid) return false
  const candidates = [sock.user?.id, sock.user?.lid].filter(Boolean)
  return candidates.some((candidate) => jidsMatch(jid, candidate))
}

function getSelfChatJid(sock) {
  const botJid = sock.user?.id
  if (!botJid) return null
  const number = botJid.split(':')[0].split('@')[0]
  return `${number}@s.whatsapp.net`
}

// --- النشر (تنفيذ) ---------------------------------------------------------

async function publishLines(send, jid) {
  const lines = readLines()
  if (lines.length === 0) {
    logger.info('Publish requested but Bankai.txt is empty — notifying self-chat.')
    return { published: false, count: 0 }
  }

  const { delaySeconds } = loadSettings()
  const delayMs = clampDelay(delaySeconds) * 1000

  logger.info(`Publishing ${lines.length} message(s) from Bankai.txt to ${jid}.`)
  for (let i = 0; i < lines.length; i++) {
    try {
      await send(jid, lines[i])
    } catch (err) {
      logger.error('Failed to send a Bankai message; continuing with the rest.', err)
    }
    if (i < lines.length - 1) await sleep(delayMs)
  }
  return { published: true, count: lines.length }
}

// --- التركيب على الاتصال الحالي --------------------------------------------

/**
 * يربط نظام بانكاي بالاتصال الحالي (المُقفل). لا ينشئ اتصالاً أو
 * مستمعًا مضاعفًا — مستمع واحد فقط على messages.upsert.
 */
function attachBankai(sock) {
  ensureFile()

  const ownSentIds = new Set() // لمنع تفسير رسائل بانكاي نفسها كأوامر جديدة
  let processing = false // قفل تسلسلي: يمنع تداخل معالجة رسالتين في نفس الوقت
  let pendingAction = null // null | 'menu' | 'awaiting_content' | 'awaiting_delay'

  // كل رسائل بانكاي (تأكيدات، قوائم، تنبيهات) تمر من هنا حتى يتم تتبعها
  // ومنع صداها من إعادة تشغيل الحوار.
  async function send(jid, text) {
    const result = await sock.sendMessage(jid, { text })
    const id = result?.key?.id
    if (id) {
      ownSentIds.add(id)
      if (ownSentIds.size > 200) {
        // تنظيف بسيط لمنع التضخم غير المحدود
        const first = ownSentIds.values().next().value
        ownSentIds.delete(first)
      }
    }
    return result
  }

  async function showSetupOrMenu(jid) {
    if (isEmpty()) {
      await send(jid, TEXT.needsSetup)
      pendingAction = 'awaiting_content'
    } else {
      const { delaySeconds } = loadSettings()
      await send(jid, TEXT.menu(delaySeconds))
      pendingAction = 'menu'
    }
  }

  function getConfigCommandPrefix(text) {
    return CONFIG_COMMANDS.find((command) => {
      return text === command || text.startsWith(command + ' ') || text.startsWith(command + '\n')
    })
  }

  async function handleConfigCommand(jid, text) {
    const matchedPrefix = getConfigCommandPrefix(text)
    if (!matchedPrefix) return false

    if (text === matchedPrefix) {
      await showSetupOrMenu(jid)
      return true
    }

    // اختصار للمستخدم المتقدم: "<prefix> <محتوى>" يستبدل المحتوى مباشرة
    const newContent = text.slice(matchedPrefix.length).replace(/^\s+/, '')
    const lines = newContent.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0)
    if (lines.length === 0) {
      await send(jid, TEXT.contentEmpty)
      return true
    }
    writeRaw(newContent)
    await send(jid, TEXT.contentSaved(lines.length))
    pendingAction = null
    return true
  }

  async function handlePendingReply(jid, text) {
    if (pendingAction === 'awaiting_content') {
      if (text === '0') {
        pendingAction = null
        await send(jid, TEXT.cancelled)
        return true
      }
      const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0)
      if (lines.length === 0) {
        await send(jid, TEXT.contentEmpty)
        return true // يبقى في نفس الحالة لإعادة المحاولة
      }
      writeRaw(text)
      pendingAction = null
      await send(jid, TEXT.contentSaved(lines.length))
      return true
    }

    if (pendingAction === 'menu') {
      if (text === '0') {
        pendingAction = null
        await send(jid, TEXT.cancelled)
        return true
      }
      if (text === '1') {
        pendingAction = 'awaiting_delay'
        await send(jid, TEXT.askDelay)
        return true
      }
      if (text === '2') {
        pendingAction = 'awaiting_content'
        await send(jid, TEXT.needsSetup)
        return true
      }
      await send(jid, TEXT.invalidChoice) // يبقى في نفس الحالة
      return true
    }

    if (pendingAction === 'awaiting_delay') {
      if (text === '0') {
        pendingAction = null
        await send(jid, TEXT.cancelled)
        return true
      }
      const value = clampDelay(text)
      if (value === null) {
        // clampDelay already rejects non-numeric input and anything
        // outside [MIN_DELAY_SECONDS, MAX_DELAY_SECONDS]
        await send(jid, TEXT.delayInvalid)
        return true
      }
      saveSettings({ delaySeconds: value })
      pendingAction = null
      await send(jid, TEXT.delaySaved(value))
      return true
    }

    return false
  }

  async function handleExecutionTrigger(jid, text, fromMe) {
    if (!fromMe) return false
    if (text !== EXECUTION_TRIGGER) return false

    if (isEmpty()) {
      const selfChat = getSelfChatJid(sock)
      if (selfChat) {
        await send(selfChat, TEXT.needsSetup)
        pendingAction = 'awaiting_content'
      }
      return true
    }

    await publishLines(send, jid)
    return true
  }

  sock.ev.on('messages.upsert', async (update) => {
    if (processing) return
    processing = true
    try {
      const msg = update.messages?.[0]
      if (!msg?.message) return

      const jid = msg.key.remoteJid
      const fromMe = !!msg.key.fromMe

      // فلترة صدى رسائل بانكاي نفسها
      if (fromMe && msg.key.id && ownSentIds.has(msg.key.id)) {
        ownSentIds.delete(msg.key.id)
        return
      }

      const isSelfChat = fromMe && isSelfChatMessage(sock, jid)
      const text = getText(msg.message).trim()
      if (!text) return

      if (isSelfChat) {
        const handledCommand = await handleConfigCommand(jid, text)
        if (handledCommand) return

        if (pendingAction) {
          const handledPending = await handlePendingReply(jid, text)
          if (handledPending) return
        }
      }

      await handleExecutionTrigger(jid, text, fromMe)
    } catch (err) {
      logger.error('Error in Bankai message handler.', err)
    } finally {
      processing = false
    }
  })

  logger.info('Bankai attached and listening.')

  // إعلان الجاهزية عند كل اتصال ناجح، والطلب الفوري لإعداد المحتوى إذا كان
  // الملف فارغًا — بنفس حالة (pendingAction) المستخدمة في المستمع أعلاه،
  // حتى يكون رد المستخدم التالي مفهومًا مباشرة دون الحاجة لإعادة إرسال
  // ".بانكاي".
  ;(async () => {
    const selfChat = getSelfChatJid(sock)
    if (!selfChat) {
      logger.error('Could not resolve self-chat JID to send the ready message.')
      return
    }
    try {
      await send(selfChat, TEXT.ready)
      if (isEmpty()) {
        await send(selfChat, TEXT.needsSetup)
        pendingAction = 'awaiting_content'
      }
    } catch (err) {
      logger.error('Failed to send the ready message.', err)
    }
  })()
}

module.exports = { attachBankai, BANKAI_FILE, CONFIG_COMMAND, EXECUTION_TRIGGER }
