import "dotenv/config";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? (() => {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/postgres");
  url.pathname = "/connecteo_test";
  return url.toString();
})();
