import prisma from "../lib/prisma.js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

function generatePassword(length = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function main() {
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

  const plainPassword = process.env.SUPERADMIN_PASSWORD || generatePassword();
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  await prisma.user.upsert({
    where: { username: "superadmin" },
    update: {
      email: "superadmin@connecteo.mg",
      password_hash: hashedPassword,
      force_password_change: true,
    },
    create: {
      email: "superadmin@connecteo.mg",
      username: "superadmin",
      password_hash: hashedPassword,
      user_type_id: 1,
      is_active: true,
      force_password_change: true,
    },
  });

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Seed terminé avec succès !");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Email    : superadmin@connecteo.mg`);
  console.log(`  Password : ${plainPassword}`);
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  ⚠  Vous DEVEZ changer ce mot de passe au premier login.");
  console.log("═══════════════════════════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
