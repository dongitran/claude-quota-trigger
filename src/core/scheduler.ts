import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CqtConfig, ScheduleStatus, TriggerEntry } from "../types.js";
import { CRON_MARKER_BEGIN, CRON_MARKER_END } from "../types.js";

function getNodeBin(): string {
  return process.execPath;
}

function getCqtRunnerBin(): string {
  // Resolve to the installed cqt-runner binary
  const localRunner = join(import.meta.dirname, "..", "runner.js");
  const globalRunner = join(import.meta.dirname, "runner.js");

  if (existsSync(localRunner)) return localRunner;
  if (existsSync(globalRunner)) return globalRunner;
  // Fallback: assume installed globally alongside this script
  return join(import.meta.dirname, "runner.js");
}

function readCurrentCrontab(): string {
  try {
    return execSync("crontab -l 2>/dev/null", { encoding: "utf-8" });
  } catch {
    return "";
  }
}

function writeCurrentCrontab(content: string): void {
  execSync(`echo ${JSON.stringify(content)} | crontab -`, { encoding: "utf-8" });
}

function stripCqtSection(crontab: string): string {
  const lines = crontab.split("\n");
  const result: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.trim() === CRON_MARKER_BEGIN) {
      inSection = true;
      continue;
    }
    if (line.trim() === CRON_MARKER_END) {
      inSection = false;
      continue;
    }
    if (!inSection) {
      result.push(line);
    }
  }

  return result.join("\n").replace(/\n{3,}/g, "\n\n");
}

function buildCronSection(config: CqtConfig): string {
  const nodeBin = getNodeBin();
  const runnerBin = getCqtRunnerBin();

  // PATH needed in cron environment (homebrew + standard paths)
  const pathLine =
    "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/opt/homebrew/sbin:/usr/sbin:/sbin";

  const triggerLines = config.triggerHours.map((hour, idx) => {
    const minute = config.randomMinutes[idx] ?? 1;
    return `${String(minute)} ${String(hour)} * * * ${nodeBin} ${runnerBin} 2>/dev/null`;
  });

  // Midnight job to regenerate random minutes daily
  const regenLine = `0 0 * * * ${nodeBin} ${runnerBin} --regenerate 2>/dev/null`;

  const lines = [
    CRON_MARKER_BEGIN,
    pathLine,
    ...triggerLines,
    regenLine,
    CRON_MARKER_END,
  ];

  return lines.join("\n");
}

export function installCronJobs(config: CqtConfig): void {
  const existing = readCurrentCrontab();
  const stripped = stripCqtSection(existing);
  const newSection = buildCronSection(config);

  const trimmed = stripped.trim();
  const newCrontab =
    trimmed.length > 0 ? `${trimmed}\n\n${newSection}\n` : `${newSection}\n`;

  writeCurrentCrontab(newCrontab);
}

export function uninstallCronJobs(): void {
  const existing = readCurrentCrontab();
  const stripped = stripCqtSection(existing);
  const cleaned = stripped.trim();

  if (cleaned.length === 0) {
    execSync("crontab -r 2>/dev/null || true", { encoding: "utf-8" });
  } else {
    writeCurrentCrontab(cleaned + "\n");
  }
}

export function getScheduleStatus(config: CqtConfig): ScheduleStatus {
  if (!config.enabled || config.randomMinutes.length === 0) {
    return { enabled: false, entries: [], nextTrigger: null };
  }

  const entries: TriggerEntry[] = config.triggerHours.map((hour, idx) => ({
    hour,
    minute: config.randomMinutes[idx] ?? 1,
  }));

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const nextTrigger =
    entries.find((e) => {
      if (e.hour > currentHour) return true;
      if (e.hour === currentHour && e.minute > currentMinute) return true;
      return false;
    }) ?? entries[0] ?? null;

  return { enabled: config.enabled, entries, nextTrigger };
}
