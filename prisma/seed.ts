// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with 4 users...');

  const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
  };

  // Define users
  const users = [
    {
      email: 'habiltamang17@gmail.com',
      name: 'Habib Tamang',
      password: 'habil1234',
      role: 'ADMIN' as const,
      status: 'APPROVED' as const,
      emailVerified: new Date(),
    },
    {
      email: 'tamanghabil829@gmail.com',
      name: 'Habil Tamang',
      password: 'habil1234',
      role: 'VENDOR' as const,
      status: 'APPROVED' as const,
      emailVerified: new Date(),
    },
    {
      email: 'haabil.fusionitsolutions@gmail.com',
      name: 'Haabil Tamang',
      password: 'habil1234',
      role: 'ORGANIZER' as const,
      status: 'APPROVED' as const,
      emailVerified: new Date(),
    },
    {
      email: 'tamanghabil603@gmail.com',
      name: 'Habil Tamang',
      password: 'habil1234',
      role: 'USER' as const,
      status: 'APPROVED' as const,
      emailVerified: new Date(),
    },
  ];

  // Insert users
  for (const userData of users) {
    const hashedPassword = await hashPassword(userData.password);
    
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        name: userData.name,
        passwordHash: hashedPassword,
        role: userData.role,
        status: userData.status,
        emailVerified: userData.emailVerified,
      },
      create: {
        id: crypto.randomUUID(),
        name: userData.name,
        email: userData.email,
        passwordHash: hashedPassword,
        role: userData.role,
        status: userData.status,
        emailVerified: userData.emailVerified,
      },
    });
    
    console.log(`✅ Created ${user.role}: ${user.email} (${user.name})`);
  }

  // Create Vendor Profile for vendor user
  const vendorUser = await prisma.user.findUnique({
    where: { email: 'tamanghabil829@gmail.com' },
  });

  if (vendorUser) {
    await prisma.vendorProfile.upsert({
      where: { userId: vendorUser.id },
      update: {},
      create: {
        id: crypto.randomUUID(),
        userId: vendorUser.id,
        businessName: 'Habil\'s Catering Services',
        serviceType: 'Catering',
        location: 'Kathmandu, Nepal',
        description: 'Professional catering and event services',
      },
    });
    console.log(`✅ Vendor Profile created for: ${vendorUser.email}`);
  }

  // Create Organizer Profile for organizer user
  const organizerUser = await prisma.user.findUnique({
    where: { email: 'haabil.fusionitsolutions@gmail.com' },
  });

  if (organizerUser) {
    await prisma.organizerProfile.upsert({
      where: { userId: organizerUser.id },
      update: {},
      create: {
        id: crypto.randomUUID(),
        userId: organizerUser.id,
        businessName: 'Fusion IT Solutions Events',
        businessType: 'Event Management',
        phone: '9800000000',
      },
    });
    console.log(`✅ Organizer Profile created for: ${organizerUser.email}`);
  }

  console.log('\n🎉 Seeding complete!');
  console.log('\n📋 Credentials:');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ Admin:     habiltamang17@gmail.com / habil1234             │');
  console.log('│ Vendor:    tamanghabil829@gmail.com / habil1234            │');
  console.log('│ Organizer: haabil.fusionitsolutions@gmail.com / habil1234  │');
  console.log('│ User:      tamanghabil603@gmail.com / habil1234            │');
  console.log('└─────────────────────────────────────────────────────────────┘');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });