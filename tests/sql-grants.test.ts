import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Les tests tournent avec un rôle propriétaire : sans ce contrôle, une écriture
 * refusée au rôle restreint connecteo_http n'apparaît qu'en erreur 500.
 */
const OPERATION_PRIVILEGES: Record<string, string[]> = {
  create: ["INSERT"],
  createMany: ["INSERT"],
  update: ["UPDATE"],
  updateMany: ["UPDATE"],
  delete: ["DELETE"],
  deleteMany: ["DELETE"],
  upsert: ["INSERT", "UPDATE"],
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "generated") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

function grantedPrivileges(): Map<string, Set<string>> {
  const grants = new Map<string, Set<string>>();
  const pattern = /^GRANT ([A-Z, ]+) ON TABLE "?(\w+)"? TO connecteo_http;/gm;

  for (const file of readdirSync("sql").sort()) {
    const sql = readFileSync(join("sql", file), "utf8");
    for (const [, privileges, table] of sql.matchAll(pattern)) {
      const current = grants.get(table) ?? new Set<string>();
      privileges.split(",").forEach((privilege) => current.add(privilege.trim()));
      grants.set(table, current);
    }
  }
  return grants;
}

function requiredPrivileges(): Set<string> {
  const required = new Set<string>();
  const pattern = /\b(?:prisma|tx)\.(\w+)\.(\w+)\(/g;

  for (const file of sourceFiles("src")) {
    for (const [, table, operation] of readFileSync(file, "utf8").matchAll(pattern)) {
      for (const privilege of OPERATION_PRIVILEGES[operation] ?? []) {
        required.add(`${table} ${privilege}`);
      }
    }
  }
  return required;
}

describe("Droits du rôle connecteo_http", () => {
  it("couvrent toutes les écritures du code", () => {
    const grants = grantedPrivileges();
    const required = [...requiredPrivileges()];
    expect(required.length).toBeGreaterThan(0);

    const missing = required.filter((entry) => {
      const [table, privilege] = entry.split(" ");
      return !grants.get(table)?.has(privilege);
    });

    expect(missing).toEqual([]);
  });
});
