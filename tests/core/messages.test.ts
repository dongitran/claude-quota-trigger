import { describe, it, expect } from "vitest";
import { TRIGGER_MESSAGES, getRandomMessage } from "../../src/core/messages.js";

describe("TRIGGER_MESSAGES", () => {
  it("should have exactly 100 messages", () => {
    expect(TRIGGER_MESSAGES).toHaveLength(100);
  });

  it("every message should have fewer than 10 words", () => {
    for (const msg of TRIGGER_MESSAGES) {
      const wordCount = msg.trim().split(/\s+/).length;
      expect(wordCount, `"${msg}" has ${String(wordCount)} words`).toBeLessThan(10);
    }
  });

  it("every message should be a non-empty string", () => {
    for (const msg of TRIGGER_MESSAGES) {
      expect(typeof msg).toBe("string");
      expect(msg.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("getRandomMessage", () => {
  it("returns a string from the list", () => {
    const msg = getRandomMessage();
    expect(typeof msg).toBe("string");
    expect(TRIGGER_MESSAGES).toContain(msg);
  });

  it("returns different messages over multiple calls (probabilistic)", () => {
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(getRandomMessage());
    }
    // With 100 messages and 50 calls, we should see at least 10 unique messages
    expect(results.size).toBeGreaterThan(10);
  });
});
