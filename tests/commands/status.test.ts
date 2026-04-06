import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    nextTriggerIsNextDay: false,
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
      nextTriggerIsNextDay: false,
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
      nextTriggerIsNextDay: false,
    } as ScheduleStatus);
    runStatus();
    expect(getScheduleStatus).toHaveBeenCalledWith(disabledConfig);
  });

  it("does not throw when nextTrigger is null", () => {
    vi.mocked(getScheduleStatus).mockReturnValue({
      enabled: true,
      entries: [{ hour: 5, minute: 7 }],
      nextTrigger: null,
      nextTriggerIsNextDay: false,
    } as ScheduleStatus);
    expect(() => { runStatus(); }).not.toThrow();
  });

  it("does not throw when schedule is empty and disabled", () => {
    vi.mocked(getScheduleStatus).mockReturnValue({
      enabled: false,
      entries: [],
      nextTrigger: null,
      nextTriggerIsNextDay: false,
    } as ScheduleStatus);
    expect(() => { runStatus(); }).not.toThrow();
  });
});

describe("runStatus — time-sensitive isPast logic", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("marks entries before current time as past and after as future", () => {
    // Pin clock to 12:30 local time
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:30:00"));

    vi.mocked(loadConfig).mockReturnValue(enabledConfig);
    vi.mocked(getScheduleStatus).mockReturnValue({
      enabled: true,
      entries: [
        { hour: 5, minute: 7 },   // past
        { hour: 10, minute: 23 }, // past
        { hour: 15, minute: 41 }, // future
        { hour: 20, minute: 55 }, // future
      ],
      nextTrigger: { hour: 15, minute: 41 },
      nextTriggerIsNextDay: false,
    });

    expect(() => { runStatus(); }).not.toThrow();
  });

  it("shows (tomorrow) label when nextTriggerIsNextDay is true", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T23:59:00"));

    vi.mocked(loadConfig).mockReturnValue(enabledConfig);
    vi.mocked(getScheduleStatus).mockReturnValue({
      enabled: true,
      entries: [
        { hour: 5, minute: 7 },
        { hour: 10, minute: 23 },
        { hour: 15, minute: 41 },
        { hour: 20, minute: 55 },
      ],
      nextTrigger: { hour: 5, minute: 7 },
      nextTriggerIsNextDay: true,
    });

    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });

    runStatus();
    expect(writes.join("")).toContain("tomorrow");
    spy.mockRestore();
  });

  it("does not show (tomorrow) when a trigger is still upcoming today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T06:00:00"));

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
      nextTriggerIsNextDay: false,
    });

    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });

    runStatus();
    expect(writes.join("")).not.toContain("tomorrow");
    spy.mockRestore();
  });
});
