import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TriggerResult } from "../../src/core/trigger-runner.js";

vi.mock("../../src/core/config.js", () => ({
  loadConfig: vi.fn(() => ({
    firstTriggerHour: 5,
    triggerHours: [5, 10, 15, 20],
    model: "haiku",
    randomMinutes: [7, 23, 41, 55],
    enabled: true,
  })),
}));

vi.mock("../../src/core/trigger-runner.js", () => ({
  sendTrigger: vi.fn<() => Promise<TriggerResult>>(),
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

import { runTrigger } from "../../src/commands/trigger.js";
import { sendTrigger } from "../../src/core/trigger-runner.js";
import { loadConfig } from "../../src/core/config.js";

const mockConfig = {
  firstTriggerHour: 5,
  triggerHours: [5, 10, 15, 20],
  model: "haiku",
  randomMinutes: [7, 23, 41, 55],
  enabled: true,
};

describe("runTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue(mockConfig);
  });

  it("calls sendTrigger with the loaded config", async () => {
    vi.mocked(sendTrigger).mockResolvedValue({
      success: true,
      message: "hi",
      model: "haiku",
    });

    await runTrigger();

    expect(sendTrigger).toHaveBeenCalledWith(mockConfig);
  });

  it("resolves without throwing on success", async () => {
    vi.mocked(sendTrigger).mockResolvedValue({
      success: true,
      message: "ok",
      model: "haiku",
    });

    await expect(runTrigger()).resolves.not.toThrow();
  });

  it("resolves without throwing when trigger fails gracefully", async () => {
    vi.mocked(sendTrigger).mockResolvedValue({
      success: false,
      message: "ok",
      model: "haiku",
      error: "command not found",
    });

    await expect(runTrigger()).resolves.not.toThrow();
  });

  it("propagates exceptions from sendTrigger", async () => {
    vi.mocked(sendTrigger).mockRejectedValue(new Error("network timeout"));

    await expect(runTrigger()).rejects.toThrow("network timeout");
  });
});
