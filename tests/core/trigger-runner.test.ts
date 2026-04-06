import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn((path: unknown) => path === "/opt/homebrew/bin/claude"),
}));

// Mock execFile with callback signature so promisify works normally
vi.mock("node:child_process", () => ({
  execFile: vi.fn(
    (
      _bin: string,
      _args: string[],
      _opts: object,
      cb: (err: null) => void,
    ) => { cb(null); },
  ),
}));

import { findClaudeBin, sendTrigger } from "../../src/core/trigger-runner.js";
import type { CqtConfig } from "../../src/types.js";

const testConfig: CqtConfig = {
  firstTriggerHour: 5,
  triggerHours: [5, 10, 15, 20],
  model: "haiku",
  randomMinutes: [7, 23, 41, 55],
  enabled: true,
};

describe("findClaudeBin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns homebrew path when it exists", () => {
    const bin = findClaudeBin();
    expect(bin).toBe("/opt/homebrew/bin/claude");
  });
});

describe("findClaudeBin fallback", () => {
  it("returns 'claude' as fallback when no candidate exists", async () => {
    vi.resetModules();
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => false),
    }));
    vi.doMock("node:child_process", () => ({
      execFile: vi.fn(
        (_b: string, _a: string[], _o: object, cb: (err: null) => void) => { cb(null); },
      ),
    }));

    const { findClaudeBin: freshFind } = await import(
      "../../src/core/trigger-runner.js"
    );
    expect(freshFind()).toBe("claude");
    vi.doUnmock("node:fs");
    vi.doUnmock("node:child_process");
  });
});

describe("sendTrigger success", () => {
  it("returns success result when execFile succeeds", async () => {
    const result = await sendTrigger(testConfig);
    expect(result.success).toBe(true);
    expect(typeof result.message).toBe("string");
    expect(result.model).toBe("haiku");
  });
});

describe("sendTrigger failure", () => {
  it("returns failure result when execFile throws", async () => {
    vi.resetModules();
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => false),
    }));
    vi.doMock("node:child_process", () => ({
      execFile: vi.fn(
        (_b: string, _a: string[], _o: object, cb: (err: Error) => void) => {
          cb(new Error("command not found"));
        },
      ),
    }));

    const { sendTrigger: freshSend } = await import(
      "../../src/core/trigger-runner.js"
    );
    const result = await freshSend(testConfig);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    vi.doUnmock("node:fs");
    vi.doUnmock("node:child_process");
  });
});
