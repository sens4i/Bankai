# Bankai

WhatsApp broadcast automation. Device linking, authentication, and the
connection lifecycle are extracted unchanged from the Knight Bot
reference (`@whiskeysockets/baileys`-based) — everything else, including
the Bankai system itself, is built on top without touching that layer.

## Structure

```
bankai/
├── index.js              Entry point: wiring + graceful shutdown/restart
├── nodemon.json           Auto-restart watch scope (source only)
├── settings.json           Runtime settings (created automatically)
├── Bankai.txt                Broadcast content, one message per line
├── src/
│   ├── config.js              Locked connection config (env-driven)
│   ├── settings.js             Persisted runtime settings (delay between messages)
│   ├── logger.js                Terminal logger — boxed [ERROR] banners
│   ├── deviceLinking.js         
│   ├── bankai.js                   The Bankai system (config dialog + publishing)
│   └── sender.js                     Basic direct-send helper
└── package.json
```

## Language split: terminal vs. WhatsApp

Everything printed to the **terminal** ([INFO]/[WARN]/[ERROR] logs) is in
**English**. Everything sent **into WhatsApp** (the `.بانكاي` menu,
confirmations, the "بانكاي جاهز" ready message) is in **Arabic**, since
that's what you and anyone reading the chat sees. These are two separate
things by design — the terminal is your operator console, WhatsApp is
the user-facing surface.

## Commands

| | Config command (self-chat only) | Content file | Execution trigger |
|---|---|---|---|
| Bankai | `.بانكاي` | `Bankai.txt` | `....` |

- **`.بانكاي`** works only from the bot's own self-chat. If `Bankai.txt`
  is empty, it asks for content directly. If content already exists, it
  shows a numbered menu:
  1. Delay between messages (shows current value, asks for a new one — supports decimals like `0.1` or `0.01`, min `0.01`, max `300`)
  2. Edit Bankai content
  0. Cancel
- **`....`** (four dots, exact match) publishes: reads `Bankai.txt`,
  splits into non-empty lines, sends each as a separate message, in
  order, into whatever chat the trigger was sent from, with the
  configured delay between each message. Only the bot's own account can
  trigger it.
- On every successful connection, Bankai sends **"بانكاي جاهز ✅"** to
  self-chat, and if `Bankai.txt` is empty, immediately follows up asking
  for content — the system is never left silently empty.

## What was deliberately not built

"Typing speed" and a "human-typing simulator" (character-by-character
typing, human-paced timing) were requested at one point and left out.
That combination's real function in a bulk-broadcast tool is evading
WhatsApp's automated-abuse detection, which is different from an honest
send-delay. What's implemented instead is a plain, clearly-labeled delay
between messages, capped well under an hour, that exists to avoid
hammering the connection — not to disguise the tool's automated nature.

## Error visibility

`src/logger.js` renders `[ERROR]` as a bold red bordered banner (with
the full stack trace) so a real failure can't be missed while scrolling
past routine `[INFO]` lines. `[WARN]` is bold yellow. `[INFO]` stays
plain and unobtrusive. Colors auto-disable when output isn't a real
terminal (e.g. piped to a log file).

One honest caveat: this only covers errors that happen *after* Node has
successfully loaded the app's own code. If dependencies aren't installed
yet (`npm install` was skipped) and a `require()` fails, that crash
happens before any of this logging exists, so you'd see Node's raw
default error instead of the boxed banner. That's a setup problem, not
a runtime one — `npm install` first and it doesn't come up again.

## Auto-restart on code changes

`npm run dev` runs the bot under `nodemon` instead of plain `node`.
Editing and saving `index.js` or anything under `src/` triggers an
automatic restart — no manual `Ctrl+C` + `npm start` needed.

Two things were deliberately built in for stability, not just "restart
on any file change":

- **Scoped watching.** `nodemon.json` only watches `index.js` and
  `src/`. It does *not* watch `Bankai.txt` or `settings.json` — those
  are runtime data the bot writes to itself (e.g. every time `.بانكاي`
  saves new content). If those were watched too, saving content through
  WhatsApp would trigger a restart mid-conversation and could drop the
  in-progress config dialog — the opposite of stable. Only real code
  edits trigger a restart.
- **Session survives restarts.** Restarting doesn't clear the saved
  WhatsApp session, so nodemon reconnects automatically without asking
  you to re-pair every time you save a file.
- **Proper nodemon signal handling.** `index.js` listens for `SIGUSR2`
  (the signal nodemon sends before restarting) separately from
  `SIGINT`/`SIGTERM` (manual stop), closes the socket cleanly, then
  re-raises `SIGUSR2` to let nodemon actually perform the restart —
  rather than just calling `process.exit()`, which would skip nodemon's
  restart bookkeeping and could leave things in a bad state.

```bash
npm install
npm run dev              # auto-restarts on src/ or index.js changes
# or, for pairing-code mode:
npm run dev:pairing-code
```

`npm start` (no auto-restart) still works exactly as before, for normal
production use where you don't want restarts triggered by file edits at
all.

## Response speed

The `.بانكاي` config dialog has no artificial delay anywhere — every
reply is sent immediately via a plain `await sock.sendMessage(...)`. The
only deliberate delay in the whole system is the configurable pause
*between broadcast lines* during an actual `....` publish, which is
user-controlled and serves a real purpose (not overwhelming the
connection). There was no other latency in the system to remove.

## Reliability of the `.بانكاي` config dialog

The dialog is a small state machine (`pendingAction`: `null` /
`'menu'` / `'awaiting_content'` / `'awaiting_delay'`) rather than relying
on WhatsApp's reply/quote metadata, since that metadata isn't always
attached reliably by every WhatsApp client.

Three protections, verified against a mocked socket before delivery:

1. **Self-echo filtering** — every message Bankai sends itself has its
   ID tracked, so Baileys reporting the bot's own outgoing message back
   through `messages.upsert` doesn't get misread as the owner's answer.
2. **A processing mutex** — closes the same self-echo race from another
   angle by not processing a second event while the first is still
   mid-flight.
3. **Self-healing on bad input** — an unrecognized menu choice or an
   invalid delay value gets a clear error message and stays in the same
   state for a retry, instead of silently dropping the message or
   getting the dialog stuck.

## Running

```bash
npm install
cp .env.example .env   # optional: set BANKAI_PHONE_NUMBER for pairing-code mode
npm start               # normal run
npm run dev              # run with auto-restart on code changes
```

## Test status

| Test | Status |
|---|---|
| Bankai dialog logic (mocked, verified before delivery) | ✅ pass |
| Syntax validity (`node -c` on every file) | ✅ pass |
| Error banner rendering | ✅ verified directly against `src/logger.js` |
| Live device linking / pairing | ❌ NOT VERIFIED — needs a real WhatsApp device and network egress, unavailable in this sandbox |
| Live publish over a real connection | ❌ NOT VERIFIED — same reason |
| `nodemon` actually restarting a live process | ❌ NOT VERIFIED — `npm install` requires network, unavailable here; the signal-handling logic was reviewed manually against nodemon's documented restart behavior |

## What's still locked

`src/deviceLinking.js` — pairing, auth, session persistence, reconnect
logic — is untouched. Nothing in this change touched it.
