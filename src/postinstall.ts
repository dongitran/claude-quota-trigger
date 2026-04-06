#!/usr/bin/env node
/**
 * Runs automatically after `npm install -g claude-quota-trigger`.
 * Skipped for local/dev installs.
 * Idempotent — safe to run multiple times.
 */

import {
  buildTriggerHours,
  generateRandomMinutes,
  loadConfig,
  saveConfig,
} from "./core/config.js";
import { installCronJobs } from "./core/scheduler.js";
import { findClaudeBin } from "./core/trigger-runner.js";
import { existsSync } from "node:fs";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

function print(msg: string): void {
  process.stdout.write(msg + "\n");
}

function isGlobalInstall(): boolean {
  return process.env["npm_config_global"] === "true";
}

function main(): void {
  // Only auto-setup for global installs
  if (!isGlobalInstall()) {
    process.exit(0);
  }

  print("");
  print(`${BOLD}${CYAN}  CQT — Claude Quota Trigger${RESET}`);
  print(`${DIM}  Maximize your Claude Pro 5h quota windows${RESET}`);
  print("");

  const existing = loadConfig();

  // Already set up — don't overwrite user's config
  if (existing.enabled) {
    print(`${GREEN}  ✓ Already configured. Running with existing schedule.${RESET}`);
    print(`${DIM}  Run \`cqt status\` to view, \`cqt configure\` to change.${RESET}`);
    print("");
    process.exit(0);
  }

  // Warn if claude CLI not found
  const claudeBin = findClaudeBin();
  const claudeFound = claudeBin !== "claude" && existsSync(claudeBin);
  if (!claudeFound) {
    print(
      `${YELLOW}  ⚠ Warning: \`claude\` CLI not found.${RESET}`,
    );
    print(
      `${DIM}  Install it first: https://claude.ai/download${RESET}`,
    );
    print(
      `${DIM}  CQT will be installed but triggers will fail until claude is available.${RESET}`,
    );
    print("");
  }

  // Auto-setup with defaults: 05:xx, 10:xx, 15:xx, 20:xx
  const firstHour = existing.firstTriggerHour;
  const triggerHours = buildTriggerHours(firstHour);
  const randomMinutes = generateRandomMinutes(triggerHours.length);

  const config = {
    ...existing,
    triggerHours,
    randomMinutes,
    enabled: true,
  };

  try {
    saveConfig(config);
    installCronJobs(config);

    print(`${GREEN}  ✓ Cron jobs installed!${RESET}`);
    print("");
    print(`${BOLD}  Default schedule (minutes randomize daily):${RESET}`);

    triggerHours.forEach((hour, idx) => {
      const minute = randomMinutes[idx] ?? 0;
      const h = String(hour).padStart(2, "0");
      const m = String(minute).padStart(2, "0");
      print(`    ${CYAN}${h}:${m}${RESET}  — trigger ${String(idx + 1)}`);
    });

    print("");
    print(`${DIM}  Commands:${RESET}`);
    print(`${DIM}    cqt            — interactive menu${RESET}`);
    print(`${DIM}    cqt status     — show schedule${RESET}`);
    print(`${DIM}    cqt configure  — change first trigger hour${RESET}`);
    print(`${DIM}    cqt logs       — view trigger history${RESET}`);
    print(`${DIM}    cqt trigger    — send trigger now${RESET}`);
    print("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    print(`${YELLOW}  ⚠ Could not install cron jobs: ${msg}${RESET}`);
    print(`${DIM}  Run \`cqt setup\` manually after install.${RESET}`);
    print("");
    // Never fail the npm install
    process.exit(0);
  }
}

main();
