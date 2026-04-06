import ora from "ora";
import chalk from "chalk";
import {
  buildTriggerHours,
  generateRandomMinutes,
  loadConfig,
  saveConfig,
} from "../core/config.js";
import { installCronJobs } from "../core/scheduler.js";

export function runSetup(firstHour?: number): void {
  const existing = loadConfig();
  const resolvedFirstHour = firstHour ?? existing.firstTriggerHour;

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
  process.stdout.write(chalk.bold("Schedule:\n"));

  triggerHours.forEach((hour, idx) => {
    const minute = randomMinutes[idx] ?? 0;
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    process.stdout.write(`  ${chalk.cyan(time)} — trigger ${String(idx + 1)}\n`);
  });

  process.stdout.write(
    chalk.dim(
      "\nRandom minutes regenerate daily at midnight.\n" +
        "Run `cqt status` to see current schedule.\n",
    ),
  );
}
