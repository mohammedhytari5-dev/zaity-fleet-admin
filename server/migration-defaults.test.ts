import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards against silent default loss during column type changes.
 *
 * MySQL's `ALTER TABLE ... MODIFY COLUMN` replaces the entire column definition:
 * any attribute not restated - including DEFAULT - is dropped. drizzle-kit emits
 * `MODIFY COLUMN x decimal(15,2) NOT NULL` for a pure widening change without
 * repeating `DEFAULT 0`, so the default disappears from the database while the
 * snapshot still records it. `generate` then reports "no schema changes" and the
 * divergence stays invisible.
 *
 * These checks are static, so they run without a database.
 */

const drizzleDir = path.resolve(import.meta.dirname, "..", "drizzle");
const schemaPath = path.join(drizzleDir, "schema.ts");

type ColumnDefaults = Map<string, boolean>; // "table.column" -> declares a default

/** Reads which columns declare a default, per table, from schema.ts. */
function readSchemaDefaults(): ColumnDefaults {
  const source = readFileSync(schemaPath, "utf8");
  const defaults: ColumnDefaults = new Map();

  // Table declarations appear in two shapes:
  //   mysqlTable("name", { ... })            and
  //   mysqlTable(\n  "name",\n  { ... })
  // Matching against the whole file lets `\s*` span the newline.
  const declarations = [...source.matchAll(/mysqlTable\(\s*"(\w+)"/g)];
  declarations.forEach((declaration, index) => {
    const table = declaration[1]!;
    const start = declaration.index! + declaration[0].length;
    const end = index + 1 < declarations.length ? declarations[index + 1]!.index! : source.length;
    const body = source.slice(start, end);
    // Column definitions end where the table's extras array begins.
    const columnsBody = body.split(/^\s*table\s*=>/m)[0]!;

    // A column definition can span several lines (prettier wraps the decimal
    // config), and `.default(...)` may sit on a continuation line, so each
    // definition is accumulated until the next column begins.
    let columnName: string | null = null;
    let buffer = "";
    const flush = () => {
      if (columnName) defaults.set(`${table}.${columnName}`, buffer.includes(".default("));
      columnName = null;
      buffer = "";
    };
    for (const line of columnsBody.split("\n")) {
      const columnMatch = /^\s*(\w+):\s*(?:int|decimal|varchar|text|mediumtext|timestamp|mysqlEnum)\("(\w+)"/.exec(line);
      if (columnMatch) {
        flush();
        columnName = columnMatch[2]!;
        buffer = line;
        continue;
      }
      if (columnName) buffer += `\n${line}`;
    }
    flush();
  });
  return defaults;
}

function migrationFiles(): string[] {
  return readdirSync(drizzleDir)
    .filter(name => name.endsWith(".sql"))
    .sort();
}

describe("column defaults survive type changes", () => {
  const defaults = readSchemaDefaults();

  it("finds the schema defaults it needs to compare against", () => {
    expect(defaults.size).toBeGreaterThan(20);
    expect(defaults.get("claims.amount")).toBe(true);
    expect(defaults.get("payable_payments.amount")).toBe(false);
  });

  it("restates DEFAULT on every MODIFY COLUMN whose schema declares one", () => {
    const violations: string[] = [];

    for (const file of migrationFiles()) {
      const sql = readFileSync(path.join(drizzleDir, file), "utf8");
      for (const line of sql.split("\n")) {
        if (line.trimStart().startsWith("--")) continue;
        const match = /ALTER TABLE `(\w+)` MODIFY COLUMN `(\w+)` ([^;]*)/.exec(line);
        if (!match) continue;
        const [, table, column, definition] = match;
        const key = `${table}.${column}`;
        // Only columns the schema still declares a default for must keep it.
        if (defaults.get(key) === true && !/DEFAULT/i.test(definition!)) {
          violations.push(`${file}: ${key} loses its DEFAULT (definition: ${definition!.trim()})`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("never drops or truncates data in a migration", () => {
    // Destructive statements must be a deliberate, reviewed change rather than
    // something a generator slipped in.
    const allowed = new Set([
      // 0021 intentionally replaced a unique index with a generated column.
      "0021_archived_plate_reuse.sql",
    ]);
    const violations: string[] = [];

    for (const file of migrationFiles()) {
      if (allowed.has(file)) continue;
      const sql = readFileSync(path.join(drizzleDir, file), "utf8");
      for (const line of sql.split("\n")) {
        if (line.trimStart().startsWith("--")) continue;
        if (/\b(DROP\s+TABLE|TRUNCATE|DROP\s+COLUMN|DROP\s+DATABASE)\b/i.test(line)) {
          violations.push(`${file}: ${line.trim().slice(0, 100)}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("has a schema file to compare against", () => {
    expect(existsSync(schemaPath)).toBe(true);
  });
});
