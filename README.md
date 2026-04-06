<div align="center">

# ⚡ claude-quota-trigger

**Automatically trigger Claude Pro quota resets via cron — maximize your 5-hour usage windows.**

[![npm version](https://img.shields.io/npm/v/claude-quota-trigger?style=flat-square&color=cb3837)](https://www.npmjs.com/package/claude-quota-trigger)
[![CI](https://img.shields.io/github/actions/workflow/status/dongitran/claude-quota-trigger/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/dongitran/claude-quota-trigger/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Node ≥ 20](https://img.shields.io/badge/Node-%3E%3D20-green?style=flat-square)](https://nodejs.org)

</div>

---

## 🤔 Why does this exist?

Claude Pro's usage limits reset on a **rolling 5-hour window** from your last message. If you wait too long between sessions, you lose that window and start a new one — meaning you could be burning quota on hours you're not even active.

**CQT solves this** by automatically sending a minimal ping to Claude at configurable intervals (default: every 5 hours). This keeps your quota window rolling continuously, so when you actually sit down to work, you have the maximum quota available.

> [!NOTE]
> CQT sends ultra-short messages (e.g., `"hi"`, `"ping"`, `"ok"`) using the cheapest model (`haiku`) to minimize token usage while still triggering the window reset.

---

## ✨ Features

- 🕐 **Smart scheduling** — installs cron jobs that fire at `+5h` intervals from your chosen start hour
- 🎲 **Randomized minutes** — each trigger fires at a random minute within its hour (regenerated daily at midnight) to avoid detection patterns
- 🤖 **Model selection** — defaults to `haiku` (cheapest), configurable to `sonnet`, `opus`, or any custom model ID
- 🛠️ **Interactive TUI** — beautiful CLI with colors, spinners, and menus via [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js)
- 📋 **Trigger history** — colorized log viewer with success/failure indicators
- 🔒 **Safe crontab management** — reads/writes crontab via temp file, never injects shell strings
- ⚡ **Auto-setup on install** — `postinstall` script configures cron jobs automatically on global install
- 🍎 **macOS & Linux** — handles Homebrew, Linuxbrew, and system PATH variants

---

## 🚀 Quick Start

### Prerequisites

- [Claude CLI](https://claude.ai/download) installed and authenticated (`claude --version` should work)
- Node.js ≥ 20

### Install globally

```bash
npm install -g claude-quota-trigger
```

On global install, CQT **automatically** sets up cron jobs with the default schedule:

```
05:xx  — trigger 1
10:xx  — trigger 2
15:xx  — trigger 3
20:xx  — trigger 4
```

*(The `:xx` minutes are randomized daily at midnight.)*

### Run the interactive menu

```bash
cqt
```

You'll see a live menu to setup, configure, view logs, or trigger manually.

---

## 📖 Commands

```
cqt                   Interactive menu (default when no args)
cqt setup             Install/refresh cron jobs
cqt status            Show current schedule and next trigger time
cqt configure         Change first trigger hour and model interactively
cqt trigger           Send a trigger message to Claude right now
cqt logs              View recent trigger history
cqt uninstall         Remove all CQT cron jobs
```

### `cqt setup`

```bash
# Use default first trigger at 05:xx
cqt setup

# Start at 9am → triggers at 09:xx, 14:xx, 19:xx, 00:xx
cqt setup --first-hour 9
```

### `cqt status`

```
CQT Status
──────────────────────────
  Enabled:  yes
  Model:    haiku

  Trigger times today:
    ✓ [1] 05:23
    ✓ [2] 10:47
    → [3] 15:12
    · [4] 20:38

  Next trigger: 15:12
```

### `cqt logs`

```
Recent Triggers (showing 5 of 23 entries)
────────────────────────────────────────────
  ✓ [2026-04-06T10:47:32Z] Trigger OK — model=haiku message="ping"
  ✓ [2026-04-06T05:23:11Z] Trigger OK — model=haiku message="hi"
  ↻ [2026-04-06T00:00:02Z] Regenerated random minutes: [23, 47, 12, 38]
  ✓ [2026-04-05T20:38:55Z] Trigger OK — model=haiku message="ok"
  ✓ [2026-04-05T15:12:43Z] Trigger OK — model=haiku message="ready"
```

### `cqt configure`

Interactive prompts to:
- Choose your first trigger hour (00:00–23:00)
- Select Claude model (`haiku` / `sonnet` / `opus` / custom)

---

## ⚙️ How It Works

```
npm install -g claude-quota-trigger
         │
         ▼
   postinstall.js
   ├── detects global install
   ├── generates random minutes
   ├── saves ~/.config/cqt/config.json
   └── writes crontab via temp file
         │
         ▼
   crontab (user-level)
   ├── 23 5  * * *  node /path/dist/runner.js   ← trigger 1
   ├── 47 10 * * *  node /path/dist/runner.js   ← trigger 2
   ├── 12 15 * * *  node /path/dist/runner.js   ← trigger 3
   ├── 38 20 * * *  node /path/dist/runner.js   ← trigger 4
   └──  0  0 * * *  node /path/dist/runner.js --regenerate
         │
         ▼
   runner.js (at each interval)
   ├── loads config
   ├── picks random message from 100 short phrases
   ├── runs: claude -p "<message>" --model haiku
   └── appends result to ~/.config/cqt/trigger.log
```

### Dual binary architecture

| Binary | Purpose |
|--------|---------|
| `cqt` | Interactive CLI — humans use this |
| `cqt-runner` | Cron daemon — called by crontab, no TTY |

### Config file

Stored at `~/.config/cqt/config.json`:

```json
{
  "firstTriggerHour": 5,
  "triggerHours": [5, 10, 15, 20],
  "model": "haiku",
  "randomMinutes": [23, 47, 12, 38],
  "enabled": true
}
```

### Log file

Stored at `~/.config/cqt/trigger.log`:

```
[2026-04-06T10:47:32.000Z] Trigger OK — model=haiku message="ping"
[2026-04-06T10:47:32.000Z] Trigger FAILED — spawn claude ENOENT
[2026-04-06T00:00:02.000Z] Regenerated random minutes: [14, 52, 33, 8]
```

---

## 🛠️ Development

```bash
git clone https://github.com/dongitran/claude-quota-trigger.git
cd claude-quota-trigger
npm install

# Run all checks (typecheck + lint + spell + test)
npm run check

# Watch mode for tests
npm run test:watch

# Build
npm run build

# Run locally without installing globally
node dist/cli.js
```

### Project structure

```
src/
├── cli.ts              CLI entry — Commander + interactive menu
├── runner.ts           Cron daemon entry — no TTY, appends logs
├── postinstall.ts      Auto-setup on `npm install -g`
├── types.ts            Shared types and constants
├── commands/
│   ├── setup.ts        `cqt setup` — install cron jobs
│   ├── status.ts       `cqt status` — show schedule
│   ├── configure.ts    `cqt configure` — interactive reconfigure
│   ├── trigger.ts      `cqt trigger` — manual trigger
│   ├── logs.ts         `cqt logs` — view history
│   └── uninstall.ts    `cqt uninstall` — remove cron jobs
└── core/
    ├── config.ts        Load/save ~/.config/cqt/config.json
    ├── scheduler.ts     Crontab read/write/strip logic
    ├── trigger-runner.ts  Invoke `claude` CLI
    └── messages.ts      100 short trigger message pool
```

### Tech stack

| Tool | Purpose |
|------|---------|
| TypeScript 6 | Type-safe source |
| Commander | CLI argument parsing |
| @inquirer/prompts | Interactive menus |
| chalk + ora | Terminal colors and spinners |
| Vitest + coverage-v8 | Unit testing |
| ESLint + cspell | Linting and spell checking |
| Husky | Pre-commit hooks |

---

## 🔐 Security

- **No secrets stored** — CQT never stores your Claude credentials; it uses the `claude` CLI which manages auth separately
- **No shell injection** — crontab is written via a temp file (`crontab /tmp/cqt-*.tmp`), never via `echo "..." | crontab -`
- **Minimal permissions** — only reads/writes `~/.config/cqt/` and modifies your user crontab
- **No network calls** — CQT itself makes no HTTP requests; only the `claude` CLI does

---

## ❓ FAQ

**Q: Will this use a lot of my Claude quota?**
> No. Each trigger sends a 1–3 word message using `haiku` (the cheapest model). The response is intentionally minimal. You can check `cqt logs` to see exactly what's being sent.

**Q: Will this work on Linux?**
> Yes. CQT handles both macOS (Homebrew) and Linux (Linuxbrew + system) PATH variants automatically.

**Q: What if `claude` isn't installed yet?**
> CQT will warn you but still install the cron jobs. Once you install and authenticate the `claude` CLI, triggers will start working automatically.

**Q: Can I customize the trigger message?**
> Not per-message — CQT picks randomly from a pool of 100 short phrases. This is intentional to keep messages varied and natural.

**Q: How do I stop CQT?**
> Run `cqt uninstall` to remove all cron jobs, or `cqt configure` and set it inactive. Your config file is preserved.

---

## 📄 License

MIT © [Dong Tran](https://github.com/dongitran)

---

<div align="center">

**If CQT saves your quota, give it a ⭐ on [GitHub](https://github.com/dongitran/claude-quota-trigger)!**

</div>
