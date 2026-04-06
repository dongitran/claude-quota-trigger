import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import ora from "ora";
import chalk from "chalk";
import {
  buildTriggerHours,
  generateRandomMinutes,
  loadConfig,
  saveConfig,
} from "../core/config.js";
import { installCronJobs } from "../core/scheduler.js";
import { findClaudeBin } from "../core/trigger-runner.js";

/**
 * Checks if the claude CLI is reachable.
 * Warns but does not block setup — user may install claude after.
 */
function checkClaudeAvailable(): boolean {
  const bin = findClaudeBin();
  if (bin !== "claude" && existsSync(bin)) return true;

  // Fallback: check if "claude" is resolvable from PATH
  try {
    execFileSync("which", ["claude"], { encoding: "utf-8", stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function runSetup(firstHour?: number): void {
  const existing = loadConfig();
  const resolvedFirstHour = firstHour ?? existing.firstTriggerHour;

  // Pre-flight: warn if claude CLI not found
  if (!checkClaudeAvailable()) {
    process.stdout.write(
      chalk.yellow(
        "  ⚠ Warning: `claude` CLI not found on this system.\n" +
          "    Install it first: https://claude.ai/download\n" +
          "    CQT will be installed but triggers will fail until claude is available.\n\n",
      ),
    );
  }

  const triggerHours = buildTriggerHours(resolvedFirstHour);
  const randomMinutes = generateRandomMinutes(triggerHours.length);

  const config = {
    ...existing,
    firstTriggerHour: resolvedFirstHour,
    triggerHours,
    randomMinutes,
    enabled: true,
  };

  saveConfig(config);

  const spinner = ora("Installing cron jobs...").start();

  try {
    installCronJobs(config);
    spinner.succeed(chalk.green("Cron jobs installed successfully!"));
  } catch (err) {
    spinner.fail(chalk.red("Failed to install cron jobs"));
    throw err;
  }

  process.stdout.write("\n");
  process.stdout.write(chalk.bold("  Schedule (today's random minutes):\n"));

  triggerHours.forEach((hour, idx) => {
    const minute = randomMinutes[idx] ?? 0;
    const hourStr = String(hour).padStart(2, "0");
    const minStr = String(minute).padStart(2, "0");
    process.stdout.write(
      `    ${chalk.cyan(`${hourStr}:${minStr}`)} — trigger ${String(idx + 1)}\n`,
    );
  });

  process.stdout.write(
    chalk.dim(
      "\n  Minutes regenerate daily at midnight.\n" +
        "  Run `cqt status` to see current schedule.\n" +
        "  Run `cqt logs` to view trigger history.\n\n",
    ),
  );
}
