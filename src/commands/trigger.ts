import ora from "ora";
import chalk from "chalk";
import { loadConfig } from "../core/config.js";
import { sendTrigger } from "../core/trigger-runner.js";

export async function runTrigger(): Promise<void> {
  const config = loadConfig();
  const spinner = ora(`Triggering Claude (model: ${config.model})...`).start();

  try {
    const result = await sendTrigger(config);

    if (result.success) {
      spinner.succeed(
        chalk.green(`Trigger sent!`) +
          chalk.dim(` message="${result.message}" model=${result.model}`),
      );
    } else {
      spinner.fail(
        chalk.red("Trigger failed: ") + chalk.dim(result.error ?? "unknown"),
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    spinner.fail(chalk.red(`Error: ${message}`));
    throw err;
  }
}
