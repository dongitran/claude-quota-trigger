import { execSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CqtConfig, ScheduleStatus, TriggerEntry } from "../types.js";
import { CRON_MARKER_BEGIN, CRON_MARKER_END } from "../types.js";

// Node 20-compatible __dirname (import.meta.dirname is Node 21.2+)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 *
 * Version manager bin dirs (volta, asdf, fnm) are included when present so that
 * `/usr/bin/env node` in cron entries resolves correctly without baking an
 * install-time absolute path into the crontab.
 */
function buildCronPath(): string {
  const home = homedir();

  // Include version manager shim dirs if they exist on this machine.
  // Expanded to absolute paths because cron does not expand `~`.
  const versionManagerDirs = [
    `${home}/.volta/bin`,               // volta
    `${home}/.asdf/shims`,              // asdf
    `${home}/.fnm/aliases/default/bin`, // fnm (requires `fnm default <version>`)
  ].filter(existsSync);

  const base = ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];

  if (process.platform === "darwin") {
    return ["/opt/homebrew/bin", "/opt/homebrew/sbin", ...versionManagerDirs, ...base].join(":");
  }
  // Linux — includes Linuxbrew (WSL + native)
  return ["/home/linuxbrew/.linuxbrew/bin", ...versionManagerDirs, ...base].join(":");
}

/**
 * Builds the CQT cron section.
 *
 * Uses `/usr/bin/env node` instead of a hardcoded absolute binary path so that
 * node is resolved at runtime via the PATH line above each job. This means cron
 * keeps working after `brew upgrade node` or a version-manager switch without
 * requiring `cqt setup` to be re-run.
 */
function buildCronSection(config: CqtConfig): string {
  const runnerBin = getCqtRunnerBin();
  const pathLine = `PATH=${buildCronPath()}`;

  const triggerLines = config.triggerHours.map((hour, idx) => {
    const minute = config.randomMinutes[idx] ?? 1;
    return `${String(minute)} ${String(hour)} * * * /usr/bin/env node "${runnerBin}" 2>/dev/null`;
  });

  // Midnight job regenerates random minutes daily
  const regenLine = `0 0 * * * /usr/bin/env node "${runnerBin}" --regenerate 2>/dev/null`;

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
