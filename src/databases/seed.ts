import prisma from "../lib/prisma.js";
import bcrypt from "bcryptjs";

async function main() {
  // Create user types
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

  // Create default superAdmin
  const hashedPassword = await bcrypt.hash("SuperAdmin123!", 12);

  await prisma.user.upsert({
    where: { email: "superadmin@connecteo.fr" },
    update: {},
    create: {
      email: "superadmin@connecteo.fr",
      username: "superadmin",
      password_hash: hashedPassword,
      user_type_id: 1,
      is_active: true,
    },
  });

  console.log("Seed completed successfully");
  console.log("SuperAdmin credentials: superadmin@connecteo.fr / SuperAdmin123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
