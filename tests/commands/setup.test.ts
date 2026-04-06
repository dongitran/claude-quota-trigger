import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/core/config.js", () => ({
  loadConfig: vi.fn(() => ({
    firstTriggerHour: 5,
    triggerHours: [5, 10, 15, 20],
    model: "haiku",
    randomMinutes: [],
    enabled: false,
  })),
  saveConfig: vi.fn(),
  buildTriggerHours: vi.fn((h: number) => [h, h + 5, h + 10, h + 15]),
  generateRandomMinutes: vi.fn(() => [7, 23, 41, 55]),
}));

vi.mock("../../src/core/scheduler.js", () => ({
  installCronJobs: vi.fn(),
}));

vi.mock("../../src/core/trigger-runner.js", () => ({
  findClaudeBin: vi.fn(() => "/opt/homebrew/bin/claude"),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => true),
}));

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

// Suppress stdout during tests
vi.spyOn(process.stdout, "write").mockReturnValue(true);

import { runSetup } from "../../src/commands/setup.js";
import { installCronJobs } from "../../src/core/scheduler.js";
import { saveConfig } from "../../src/core/config.js";

describe("runSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves config with enabled=true", () => {
    runSetup(5);
    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it("calls installCronJobs after saving config", () => {
    runSetup(5);
    expect(installCronJobs).toHaveBeenCalled();
  });

  it("saves firstTriggerHour from argument", () => {
    runSetup(8);
    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ firstTriggerHour: 8 }),
    );
  });

  it("uses existing firstTriggerHour when no argument provided", () => {
    runSetup();
    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ firstTriggerHour: 5 }),
    );
  });

  it("throws if installCronJobs fails", () => {
    vi.mocked(installCronJobs).mockImplementationOnce(() => {
      throw new Error("crontab permission denied");
    });
    expect(() => { runSetup(5); }).toThrow("crontab permission denied");
  });
});
