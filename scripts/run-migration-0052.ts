import "dotenv/config";
import mysql from "mysql2/promise";
import { getMysqlConnectionOptions } from "../server/db-connection.js";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const connectionUrl = process.env.DATABASE_URL;
  if (!connectionUrl) {
    console.error("No DATABASE_URL");
    process.exit(1);
  }

  const options = getMysqlConnectionOptions(connectionUrl);
  const conn = await mysql.createConnection(options);
  console.log("Connected to MySQL database.");

  const sqlPath = path.resolve(process.cwd(), "drizzle/0052_add_inspections_and_employee_requests.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Running migration 0052 with ${statements.length} statements...`);

  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      console.log("Statement executed successfully.");
    } catch (err: any) {
      console.error("Error executing statement:", err.message);
    }
  }

  await conn.end();
  console.log("Migration 0052 completed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal migration error:", err);
  process.exit(1);
});
