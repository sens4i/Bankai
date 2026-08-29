# Bankai WhatsApp Bot 🚀

[![Node.js Version](https://img.shields.io/badge/node->=%2018.0.0-green.style=flat-square)](https://nodejs.org/)
[![GitHub Stars](https://img.shields.io/github/stars/sens4i/bankai?style=flat-square)](https://github.com/sens4i/bankai/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/sens4i/bankai?style=flat-square)](https://github.com/sens4i/bankai/issues)

**Bankai** is a lightweight, high-performance WhatsApp automation bot built for stability, modularity, and seamless device integration. Designed with a clean architectural structure, it enables smooth extension and customization for event handling and automated message processing.

---

## 💡 Key Features

- ⚡ **High Performance & Low Latency:** Optimized event handling for instant responses.
- 📱 **Seamless Device Linking:** Native support for QR code scanning and pairing codes (`deviceLinking`).
- ⚙️ **Flexible Configuration:** Dynamic settings management (`settings.json` & runtime config).
- 📝 **Structured Logging:** Integrated logging module (`logger`) for tracking events and debugging.
- 📤 **Publishing & Messaging:** Built-in queueing and dispatching mechanisms for reliable message delivery.
- 🏗️ **Clean Architecture:** Modular directory structure allowing developers to easily plug in new utilities and UX handlers.

---

## 🛠️ Repository Structure

```text
├── src/
│   ├── bankai.jsux         # Core bot instance & event orchestration
│   ├── config.jsux         # Global configurations & env bindings
│   ├── deviceLinking.jsux  # QR code & pairing authentication logic
│   ├── logger.jsux         # Built-in logging utility
│   ├── publishing.jsux     # Content broadcasting & publishing workflow
│   ├── sender.jsux         # Message delivery & payload formatting
│   ├── settings.jsux       # Dynamic runtime settings handler
│   └── ux/                 # Custom interaction handlers & templates
├── index.js                # Main application entry point
├── settings.json           # Application settings file
├── package.json            # Node.js dependencies & project scripts
└── README.md               # Project documentation
