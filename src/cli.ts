#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { runSetup } from "./commands/setup.js";
import { runStatus } from "./commands/status.js";
import { runConfigure } from "./commands/configure.js";
import { runTrigger } from "./commands/trigger.js";
import { runUninstall } from "./commands/uninstall.js";
import { runLogs } from "./commands/logs.js";

// Node 20-compatible __dirname (import.meta.dirname is Node 21.2+)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Reads version from package.json at runtime so it's always in sync.
 */
function getVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

const VERSION = getVersion();

function printBanner(): void {
  process.stdout.write(
    chalk.bold.cyan("\n  CQT") +
      chalk.dim(" — Claude Quota Trigger") +
      chalk.dim(`  v${VERSION}\n\n`),
  );
}

async function runInteractiveMenu(): Promise<void> {
  printBanner();
  runStatus();

  const action = await select({
    message: "What would you like to do?",
    choices: [
      { name: "Setup cron jobs (install/refresh)", value: "setup" },
      { name: "View trigger history (logs)", value: "logs" },
      { name: "Configure settings", value: "configure" },
      { name: "Trigger now (manual)", value: "trigger" },
      { name: "Uninstall cron jobs", value: "uninstall" },
      { name: "Exit", value: "exit" },
    ],
  });

  switch (action) {
    case "setup":
      runSetup();
      break;
    case "logs":
      runLogs();
      break;
    case "configure":
      await runConfigure();
      break;
    case "trigger":
      await runTrigger();
      break;
    case "uninstall":
      await runUninstall();
      break;
    case "exit":
      break;
    default:
      break;
  }
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("cqt")
    .description("Claude Quota Trigger — auto-start your Claude Pro quota windows")
    .version(VERSION);

  program
    .command("setup")
    .description("Install cron jobs with default or specified first trigger hour")
    .option(
      "--first-hour <hour>",
      "First trigger hour (0-23, others auto +5h)",
      "5",
    )
    .action((opts: { firstHour: string }) => {
      const hour = parseInt(opts.firstHour, 10);
      if (isNaN(hour) || hour < 0 || hour > 23) {
        process.stderr.write(chalk.red("  Error: --first-hour must be 0-23\n"));
        process.exit(1);
      }
      runSetup(hour);
    });

  program
    .command("status")
    .description("Show current schedule and next trigger time")
    .action(() => {
      runStatus();
    });

  program
    .command("configure")
    .description("Interactively configure trigger times and model")
    .action(async () => {
      await runConfigure();
    });

  program
    .command("trigger")
    .description("Manually send a trigger message to Claude now")
    .action(async () => {
      await runTrigger();
    });

  program
    .command("logs")
    .description("View recent trigger history")
    .option("-n, --lines <count>", "Number of lines to show", "20")
    .action((opts: { lines: string }) => {
      const count = parseInt(opts.lines, 10);
      runLogs(isNaN(count) || count < 1 ? 20 : count);
    });

  program
    .command("uninstall")
    .description("Remove all CQT cron jobs")
    .action(async () => {
      await runUninstall();
    });

  // No subcommand → interactive menu
  if (process.argv.length <= 2) {
    await runInteractiveMenu();
    return;
  }

  await program.parseAsync(process.argv);
}

await main();
