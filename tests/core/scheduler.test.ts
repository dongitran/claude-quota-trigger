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

  it("writes back remaining non-CQT entries instead of calling crontab -r", async () => {
    const childProcess = await import("node:child_process");
    const fs = await import("node:fs");
    const mockedExecSync = vi.mocked(childProcess.execSync);
    const mockedWriteFileSync = vi.mocked(fs.writeFileSync);

    // Crontab has a non-CQT job AND our section
    mockedExecSync.mockImplementationOnce(
      () =>
        "# My backup job\n0 * * * * /usr/bin/backup\n# CQT-BEGIN\nPATH=/usr/bin\n# CQT-END\n",
    );

    const { uninstallCronJobs } = await import("../../src/core/scheduler.js");
    uninstallCronJobs();

    // Should write remaining entries, not nuke the crontab
    expect(mockedWriteFileSync).toHaveBeenCalled();
    const written = mockedWriteFileSync.mock.calls[0]?.[1] as string;
    expect(written).toContain("/usr/bin/backup");
    expect(written).not.toContain("CQT-BEGIN");

    const calls = mockedExecSync.mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c.includes("crontab -r"))).toBe(false);
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

  it("generates cron entries using /usr/bin/env node with quoted runner path", async () => {
    const childProcess = await import("node:child_process");
    const fs = await import("node:fs");
    vi.mocked(childProcess.execSync).mockImplementationOnce(() => "");

    const { installCronJobs } = await import("../../src/core/scheduler.js");
    installCronJobs(baseConfig);

    const written = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string;
    // Each trigger line must use /usr/bin/env node with a quoted runner path
    expect(written).toMatch(/\/usr\/bin\/env node\s+"[^"]+"/u);
    // Must NOT bake an absolute node binary path (versioned paths break on upgrade)
    expect(written).not.toMatch(/"\/.+\/node"\s+"/u);
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

describe("buildCronPath — platform-aware PATH", () => {
  it("includes Linuxbrew path when platform is linux", async () => {
    vi.resetModules();

    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      value: "linux",
      configurable: true,
    });

    vi.doMock("node:child_process", () => ({ execSync: vi.fn(() => "") }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => false),
      writeFileSync: vi.fn(),
      rmSync: vi.fn(),
    }));

    try {
      const { installCronJobs } = await import("../../src/core/scheduler.js");
      const fs = await import("node:fs");
      installCronJobs(baseConfig);

      const written = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string;
      // The PATH= line should use the Linux Homebrew path, not the macOS one
      const pathLine = written.split("\n").find((l) => l.startsWith("PATH=")) ?? "";
      expect(pathLine).toContain("linuxbrew");
      expect(pathLine).not.toContain("/opt/homebrew");
    } finally {
      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        configurable: true,
      });
      vi.doUnmock("node:child_process");
      vi.doUnmock("node:fs");
    }
  });

  it("includes version manager dirs in PATH when they exist", async () => {
    vi.resetModules();

    vi.doMock("node:child_process", () => ({ execSync: vi.fn(() => "") }));
    vi.doMock("node:fs", () => ({
      // Simulate volta and asdf present, fnm absent
      existsSync: vi.fn((p: string) => {
        if (typeof p === "string" && (p.includes("/.volta/bin") || p.includes("/.asdf/shims"))) return true;
        return false;
      }),
      writeFileSync: vi.fn(),
      rmSync: vi.fn(),
    }));

    try {
      const { installCronJobs } = await import("../../src/core/scheduler.js");
      const fs = await import("node:fs");
      installCronJobs(baseConfig);

      const written = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string;
      const pathLine = written.split("\n").find((l) => l.startsWith("PATH=")) ?? "";
      expect(pathLine).toContain(".volta/bin");
      expect(pathLine).toContain(".asdf/shims");
      expect(pathLine).not.toContain(".fnm");
    } finally {
      vi.doUnmock("node:child_process");
      vi.doUnmock("node:fs");
    }
  });
});
