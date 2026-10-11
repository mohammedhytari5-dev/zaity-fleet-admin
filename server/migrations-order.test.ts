import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the migration chain against the class of defect that made this
 * project's database unreproducible: `users` was never created by any
 * migration (the baseline was deliberately empty) and `documents.entityId` was
 * used by an UPDATE before anything created it. A fresh `db:migrate` therefore
 * failed partway through, so neither disaster recovery nor a staging
 * environment could be built from the repository.
 *
 * These checks are purely static, so they run in CI without a database.
 */

const drizzleDir = path.resolve(import.meta.dirname, "..", "drizzle");
const metaDir = path.join(drizzleDir, "meta");

type Journal = { entries: Array<{ idx: number; tag: string }> };

function readJournal(): Journal {
  return JSON.parse(readFileSync(path.join(metaDir, "_journal.json"), "utf8"));
}

/** Strips SQL comments so commented-out examples are not parsed as statements. */
function stripComments(sql: string): string {
  return sql
    .split(/\r?\n/)
    .filter(line => !line.trimStart().startsWith("--"))
    .join("\n");
}

const CREATE_TABLE = /^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i;
const ALTER_TABLE = /^\s*ALTER\s+TABLE\s+`?(\w+)`?/i;

/**
 * Returns the tables a migration creates and alters, in statement order, so
 * that a migration which creates a table and then adds its foreign keys (the
 * usual drizzle-kit output) is not mistaken for altering a missing table.
 */
function statementsOf(sql: string): Array<{ kind: "create" | "alter"; table: string }> {
  const out: Array<{ kind: "create" | "alter"; table: string }> = [];
  for (const raw of stripComments(sql).split(";")) {
    const create = CREATE_TABLE.exec(raw);
    if (create) {
      out.push({ kind: "create", table: create[1]! });
      continue;
    }
    const alter = ALTER_TABLE.exec(raw);
    if (alter) out.push({ kind: "alter", table: alter[1]! });
  }
  return out;
}

function orderedEntries(journal: Journal) {
  return [...journal.entries]
    .sort((a, b) => a.idx - b.idx)
    .map(entry => ({
      tag: entry.tag,
      sql: readFileSync(path.join(drizzleDir, `${entry.tag}.sql`), "utf8"),
    }));
}

function createdTables(entries: Array<{ sql: string }>): Set<string> {
  const created = new Set<string>();
  for (const { sql } of entries) {
    for (const statement of statementsOf(sql)) {
      if (statement.kind === "create") created.add(statement.table);
    }
  }
  return created;
}

