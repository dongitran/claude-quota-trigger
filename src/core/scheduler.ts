import { execSync } from "node:child_process";
import { accessSync, constants, existsSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CqtConfig, ScheduleStatus, TriggerEntry } from "../types.js";
import { CRON_MARKER_BEGIN, CRON_MARKER_END } from "../types.js";

// Node 20-compatible __dirname (import.meta.dirname is Node 21.2+)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function isExecutable(p: string): boolean {
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function getNodeBin(): string {
  const home = homedir();
  const candidates = [
    // Stable symlinks — Homebrew updates these on upgrade
    "/opt/homebrew/bin/node",  // Homebrew ARM macOS (Apple Silicon)
    "/usr/local/bin/node",     // Homebrew Intel macOS / system
    "/usr/bin/node",           // system Linux
    // Version manager shims — stable across Node upgrades
    `${home}/.volta/bin/node`,                    // volta
    `${home}/.asdf/shims/node`,                   // asdf
    `${home}/.fnm/aliases/default/bin/node`,      // fnm (requires `fnm default <version>`)
  ];

  for (const candidate of candidates) {
    if (isExecutable(candidate)) return candidate;
  }

  // Last resort: current process binary — breaks after Node upgrade (e.g. nvm users)
  return process.execPath;
}

/**
 * Resolves path to the cqt-runner script.
 * After `npm install -g`, dist/cli.js and dist/runner.js are siblings.
 */
function getCqtRunnerBin(): string {
  const siblingRunner = join(__dirname, "runner.js");
  if (existsSync(siblingRunner)) return siblingRunner;
  return "cqt-runner"; // Fallback to PATH
}

function readCurrentCrontab(): string {
  try {
    return execSync("crontab -l", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (err) {
    // Exit code 1 = no crontab for user (normal); anything else is a real error
    const code = (err as NodeJS.ErrnoException & { status?: number }).status;
    if (code !== undefined && code !== 1) {
      throw new Error(`Failed to read crontab (exit ${String(code)}): ${String(err)}`, { cause: err });
    }
    return "";
  }
}

/**
 * Writes crontab content using a temp file to avoid shell injection risk.
 * Never use `echo "..." | crontab -` — shell escaping is fragile.
 */
function writeCurrentCrontab(content: string): void {
  const tmpFile = join(tmpdir(), `cqt-crontab-${String(Date.now())}-${Math.random().toString(36).slice(2)}.tmp`);
  try {
    writeFileSync(tmpFile, content, "utf-8");
    execSync(`crontab ${tmpFile}`, { encoding: "utf-8" });
  } finally {
    if (existsSync(tmpFile)) {
      rmSync(tmpFile);
    }
  }
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

/**
 * Builds a platform-aware PATH string for the cron environment.
 * Cron runs with a minimal PATH — we must supply what we need.
 */
function buildCronPath(): string {
  const base = ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
  if (process.platform === "darwin") {
    return ["/opt/homebrew/bin", "/opt/homebrew/sbin", ...base].join(":");
  }
  // Linux (also handles Linuxbrew)
  return ["/home/linuxbrew/.linuxbrew/bin", ...base].join(":");
}

function buildCronSection(config: CqtConfig): string {
  const nodeBin = getNodeBin();
  const runnerBin = getCqtRunnerBin();
  const pathLine = `PATH=${buildCronPath()}`;

  const triggerLines = config.triggerHours.map((hour, idx) => {
    const minute = config.randomMinutes[idx] ?? 1;
    return `${String(minute)} ${String(hour)} * * * "${nodeBin}" "${runnerBin}" 2>/dev/null`;
  });

  // Midnight job regenerates random minutes daily
  const regenLine = `0 0 * * * "${nodeBin}" "${runnerBin}" --regenerate 2>/dev/null`;

  return [CRON_MARKER_BEGIN, pathLine, ...triggerLines, regenLine, CRON_MARKER_END].join("\n");
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
    try {
      execSync("crontab -r", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    } catch {
      // No crontab to remove — silently ignore
    }
  } else {
    writeCurrentCrontab(cleaned + "\n");
  }
}

export function getScheduleStatus(config: CqtConfig): ScheduleStatus {
  if (!config.enabled || config.randomMinutes.length === 0) {
    return { enabled: false, entries: [], nextTrigger: null, nextTriggerIsNextDay: false };
  }

  const entries: TriggerEntry[] = config.triggerHours.map((hour, idx) => ({
    hour,
    minute: config.randomMinutes[idx] ?? 1,
  }));

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const foundTrigger = entries.find((e) => {
    if (e.hour > currentHour) return true;
    if (e.hour === currentHour && e.minute > currentMinute) return true;
    return false;
  });

  const nextTrigger = foundTrigger ?? entries[0] ?? null;
  const nextTriggerIsNextDay = foundTrigger === undefined && entries.length > 0;

  return { enabled: config.enabled, entries, nextTrigger, nextTriggerIsNextDay };
}
