import { existsSync, readFileSync } from "node:fs";
import chalk from "chalk";
import { getLogPath } from "../core/config.js";

const DEFAULT_LINES = 20;

/**
 * Formats a raw log line with color coding based on outcome.
 */
function formatLogLine(line: string): string {
  if (line.includes("Trigger OK")) {
    return chalk.green("  ✓ ") + chalk.dim(line);
  }
  if (line.includes("Trigger FAILED")) {
    return chalk.red("  ✗ ") + line;
  }
  if (line.includes("Regenerated")) {
    return chalk.blue("  ↻ ") + chalk.dim(line);
  }
  if (line.includes("skipped") || line.includes("disabled")) {
    return chalk.yellow("  ⊘ ") + chalk.dim(line);
  }
  return chalk.dim("  · ") + chalk.dim(line);
}

export function runLogs(lines: number = DEFAULT_LINES): void {
  const logPath = getLogPath();

  if (!existsSync(logPath)) {
    process.stdout.write(
      chalk.dim("  No log file yet. Run `cqt setup` then wait for the first trigger.\n\n"),
    );
    return;
  }

  const content = readFileSync(logPath, "utf-8").trim();
  if (content.length === 0) {
    process.stdout.write(chalk.dim("  Log file is empty.\n\n"));
    return;
  }

  const allLines = content.split("\n");
  const recent = allLines.slice(-lines);
  const showing = Math.min(lines, allLines.length);

  process.stdout.write(
    chalk.bold(`\nRecent Triggers`) +
      chalk.dim(` (showing ${String(showing)} of ${String(allLines.length)} entries)\n`),
  );
  process.stdout.write("────────────────────────────────────────────\n");

  for (const line of recent) {
    process.stdout.write(formatLogLine(line) + "\n");
  }

  process.stdout.write(chalk.dim(`\n  Log: ${logPath}\n\n`));
}
