/**
 * Bankai — logger.
 *
 * [INFO] / [WARN] are plain, single-line, easy to scroll past.
 * [ERROR] is rendered as a large, hard-to-miss boxed banner (bold red)
 * so a real failure never gets lost between routine connection logs.
 *
 * Never logs credentials, tokens, session secrets, or auth payloads.
 */
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'

const useColor = process.stdout.isTTY

function color(code, text) {
  return useColor ? `${code}${text}${RESET}` : text
}

function timestamp() {
  return new Date().toISOString()
}

const WIDTH = 70
const BORDER = '='.repeat(WIDTH)

const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),

  warn: (msg) => console.warn(color(BOLD + YELLOW, `[WARN] ${msg}`)),

  // Errors get their own boxed banner: a top/bottom border, the message,
  // and (if present) the stack trace — all in bold red — so it's
  // visually impossible to mistake for a routine [INFO] line while
  // scrolling a busy terminal.
  error: (msg, err) => {
    const lines = [
      '',
      color(BOLD + RED, BORDER),
      color(BOLD + RED, `  ERROR  ${timestamp()}`),
      color(BOLD + RED, BORDER),
      color(RED, `  ${msg}`),
    ]
    if (err) {
      const detail = err.stack || err.message || String(err)
      for (const line of detail.split('\n')) {
        lines.push(color(DIM + RED, `  ${line}`))
      }
    }
    lines.push(color(BOLD + RED, BORDER), '')
    console.error(lines.join('\n'))
  },

  debug: (msg) => {
    if (process.env.BANKAI_LOG_LEVEL === 'debug') console.log(`[DEBUG] ${timestamp()} ${msg}`)
  },
}

module.exports = logger
