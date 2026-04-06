import { confirm } from "@inquirer/prompts";
import ora from "ora";
import chalk from "chalk";
import { loadConfig, saveConfig } from "../core/config.js";
import { uninstallCronJobs } from "../core/scheduler.js";

export async function runUninstall(): Promise<void> {
  // async needed for @inquirer/prompts
  const confirmed = await confirm({
    message: "Remove all CQT cron jobs?",
    default: false,
  });

  if (!confirmed) {
    process.stdout.write(chalk.dim("Aborted.\n"));
    return;
  }

  const spinner = ora("Removing cron jobs...").start();

  try {
    uninstallCronJobs();
    spinner.succeed(chalk.green("Cron jobs removed."));
  } catch (err) {
    spinner.fail(chalk.red("Failed to remove cron jobs."));
    throw err;
  }

  const config = loadConfig();
  saveConfig({ ...config, enabled: false });
  process.stdout.write(chalk.dim("Run `cqt setup` to re-install.\n"));
}
