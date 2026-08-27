import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

try {
  const types = await p.user_type.findMany();
  console.log("user_type:", JSON.stringify(types));

  const heroes = await p.hero_slide.findMany();
  console.log("hero_slide:", JSON.stringify(heroes));

  const views = await p.page_view.findMany({ take: 3 });
  console.log("page_view:", JSON.stringify(views));

  const users = await p.user.findMany({ select: { id: true, email: true, username: true } });
  console.log("user:", JSON.stringify(users));

  console.log("OK: Toutes les lectures fonctionnent avec connecteo_http");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
} finally {
  await p.$disconnect();
}
