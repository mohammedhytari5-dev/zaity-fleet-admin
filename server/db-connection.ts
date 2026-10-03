export type MysqlConnectionOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: { rejectUnauthorized: boolean };
};

/**
 * mysql2 does not understand the MySQL CLI-style `ssl-mode` URL parameter.
 * Translate it into the explicit TLS options expected by mysql2 so REQUIRED
 * never silently falls back to a plaintext connection.
 */
export function getMysqlConnectionOptions(connectionString: string): MysqlConnectionOptions {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("ssl-mode")?.toUpperCase();

  let ssl: MysqlConnectionOptions["ssl"];
  if (sslMode === "REQUIRED") {
    // REQUIRED encrypts transport without verifying the server certificate,
    // matching the semantics of the supplied MySQL URL.
    ssl = { rejectUnauthorized: false };
  } else if (sslMode === "VERIFY_CA" || sslMode === "VERIFY_IDENTITY") {
    ssl = { rejectUnauthorized: true };
  } else if (sslMode && sslMode !== "DISABLED") {
    throw new Error(`Unsupported MySQL ssl-mode: ${sslMode}`);
  }

  return {
    host: decodeURIComponent(url.hostname),
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ...(ssl ? { ssl } : {}),
  };
}
