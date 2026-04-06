import { select, input } from "@inquirer/prompts";
import chalk from "chalk";
import {
  buildTriggerHours,
  generateRandomMinutes,
  loadConfig,
  saveConfig,
} from "../core/config.js";
import { installCronJobs } from "../core/scheduler.js";

const HOUR_CHOICES = Array.from({ length: 24 }, (_, i) => ({
  name: `${String(i).padStart(2, "0")}:00`,
  value: i,
}));

const MODEL_CHOICES = [
  { name: "haiku (fastest, cheapest — recommended)", value: "haiku" },
  { name: "sonnet (balanced)", value: "sonnet" },
  { name: "opus (most capable)", value: "opus" },
];

export async function runConfigure(): Promise<void> {
  const config = loadConfig();

  process.stdout.write(chalk.bold("\nConfigure CQT\n"));
  process.stdout.write(chalk.dim("Other 3 triggers auto-set at +5h intervals.\n\n"));

  const firstHour = await select({
    message: "First daily trigger hour:",
    choices: HOUR_CHOICES,
    default: config.firstTriggerHour,
  });

  const model = await select({
    message: "Claude model to use:",
    choices: MODEL_CHOICES,
    default: config.model,
  });

  const customModelRaw = await input({
    message: "Custom model ID? (leave blank to use selection above):",
    default: "",
  });

  const resolvedModel =
    customModelRaw.trim().length > 0 ? customModelRaw.trim() : model;

  const triggerHours = buildTriggerHours(firstHour);
  const randomMinutes = generateRandomMinutes(triggerHours.length);

  const updated = {
    ...config,
    firstTriggerHour: firstHour,
    triggerHours,
    model: resolvedModel,
    randomMinutes,
    enabled: true,
  };

  saveConfig(updated);

  if (updated.enabled) {
    installCronJobs(updated);
    process.stdout.write(chalk.green("\nConfiguration saved and cron jobs updated!\n"));
  } else {
    process.stdout.write(chalk.green("\nConfiguration saved.\n"));
  }

  process.stdout.write("\n  New schedule:\n");
  triggerHours.forEach((hour, idx) => {
    const minute = randomMinutes[idx] ?? 0;
    const hourStr = String(hour).padStart(2, "0");
    const minStr = String(minute).padStart(2, "0");
    process.stdout.write(`    [${String(idx + 1)}] ${chalk.cyan(`${hourStr}:${minStr}`)}\n`);
  });
  process.stdout.write("\n");
}