describe("migration chain integrity", () => {
  const journal = readJournal();

  it("has a SQL file for every journaled migration", () => {
    const missing = journal.entries
      .map(entry => entry.tag)
      .filter(tag => !existsSync(path.join(drizzleDir, `${tag}.sql`)));
    expect(missing).toEqual([]);
  });

  it("journals every SQL migration exactly once", () => {
    const sqlTags = readdirSync(drizzleDir)
      .filter(name => name.endsWith(".sql"))
      .map(name => name.slice(0, -4));
    const journalTags = journal.entries.map(entry => entry.tag);
    expect([...journalTags].sort()).toEqual([...sqlTags].sort());
  });

  it("uses sequential journal indexes starting at zero", () => {
    expect(journal.entries.map(entry => entry.idx)).toEqual(
      journal.entries.map((_, index) => index)
    );
  });

  it("keeps journal timestamps strictly increasing and in the past", () => {
    // drizzle inserts `created_at` from each entry's `when` and afterwards
    // applies only entries whose `when` is greater than the newest recorded
    // value. Entry 0038 once carried a timestamp 319 minutes in the future,
    // which made every later migration look "already applied" while
    // `drizzle-kit migrate` still printed "migrations applied successfully".
    // A non-monotonic or future timestamp silently stops all future migrations.
    const now = Date.now();
    const problems: string[] = [];
    let previous = -Infinity;

    for (const entry of journal.entries) {
      const when = Number(entry.when);
      if (!Number.isFinite(when)) problems.push(`${entry.tag} has a non-numeric when`);
      else if (when <= previous) problems.push(`${entry.tag} is not newer than the previous entry`);
      else if (when > now) problems.push(`${entry.tag} is dated in the future`);
      previous = Math.max(previous, Number.isFinite(when) ? when : previous);
    }

    expect(problems).toEqual([]);
  });

  it("creates every table before any migration alters it", () => {
    // A clean database must be buildable by replaying the migrations in order.
    const created = new Set<string>();
    const violations: string[] = [];

    for (const entry of orderedEntries(journal)) {
      for (const statement of statementsOf(entry.sql)) {
        if (statement.kind === "create") {
          created.add(statement.table);
        } else if (!created.has(statement.table)) {
          violations.push(`${entry.tag} alters "${statement.table}" before it is created`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("creates the users and documents tables that later migrations depend on", () => {
    const created = createdTables(orderedEntries(journal));
    // `users` is the parent of many foreign keys; `documents` gains columns later.
    expect(created).toContain("users");
    expect(created).toContain("documents");
  });

  it("creates every table that schema.ts declares", () => {
    // Catches a table added to schema.ts with no migration behind it, which is
    // how the procurement tables ended up existing only via runtime DDL.
    const schema = readFileSync(path.join(drizzleDir, "schema.ts"), "utf8");
    const declared = [...schema.matchAll(/mysqlTable\(\s*"(\w+)"/g)].map(m => m[1]!);
    expect(declared.length).toBeGreaterThan(20);

    const created = createdTables(orderedEntries(journal));
    // Tables that pre-date the migration history and are covered by the
    // guarded baseline migrations instead of a dedicated CREATE TABLE.
    const baseline = new Set(["users", "documents"]);
    const missing = declared.filter(table => !created.has(table) && !baseline.has(table));
    expect(missing).toEqual([]);
  });

  it("declares documents.entityId in the migration that creates documents", () => {
    // 0018 back-fills entityType with a JOIN on documents.entityId.
    const createDocuments = readFileSync(path.join(drizzleDir, "0005_add_documents.sql"), "utf8");
    expect(createDocuments).toMatch(/`entityId`\s+int/);
  });

  it("keeps every foreign key name within MySQL's 64-character limit", () => {
    // Migration 0038 could never be applied: drizzle derived a 66-character
    // constraint name, so `db:migrate` aborted with ER_TOO_LONG_IDENT and
    // blocked every migration behind it.
    const tooLong: string[] = [];
    for (const entry of orderedEntries(journal)) {
      const body = stripComments(entry.sql);
      for (const match of body.matchAll(/CONSTRAINT\s+`([^`]+)`/gi)) {
        // Unique/primary key constraints share the limit, so check all of them.
        if (match[1]!.length > 64) tooLong.push(`${entry.tag}: ${match[1]} (${match[1]!.length})`);
      }
      for (const match of body.matchAll(/INDEX\s+`([^`]+)`\s+ON/gi)) {
        if (match[1]!.length > 64) tooLong.push(`${entry.tag}: ${match[1]} (${match[1]!.length})`);
      }
    }
    expect(tooLong).toEqual([]);
  });

  it("names the inventory-to-maintenance foreign key explicitly to fit the limit", () => {
    // Drizzle derives `inventory_requests_maintenanceRequestId_maintenance_requests_id_fk`
    // (66 characters) for an inline `.references()` here, which MySQL rejects.
    // The schema must keep the explicit short name, and a plain `.references()`
    // must not creep back in.
    const schema = readFileSync(path.join(drizzleDir, "schema.ts"), "utf8");
    const block = schema.slice(
      schema.indexOf('mysqlTable(\n  "inventory_requests"'),
      schema.indexOf('"inventory_request_items"')
    );
    expect(block).toContain("inventory_requests_maintenance_request_fk");
    expect(block).not.toMatch(/maintenanceRequestId"\)\s*\.references\(/);
  });

  it("contains no empty statement between breakpoints", () => {
    // drizzle splits a migration on `--> statement-breakpoint` and runs each
    // chunk. A duplicated breakpoint produces an empty chunk, which MySQL
    // rejects with ER_EMPTY_QUERY - and because DDL auto-commits, the migration
    // stops part-way through with everything before it already applied.
    const violations: string[] = [];
    for (const entry of orderedEntries(journal)) {
      entry.sql.split("--> statement-breakpoint").forEach((chunk, position) => {
        if (!stripComments(chunk).trim()) {
          violations.push(`${entry.tag}: empty statement at position ${position + 1}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });

  it("ends each migration with a real statement rather than a trailing breakpoint", () => {
    const violations: string[] = [];
    for (const entry of orderedEntries(journal)) {
      if (/-->\s*statement-breakpoint\s*$/.test(entry.sql.trimEnd())) {
        violations.push(`${entry.tag}: file ends with a breakpoint`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("treats every migration as re-runnable on an existing database", () => {
    // Migrations that create tables must use IF NOT EXISTS so replaying them
    // against a database that already has those tables cannot fail. Baseline
    // and reconciliation migrations were retro-fitted for exactly this reason.
    const mustBeIdempotent = [
      "0000_flowery_the_stranger.sql",
      "0005_add_documents.sql",
      "0040_purchase_tables_reconciliation.sql",
    ];
    for (const file of mustBeIdempotent) {
      const sql = stripComments(readFileSync(path.join(drizzleDir, file), "utf8"));
      const withoutGuard = [...sql.matchAll(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi)];
      expect(
        withoutGuard.length,
        `${file} has a CREATE TABLE without IF NOT EXISTS`
      ).toBe(0);
    }
  });
});
