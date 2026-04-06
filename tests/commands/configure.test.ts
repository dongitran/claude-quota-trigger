import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
  input: vi.fn(),
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
  buildTriggerHours: vi.fn((h: number) => [h, h + 5, h + 10, h + 15]),
  generateRandomMinutes: vi.fn(() => [7, 23, 41, 55]),
}));

vi.mock("../../src/core/scheduler.js", () => ({
  installCronJobs: vi.fn(),
}));

vi.spyOn(process.stdout, "write").mockReturnValue(true);

import { runConfigure } from "../../src/commands/configure.js";
import { saveConfig } from "../../src/core/config.js";
import { installCronJobs } from "../../src/core/scheduler.js";
import { select, input } from "@inquirer/prompts";

describe("runConfigure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(input).mockResolvedValue("");
  });

  it("saves config with the chosen firstTriggerHour", async () => {
    vi.mocked(select).mockResolvedValueOnce(8).mockResolvedValueOnce("sonnet");
    await runConfigure();
    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ firstTriggerHour: 8 }),
    );
  });

  it("saves config with the chosen model", async () => {
    vi.mocked(select).mockResolvedValueOnce(5).mockResolvedValueOnce("sonnet");
    await runConfigure();
    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ model: "sonnet" }),
    );
  });

  it("uses custom model ID when provided instead of dropdown selection", async () => {
    vi.mocked(select).mockResolvedValueOnce(5).mockResolvedValueOnce("haiku");
    vi.mocked(input).mockResolvedValue("claude-custom-v1");
    await runConfigure();
    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-custom-v1" }),
    );
  });

  it("falls back to dropdown model when custom input is blank", async () => {
    vi.mocked(select).mockResolvedValueOnce(5).mockResolvedValueOnce("haiku");
    vi.mocked(input).mockResolvedValue("   ");
    await runConfigure();
    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ model: "haiku" }),
    );
  });

  it("saves config with enabled=true", async () => {
    vi.mocked(select).mockResolvedValueOnce(5).mockResolvedValueOnce("haiku");
    await runConfigure();
    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it("calls installCronJobs after saving", async () => {
    vi.mocked(select).mockResolvedValueOnce(5).mockResolvedValueOnce("haiku");
    await runConfigure();
    expect(installCronJobs).toHaveBeenCalled();
  });

  it("resolves without throwing on success", async () => {
    vi.mocked(select).mockResolvedValueOnce(5).mockResolvedValueOnce("haiku");
    await expect(runConfigure()).resolves.toBeUndefined();
  });
});
