import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
}));

vi.mock("../../src/core/config.js", () => ({
  loadConfig: vi.fn(() => ({
    firstTriggerHour: 5,
    triggerHours: [5, 10, 15, 20],
    model: "haiku",
    randomMinutes: [7, 23, 41, 55],
    enabled: true,
  })),
  saveConfig: vi.fn(),
}));

vi.mock("../../src/core/scheduler.js", () => ({
  uninstallCronJobs: vi.fn(),
}));

vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

vi.spyOn(process.stdout, "write").mockReturnValue(true);

import { runUninstall } from "../../src/commands/uninstall.js";
import { saveConfig } from "../../src/core/config.js";
import { uninstallCronJobs } from "../../src/core/scheduler.js";
import { confirm } from "@inquirer/prompts";

describe("runUninstall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(confirm).mockResolvedValue(true);
  });

  it("calls uninstallCronJobs when user confirms", async () => {
    await runUninstall();
    expect(uninstallCronJobs).toHaveBeenCalled();
  });

  it("saves config with enabled=false after successful uninstall", async () => {
    await runUninstall();
    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it("does not call uninstallCronJobs when user aborts", async () => {
    vi.mocked(confirm).mockResolvedValue(false);
    await runUninstall();
    expect(uninstallCronJobs).not.toHaveBeenCalled();
  });

  it("does not save config when user aborts", async () => {
    vi.mocked(confirm).mockResolvedValue(false);
    await runUninstall();
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it("propagates error when uninstallCronJobs throws", async () => {
    vi.mocked(uninstallCronJobs).mockImplementationOnce(() => {
      throw new Error("crontab: permission denied");
    });
    await expect(runUninstall()).rejects.toThrow("crontab: permission denied");
  });

  it("resolves without throwing on successful uninstall", async () => {
    await expect(runUninstall()).resolves.toBeUndefined();
  });
});
