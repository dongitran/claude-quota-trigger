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

describe("runSetup — checkClaudeAvailable fallback via which", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not warn when 'which claude' succeeds as fallback", async () => {
    vi.resetModules();

    vi.doMock("../../src/core/config.js", () => ({
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
    vi.doMock("../../src/core/scheduler.js", () => ({ installCronJobs: vi.fn() }));
    vi.doMock("../../src/core/trigger-runner.js", () => ({
      // findClaudeBin returns "claude" → not an absolute path → falls through to `which`
      findClaudeBin: vi.fn(() => "claude"),
    }));
    vi.doMock("node:fs", () => ({ existsSync: vi.fn(() => false) }));
    // execFileSync("which", ...) succeeds silently
    vi.doMock("node:child_process", () => ({ execFileSync: vi.fn() }));
    vi.doMock("ora", () => ({
      default: vi.fn(() => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
      })),
    }));

    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    try {
      const { runSetup: freshSetup } = await import("../../src/commands/setup.js");
      freshSetup(5);
      const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
      expect(output).not.toContain("Warning");
    } finally {
      vi.doUnmock("../../src/core/config.js");
      vi.doUnmock("../../src/core/scheduler.js");
      vi.doUnmock("../../src/core/trigger-runner.js");
      vi.doUnmock("node:fs");
      vi.doUnmock("node:child_process");
      vi.doUnmock("ora");
    }
  });

  it("warns when both bin lookup and 'which' fallback fail", async () => {
    vi.resetModules();

    vi.doMock("../../src/core/config.js", () => ({
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
    vi.doMock("../../src/core/scheduler.js", () => ({ installCronJobs: vi.fn() }));
    vi.doMock("../../src/core/trigger-runner.js", () => ({
      findClaudeBin: vi.fn(() => "claude"),
    }));
    vi.doMock("node:fs", () => ({ existsSync: vi.fn(() => false) }));
    // execFileSync("which", ...) throws — claude not on PATH
    vi.doMock("node:child_process", () => ({
      execFileSync: vi.fn(() => { throw new Error("not found"); }),
    }));
    vi.doMock("ora", () => ({
      default: vi.fn(() => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
      })),
    }));

    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    try {
      const { runSetup: freshSetupFail } = await import("../../src/commands/setup.js");
      freshSetupFail(5);
      const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("Warning");
    } finally {
      vi.doUnmock("../../src/core/config.js");
      vi.doUnmock("../../src/core/scheduler.js");
      vi.doUnmock("../../src/core/trigger-runner.js");
      vi.doUnmock("node:fs");
      vi.doUnmock("node:child_process");
      vi.doUnmock("ora");
    }
  });
});
