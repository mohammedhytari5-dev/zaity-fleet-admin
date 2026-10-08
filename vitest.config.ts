import { defineConfig } from "vitest/config";
import path from "path";

// Vitest bundles TypeScript configs into a temporary directory before loading.
// Using import.meta.dirname here can therefore resolve outside the project.
const templateRoot = path.resolve(process.cwd());

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
  },
});
