import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CqtConfig, ScheduleStatus } from "../../src/types.js";

vi.mock("../../src/core/config.js", () => ({
  loadConfig: vi.fn(() => ({
    firstTriggerHour: 5,
    triggerHours: [5, 10, 15, 20],
    model: "haiku",
    randomMinutes: [7, 23, 41, 55],
    enabled: true,
  })),
}));

vi.mock("../../src/core/scheduler.js", () => ({
  getScheduleStatus: vi.fn(() => ({
    enabled: true,
    entries: [
      { hour: 5, minute: 7 },
      { hour: 10, minute: 23 },
      { hour: 15, minute: 41 },
      { hour: 20, minute: 55 },
    ],
    nextTrigger: { hour: 10, minute: 23 },
  })),
}));

// Suppress stdout during tests
vi.spyOn(process.stdout, "write").mockReturnValue(true);

import { runStatus } from "../../src/commands/status.js";
import { loadConfig } from "../../src/core/config.js";
import { getScheduleStatus } from "../../src/core/scheduler.js";

const enabledConfig: CqtConfig = {
  firstTriggerHour: 5,
  triggerHours: [5, 10, 15, 20],
  model: "haiku",
  randomMinutes: [7, 23, 41, 55],
  enabled: true,
};

const disabledConfig: CqtConfig = { ...enabledConfig, enabled: false, randomMinutes: [] };

describe("runStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue(enabledConfig);
    vi.mocked(getScheduleStatus).mockReturnValue({
      enabled: true,
      entries: [
        { hour: 5, minute: 7 },
        { hour: 10, minute: 23 },
        { hour: 15, minute: 41 },
        { hour: 20, minute: 55 },
      ],
      nextTrigger: { hour: 10, minute: 23 },
    });
  });

  it("calls loadConfig", () => {
    runStatus();
    expect(loadConfig).toHaveBeenCalled();
  });

  it("calls getScheduleStatus with loaded config", () => {
    runStatus();
    expect(getScheduleStatus).toHaveBeenCalledWith(enabledConfig);
  });

  it("calls getScheduleStatus even when config is disabled", () => {
    vi.mocked(loadConfig).mockReturnValue(disabledConfig);
    vi.mocked(getScheduleStatus).mockReturnValue({
      enabled: false,
      entries: [],
      nextTrigger: null,
    } as ScheduleStatus);
    runStatus();
    expect(getScheduleStatus).toHaveBeenCalledWith(disabledConfig);
  });

  it("does not throw when nextTrigger is null", () => {
    vi.mocked(getScheduleStatus).mockReturnValue({
      enabled: true,
      entries: [{ hour: 5, minute: 7 }],
      nextTrigger: null,
    } as ScheduleStatus);
    expect(() => { runStatus(); }).not.toThrow();
  });

  it("does not throw when schedule is empty and disabled", () => {
    vi.mocked(getScheduleStatus).mockReturnValue({
      enabled: false,
      entries: [],
      nextTrigger: null,
    } as ScheduleStatus);
    expect(() => { runStatus(); }).not.toThrow();
  });
});
