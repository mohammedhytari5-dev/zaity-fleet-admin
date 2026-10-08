import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const env = { ...process.env, NODE_ENV: "production" };
const commands = [
  ["build", "--configLoader", "runner"],
  ["build", "--ssr", "../server/_core/index.ts", "--outDir", "../dist", "--emptyOutDir", "false", "--configLoader", "runner"],
];

for (const args of commands) {
  const result = spawnSync(process.execPath, [viteCli, ...args], {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
