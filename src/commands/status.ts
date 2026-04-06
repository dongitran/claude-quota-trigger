import chalk from "chalk";
import { loadConfig } from "../core/config.js";
import { getScheduleStatus } from "../core/scheduler.js";

export function runStatus(): void {
  const config = loadConfig();
  const status = getScheduleStatus(config);

  process.stdout.write(chalk.bold("\nCQT Status\n"));
  process.stdout.write("──────────────────────────\n");
  process.stdout.write(
    `  Enabled:  ${status.enabled ? chalk.green("yes") : chalk.red("no")}\n`,
  );
  process.stdout.write(`  Model:    ${chalk.cyan(config.model)}\n`);

  if (!status.enabled || status.entries.length === 0) {
    process.stdout.write(
      chalk.dim('\n  No schedule set. Run `cqt setup` to install.\n'),
    );
    return;
  }

  process.stdout.write("\n  Trigger times today:\n");

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  status.entries.forEach((entry, idx) => {
    const hourStr = String(entry.hour).padStart(2, "0");
    const minStr = String(entry.minute).padStart(2, "0");
    const time = `${hourStr}:${minStr}`;
    const isPast =
      entry.hour < currentHour ||
      (entry.hour === currentHour && entry.minute <= currentMinute);
    const marker = isPast ? chalk.dim("✓") : chalk.green("→");
    const idxLabel = String(idx + 1);
    process.stdout.write(
      `    ${marker} [${idxLabel}] ${isPast ? chalk.dim(time) : chalk.bold(time)}\n`,
    );
  });

  if (status.nextTrigger !== null) {
    const { hour, minute } = status.nextTrigger;
    const next = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    process.stdout.write(`\n  Next trigger: ${chalk.yellow(next)}\n`);
  }

  process.stdout.write("\n");
}
