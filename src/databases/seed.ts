import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { envConfig } from '@/config/env.config';

const adapter = new PrismaPg({ connectionString: envConfig.dbConfig.databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.userType.createMany({
    data: [
      { type: 'admin' },
      { type: 'editor' },
    ],
    skipDuplicates: true,
  });

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
