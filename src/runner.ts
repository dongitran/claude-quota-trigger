#!/usr/bin/env node
/**
 * cqt-runner — executed by crontab at each trigger interval.
 * Also handles --regenerate (midnight job to refresh random minutes).
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  generateRandomMinutes,
  loadConfig,
  saveConfig,
} from "./core/config.js";
import { installCronJobs } from "./core/scheduler.js";
import { sendTrigger } from "./core/trigger-runner.js";

const LOG_DIR = join(homedir(), ".config", "cqt");
const LOG_PATH = join(LOG_DIR, "trigger.log");

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;

  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }

  appendFileSync(LOG_PATH, line, "utf-8");
}

function regenerate(): void {
  const config = loadConfig();
  const newMinutes = generateRandomMinutes(config.triggerHours.length);
  const updated = { ...config, randomMinutes: newMinutes };
  saveConfig(updated);
  installCronJobs(updated);
  log(`Regenerated random minutes: [${newMinutes.join(", ")}]`);
}

async function trigger(): Promise<void> {
  const config = loadConfig();

  if (!config.enabled) {
    log("Trigger skipped: cqt is disabled");
    return;
  }

  const result = await sendTrigger(config);

  if (result.success) {
    log(`Trigger OK — model=${result.model} message="${result.message}"`);
  } else {
    log(`Trigger FAILED — ${result.error ?? "unknown error"}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isRegenerate = args.includes("--regenerate");

  try {
    if (isRegenerate) {
      regenerate();
    } else {
      await trigger();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Runner error: ${message}`);
    process.exit(1);
  }
}

await main();
