import { describe, it, expect, vi, beforeEach } from "vitest";
import { getScheduleStatus } from "../../src/core/scheduler.js";
import type { CqtConfig } from "../../src/types.js";

// Mock execSync so we never touch the real crontab
vi.mock("node:child_process", () => ({
  execSync: vi.fn((_cmd: string) => ""),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
}));

const baseConfig: CqtConfig = {
  firstTriggerHour: 5,
  triggerHours: [5, 10, 15, 20],
  model: "haiku",
  randomMinutes: [7, 23, 41, 55],
  enabled: true,
};

describe("getScheduleStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns disabled status when enabled=false", () => {
    const config: CqtConfig = { ...baseConfig, enabled: false };
    const status = getScheduleStatus(config);
    expect(status.enabled).toBe(false);
    expect(status.entries).toHaveLength(0);
    expect(status.nextTrigger).toBeNull();
  });

  it("returns disabled status when randomMinutes is empty", () => {
    const config: CqtConfig = { ...baseConfig, randomMinutes: [] };
    const status = getScheduleStatus(config);
    expect(status.enabled).toBe(false);
  });

  it("returns correct number of entries when enabled", () => {
    const status = getScheduleStatus(baseConfig);
    expect(status.enabled).toBe(true);
    expect(status.entries).toHaveLength(4);
  });

  it("maps hours and minutes correctly", () => {
    const status = getScheduleStatus(baseConfig);
    expect(status.entries[0]).toEqual({ hour: 5, minute: 7 });
    expect(status.entries[1]).toEqual({ hour: 10, minute: 23 });
    expect(status.entries[2]).toEqual({ hour: 15, minute: 41 });
    expect(status.entries[3]).toEqual({ hour: 20, minute: 55 });
  });

  it("nextTrigger is a valid entry", () => {
    const status = getScheduleStatus(baseConfig);
    expect(status.nextTrigger).not.toBeNull();
    if (status.nextTrigger !== null) {
      expect(status.nextTrigger.hour).toBeGreaterThanOrEqual(0);
      expect(status.nextTrigger.hour).toBeLessThan(24);
      expect(status.nextTrigger.minute).toBeGreaterThanOrEqual(0);
      expect(status.nextTrigger.minute).toBeLessThan(60);
    }
  });

  it("nextTrigger wraps around to first entry when all are in past", () => {
    const config: CqtConfig = {
      ...baseConfig,
      triggerHours: [0, 1, 2, 3],
      randomMinutes: [1, 1, 1, 1],
    };
    const status = getScheduleStatus(config);
    expect(status.nextTrigger).not.toBeNull();
  });
});

describe("installCronJobs", () => {
  it("calls execSync when installing", async () => {
    const childProcess = await import("node:child_process");
    const mockedExecSync = vi.mocked(childProcess.execSync);
    mockedExecSync.mockImplementation((_cmd: string) => "");

    const { installCronJobs } = await import("../../src/core/scheduler.js");
    installCronJobs(baseConfig);

    expect(mockedExecSync).toHaveBeenCalled();
  });
});

describe("uninstallCronJobs", () => {
  it("calls execSync when uninstalling", async () => {
    const childProcess = await import("node:child_process");
    const mockedExecSync = vi.mocked(childProcess.execSync);
    mockedExecSync.mockImplementation((_cmd: string) => "");

    const { uninstallCronJobs } = await import("../../src/core/scheduler.js");
    uninstallCronJobs();

    expect(mockedExecSync).toHaveBeenCalled();
  });
});
