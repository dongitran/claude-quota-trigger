import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { getRandomMessage } from "./messages.js";
import type { CqtConfig } from "../types.js";

const execFileAsync = promisify(execFile);

const CLAUDE_CANDIDATES = [
  "/opt/homebrew/bin/claude",
  "/usr/local/bin/claude",
  "/usr/bin/claude",
] as const;

export interface TriggerResult {
  readonly success: boolean;
  readonly message: string;
  readonly model: string;
  readonly error?: string;
}

export function findClaudeBin(): string {
  for (const candidate of CLAUDE_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return "claude";
}

/**
 * Sends a trigger message to Claude using the CLI.
 * Uses --model flag to select haiku (minimal token usage).
 */
export async function sendTrigger(config: CqtConfig): Promise<TriggerResult> {
  const message = getRandomMessage();
  const model = config.model;
  const claudeBin = findClaudeBin();

  try {
    await execFileAsync(claudeBin, ["-p", message, "--model", model], {
      timeout: 30_000,
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env["PATH"] ?? ""}`,
      },
    });

    return { success: true, message, model };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, message, model, error };
  }
}
