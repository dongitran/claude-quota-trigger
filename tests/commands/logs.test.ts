import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/core/config.js", () => ({
  getLogPath: vi.fn(() => "/fake/path/trigger.log"),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => ""),
}));

// Suppress stdout during tests
vi.spyOn(process.stdout, "write").mockReturnValue(true);

import { runLogs } from "../../src/commands/logs.js";
import { existsSync, readFileSync } from "node:fs";

const SAMPLE_LOG = [
  "[2026-04-06T05:07:00.000Z] Trigger OK — model=haiku message=\"hi\"",
  "[2026-04-06T05:07:00.100Z] Trigger FAILED — command not found",
  "[2026-04-06T05:07:00.200Z] Regenerated random minutes: [7, 23, 41, 55]",
  "[2026-04-06T05:07:00.300Z] Trigger skipped: cqt is disabled",
].join("\n");

describe("runLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(SAMPLE_LOG);
  });

  it("calls existsSync to check log file", () => {
    runLogs();
    expect(existsSync).toHaveBeenCalledWith("/fake/path/trigger.log");
  });

  it("calls readFileSync when log exists", () => {
    runLogs();
    expect(readFileSync).toHaveBeenCalledWith("/fake/path/trigger.log", "utf-8");
  });

  it("does not call readFileSync when log does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    runLogs();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("does not throw with valid log content", () => {
    expect(() => { runLogs(); }).not.toThrow();
  });

  it("does not throw when log file is missing", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(() => { runLogs(); }).not.toThrow();
  });

  it("does not throw with empty log file", () => {
    vi.mocked(readFileSync).mockReturnValue("");
    expect(() => { runLogs(); }).not.toThrow();
  });

  it("does not throw regardless of lines parameter", () => {
    const manyLines = Array.from({ length: 10 }, (_, i) =>
      `[2026-04-06T05:07:${String(i).padStart(2, "0")}.000Z] Trigger OK — model=haiku message="hi"`,
    ).join("\n");
    vi.mocked(readFileSync).mockReturnValue(manyLines);
    expect(() => { runLogs(3); }).not.toThrow();
    expect(() => { runLogs(100); }).not.toThrow();
  });
});
