import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { CqtConfig } from "../types.js";
import { DEFAULT_CONFIG } from "../types.js";

const CONFIG_DIR = join(homedir(), ".config", "cqt");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function loadConfig(): CqtConfig {
  ensureConfigDir();
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: CqtConfig): void {
  ensureConfigDir();
  const dirPath = dirname(CONFIG_PATH);
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function buildTriggerHours(firstHour: number): number[] {
  return [firstHour, firstHour + 5, firstHour + 10, firstHour + 15].map(
    (h) => h % 24,
  );
}

export function generateRandomMinutes(count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 59) + 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "number")
  );
}

function mergeWithDefaults(parsed: unknown): CqtConfig {
  if (!isRecord(parsed)) {
    return DEFAULT_CONFIG;
  }

  const firstTriggerHour =
    typeof parsed["firstTriggerHour"] === "number"
      ? parsed["firstTriggerHour"]
      : DEFAULT_CONFIG.firstTriggerHour;

  const triggerHours = isNumberArray(parsed["triggerHours"])
    ? (parsed["triggerHours"] as readonly number[])
    : buildTriggerHours(firstTriggerHour);

  const model =
    typeof parsed["model"] === "string" ? parsed["model"] : DEFAULT_CONFIG.model;

  const randomMinutes = isNumberArray(parsed["randomMinutes"])
    ? (parsed["randomMinutes"] as readonly number[])
    : DEFAULT_CONFIG.randomMinutes;

  const enabled =
    typeof parsed["enabled"] === "boolean"
      ? parsed["enabled"]
      : DEFAULT_CONFIG.enabled;

  return {
    firstTriggerHour,
    triggerHours,
    model,
    randomMinutes,
    enabled,
  };
}
