import "dotenv/config";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./helpers/test-db.js";

const TEST_DB_NAME = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");

export default async function globalSetup(): Promise<void> {
  process.env.DATABASE_URL = TEST_DATABASE_URL;

  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();

  const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DB_NAME]);
  if (existing.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  }
  await admin.end();

  execFileSync(resolve("node_modules/.bin/prisma"), ["migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });

  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const adapter = new PrismaPg({ connectionString: TEST_DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  await prisma.user_type.upsert({
    where: { id: 1 },
    update: { type: "superAdmin" },
    create: { id: 1, type: "superAdmin" },
  });
  await prisma.user_type.upsert({
    where: { id: 2 },
    update: { type: "admin" },
    create: { id: 2, type: "admin" },
  });

  await prisma.$disconnect();
}
