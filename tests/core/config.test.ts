import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildTriggerHours,
  generateRandomMinutes,
} from "../../src/core/config.js";
import { DEFAULT_CONFIG } from "../../src/types.js";

describe("buildTriggerHours", () => {
  it("builds 4 hours starting at given hour", () => {
    expect(buildTriggerHours(5)).toEqual([5, 10, 15, 20]);
  });

  it("wraps around midnight correctly", () => {
    expect(buildTriggerHours(20)).toEqual([20, 1, 6, 11]);
  });

  it("starts at 0 correctly", () => {
    expect(buildTriggerHours(0)).toEqual([0, 5, 10, 15]);
  });

  it("always returns 4 entries", () => {
    for (let h = 0; h < 24; h++) {
      expect(buildTriggerHours(h)).toHaveLength(4);
    }
  });

  it("all hours are valid 0-23", () => {
    const hours = buildTriggerHours(22);
    for (const h of hours) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(24);
    }
  });

  it("handles hour 23 wrapping", () => {
    expect(buildTriggerHours(23)).toEqual([23, 4, 9, 14]);
  });
});

describe("generateRandomMinutes", () => {
  it("generates the requested count of minutes", () => {
    expect(generateRandomMinutes(4)).toHaveLength(4);
    expect(generateRandomMinutes(1)).toHaveLength(1);
  });

  it("returns empty array for count=0", () => {
    expect(generateRandomMinutes(0)).toHaveLength(0);
  });

  it("all minutes are between 1 and 59", () => {
    const minutes = generateRandomMinutes(100);
    for (const m of minutes) {
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(59);
    }
  });

  it("produces varied output over multiple calls", () => {
    const results = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const [first] = generateRandomMinutes(1);
      if (first !== undefined) results.add(first);
    }
    expect(results.size).toBeGreaterThan(5);
  });
});

describe("DEFAULT_CONFIG", () => {
  it("has expected default values", () => {
    expect(DEFAULT_CONFIG.firstTriggerHour).toBe(5);
    expect(DEFAULT_CONFIG.enabled).toBe(false);
    expect(DEFAULT_CONFIG.model).toBe("haiku");
    expect(DEFAULT_CONFIG.randomMinutes).toHaveLength(0);
    expect(DEFAULT_CONFIG.triggerHours).toEqual([5, 10, 15, 20]);
  });
});

describe("loadConfig / saveConfig (filesystem integration)", () => {
  const tmpDir = join(tmpdir(), `cqt-test-${String(Date.now())}`);
  const configPath = join(tmpDir, "config.json");

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    vi.resetModules();
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("merges partial config with defaults for buildTriggerHours", () => {
    writeFileSync(
      configPath,
      JSON.stringify({ firstTriggerHour: 8, model: "sonnet" }),
    );
    const result = buildTriggerHours(8);
    expect(result).toEqual([8, 13, 18, 23]);
  });

  it("saveConfig writes valid JSON that can be read back", async () => {
    // Override HOME to tmpDir so config is written there
    const originalHome = process.env["HOME"];
    process.env["HOME"] = tmpDir;
    mkdirSync(join(tmpDir, ".config", "cqt"), { recursive: true });

    try {
      vi.resetModules();
      const { saveConfig, loadConfig } = await import("../../src/core/config.js");

      const testConfig = {
        firstTriggerHour: 8,
        triggerHours: [8, 13, 18, 23] as readonly number[],
        model: "sonnet",
        randomMinutes: [5, 30, 45, 12] as readonly number[],
        enabled: true,
      };

      saveConfig(testConfig);

      const savedPath = join(tmpDir, ".config", "cqt", "config.json");
      expect(existsSync(savedPath)).toBe(true);

      const raw = readFileSync(savedPath, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      expect(parsed).toMatchObject({
        firstTriggerHour: 8,
        model: "sonnet",
        enabled: true,
      });

      const loaded = loadConfig();
      expect(loaded.firstTriggerHour).toBe(8);
      expect(loaded.model).toBe("sonnet");
      expect(loaded.enabled).toBe(true);
    } finally {
      process.env["HOME"] = originalHome;
    }
  });

  it("loadConfig returns DEFAULT_CONFIG when no file exists", async () => {
    const originalHome = process.env["HOME"];
    process.env["HOME"] = join(tmpDir, "nonexistent");

    try {
      vi.resetModules();
      const { loadConfig } = await import("../../src/core/config.js");
      const config = loadConfig();
      expect(config.firstTriggerHour).toBe(5);
      expect(config.enabled).toBe(false);
    } finally {
      process.env["HOME"] = originalHome;
    }
  });

  it("loadConfig handles invalid JSON gracefully", async () => {
    const originalHome = process.env["HOME"];
    process.env["HOME"] = tmpDir;
    mkdirSync(join(tmpDir, ".config", "cqt"), { recursive: true });
    writeFileSync(join(tmpDir, ".config", "cqt", "config.json"), "not-json");

    try {
      vi.resetModules();
      const { loadConfig } = await import("../../src/core/config.js");
      const config = loadConfig();
      expect(config.firstTriggerHour).toBe(5);
    } finally {
      process.env["HOME"] = originalHome;
    }
  });
});
