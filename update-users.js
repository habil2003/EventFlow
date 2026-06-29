const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: {
      emailVerified: null,
    },
    data: {
      emailVerified: new Date(),
      status: 'APPROVED',
    },
  });
  console.log(`Updated ${result.count} users`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());