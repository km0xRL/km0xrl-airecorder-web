import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/._*"],
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd()),
    },
  },
});
