import type { Express } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { getStoredFilePermissions } from "../db";
import { isSafeFileReference } from "./fileReferences";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    let user: Awaited<ReturnType<typeof sdk.authenticateRequest>>;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).send("Authentication required");
      return;
    }

    const key = (req.params as Record<string, string>)[0];
    if (!key || !isSafeFileReference(`/manus-storage/${key}`)) {
      res.status(404).send("File not found");
      return;
    }
    let requiredPermissions: string[] | null;
    try {
      requiredPermissions = await getStoredFilePermissions(key);
    } catch (error) {
      console.error("[StorageProxy] permission lookup failed:", error);
      res.status(503).send("File authorization unavailable");
      return;
    }
    if (requiredPermissions === null) {
      res.status(503).send("File authorization unavailable");
      return;
    }
    if (!requiredPermissions.length) {
      res.status(404).send("File not found");
      return;
    }
    let permissions: string[] = [];
    try { permissions = JSON.parse(user.permissions || "[]"); } catch { permissions = []; }
    if (user.role !== "admin" && !requiredPermissions.every(permission => permissions.includes(permission))) {
      res.status(403).send("Insufficient permissions");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
