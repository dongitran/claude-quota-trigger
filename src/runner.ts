#!/usr/bin/env node
/**
 * cqt-runner — executed by crontab at each trigger interval.
 * Also handles --regenerate (midnight job to refresh random minutes).
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  generateRandomMinutes,
  getLogPath,
  loadConfig,
  saveConfig,
} from "./core/config.js";
import { installCronJobs } from "./core/scheduler.js";
import { sendTrigger } from "./core/trigger-runner.js";

const LOG_PATH = getLogPath();

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;

  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    appendFileSync(LOG_PATH, line, "utf-8");
  } catch (logErr) {
    process.stderr.write(
      `[CQT] Warning: could not write log — ${logErr instanceof Error ? logErr.message : String(logErr)}\n`,
    );
  }
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
