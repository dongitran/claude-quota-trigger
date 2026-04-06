import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts", "src/commands/**/*.ts", "src/types.ts"],
      exclude: [],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 55,
        statements: 75,
      },
      reporter: ["text", "lcov"],
    },
  },
});
