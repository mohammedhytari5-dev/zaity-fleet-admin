import path from "node:path";
import { mkdirSync } from "node:fs";
import { startVitest } from "vitest/node";

// Keep Vitest worker scratch files inside the project so restricted hosts can
// spawn workers without needing access to a user profile's temp directory.
const testTemp = path.resolve(".vitest-tmp");
mkdirSync(testTemp, { recursive: true });
process.env.TEMP = testTemp;
process.env.TMP = testTemp;
process.env.TMPDIR = testTemp;

// Deterministic environment for every test file. `server/_core/env.ts` derives
// ENV.isProduction and the mock-OAuth switch from NODE_ENV at import time, so
// leaving it unset made behaviour depend on the developer's shell.
process.env.NODE_ENV ??= "test";

const result = await startVitest(
  "test",
  process.argv.slice(2),
  {
    config: false,
    root: process.cwd(),
    run: true,
    watch: false,
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
  },
  {
    resolve: {
      alias: {
        "@": path.resolve("client/src"),
        "@shared": path.resolve("shared"),
        "@assets": path.resolve("attached_assets"),
      },
    },
  },
);
if (!result) process.exitCode = 1;
