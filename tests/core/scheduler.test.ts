import { describe, it, expect, vi, beforeEach } from "vitest";
import { getScheduleStatus } from "../../src/core/scheduler.js";
import type { CqtConfig } from "../../src/types.js";

// Mock execSync so we never touch the real crontab
vi.mock("node:child_process", () => ({
  execSync: vi.fn((_cmd: string) => ""),
}));

// Mock fs to avoid real filesystem operations
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
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
    // Wraps to entries[0] when none are in the future
    expect(status.nextTrigger).not.toBeNull();
  });

  it("nextTriggerIsNextDay is true when all triggers have passed", () => {
    const config: CqtConfig = {
      ...baseConfig,
      triggerHours: [0, 1, 2, 3],
      randomMinutes: [1, 1, 1, 1],
    };
    const status = getScheduleStatus(config);
    expect(status.nextTriggerIsNextDay).toBe(true);
  });

  it("nextTriggerIsNextDay is false when a future trigger exists today", () => {
    // Use a config with triggers far in the future (hour 23) to guarantee one is upcoming
    const config: CqtConfig = {
      ...baseConfig,
      triggerHours: [23, 0, 1, 2],
      randomMinutes: [59, 1, 1, 1],
    };
    const now = new Date();
    // Only run assertion if current hour is before 23
    if (now.getHours() < 23) {
      const status = getScheduleStatus(config);
      expect(status.nextTriggerIsNextDay).toBe(false);
    }
  });

  it("nextTriggerIsNextDay is false when disabled", () => {
    const config: CqtConfig = { ...baseConfig, enabled: false };
    const status = getScheduleStatus(config);
    expect(status.nextTriggerIsNextDay).toBe(false);
  });
});

describe("installCronJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes to a temp file and calls crontab", async () => {
    const childProcess = await import("node:child_process");
    const mockedExecSync = vi.mocked(childProcess.execSync);
    mockedExecSync.mockImplementation((_cmd: string) => "");

    const fs = await import("node:fs");
    const mockedWriteFileSync = vi.mocked(fs.writeFileSync);

    const { installCronJobs } = await import("../../src/core/scheduler.js");
    installCronJobs(baseConfig);

    // Should write to a temp file (not use echo pipe)
    expect(mockedWriteFileSync).toHaveBeenCalled();
    // And then call crontab with the temp file
    expect(mockedExecSync).toHaveBeenCalledWith(
      expect.stringMatching(/^crontab /u),
      expect.any(Object),
    );
  });

  it("cleans up temp file even if crontab fails", async () => {
    const childProcess = await import("node:child_process");
    const mockedExecSync = vi.mocked(childProcess.execSync);
    // First call (crontab -l read) returns ""
    // Second call (crontab <file>) throws
    mockedExecSync
      .mockImplementationOnce(() => "")
      .mockImplementationOnce(() => { throw new Error("crontab failed"); });

    const fs = await import("node:fs");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const mockedRmSync = vi.mocked(fs.rmSync);

    const { installCronJobs } = await import("../../src/core/scheduler.js");
    expect(() => { installCronJobs(baseConfig); }).toThrow("crontab failed");

    // Temp file must be cleaned up regardless of error
    expect(mockedRmSync).toHaveBeenCalled();
  });
});

describe("uninstallCronJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls execSync when uninstalling", async () => {
    const childProcess = await import("node:child_process");
    const mockedExecSync = vi.mocked(childProcess.execSync);
    mockedExecSync.mockImplementation((_cmd: string) => "");

    const { uninstallCronJobs } = await import("../../src/core/scheduler.js");
    uninstallCronJobs();

    expect(mockedExecSync).toHaveBeenCalled();
  });

  it("calls crontab -r when no entries remain after stripping", async () => {
    const childProcess = await import("node:child_process");
    const mockedExecSync = vi.mocked(childProcess.execSync);
    // Return a crontab that is ONLY CQT section
    mockedExecSync.mockImplementationOnce(() =>
      "# CQT-BEGIN\nPATH=/usr/bin\n7 5 * * * node runner.js\n# CQT-END\n",
    );

    const { uninstallCronJobs } = await import("../../src/core/scheduler.js");
    uninstallCronJobs();

    const calls = mockedExecSync.mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c.includes("crontab -r"))).toBe(true);
  });
});

describe("stripCqtSection (via installCronJobs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes existing CQT section so there is exactly one after reinstall", async () => {
    const childProcess = await import("node:child_process");
    const fs = await import("node:fs");
    const mockedExecSync = vi.mocked(childProcess.execSync);
    const mockedWriteFileSync = vi.mocked(fs.writeFileSync);

    mockedExecSync.mockImplementationOnce(
      () => "# CQT-BEGIN\nPATH=/usr/bin\n# CQT-END\n",
    );

    const { installCronJobs } = await import("../../src/core/scheduler.js");
    installCronJobs(baseConfig);

    const written = mockedWriteFileSync.mock.calls[0]?.[1] as string;
    const beginCount = (written.match(/# CQT-BEGIN/gu) ?? []).length;
    expect(beginCount).toBe(1);
  });

  it("preserves non-CQT crontab entries", async () => {
    const childProcess = await import("node:child_process");
    const fs = await import("node:fs");
    const mockedExecSync = vi.mocked(childProcess.execSync);
    const mockedWriteFileSync = vi.mocked(fs.writeFileSync);

    mockedExecSync.mockImplementationOnce(
      () =>
        "# My backup job\n0 * * * * /usr/bin/backup\n# CQT-BEGIN\nPATH=/usr/bin\n# CQT-END\n",
    );

    const { installCronJobs } = await import("../../src/core/scheduler.js");
    installCronJobs(baseConfig);

    const written = mockedWriteFileSync.mock.calls[0]?.[1] as string;
    expect(written).toContain("/usr/bin/backup");
  });

  it("generates cron entries with quoted node and runner paths", async () => {
    const childProcess = await import("node:child_process");
    const fs = await import("node:fs");
    vi.mocked(childProcess.execSync).mockImplementationOnce(() => "");

    const { installCronJobs } = await import("../../src/core/scheduler.js");
    installCronJobs(baseConfig);

    const written = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string;
    // Each trigger line must quote both the node and runner paths
    expect(written).toMatch(/"[^"]+"\s+"[^"]+"/u);
  });

  it("includes midnight regeneration job in cron section", async () => {
    const childProcess = await import("node:child_process");
    const fs = await import("node:fs");
    vi.mocked(childProcess.execSync).mockImplementationOnce(() => "");

    const { installCronJobs } = await import("../../src/core/scheduler.js");
    installCronJobs(baseConfig);

    const written = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string;
    expect(written).toContain("--regenerate");
    expect(written).toMatch(/^0 0 \* \* \*/mu);
  });
});
