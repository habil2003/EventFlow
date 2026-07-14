import { PrismaClient, Role, AccountStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('⏳ Starting database seeding processing...');
  
  // ✅ Check if already seeded
  const existingAdmin = await prisma.user.findFirst({
    where: { email: 'admin@eventflow.com' }
  });

  if (existingAdmin) {
    console.log('⚠️ Database already seeded. Skipping...');
    return;
  }
  
  // Safe cleanup sequence - order matters for foreign keys
  await prisma.dispute.deleteMany({});
  await prisma.bookingAddOn.deleteMany({});
  await prisma.vendorBooking.deleteMany({});
  await prisma.packageAddOn.deleteMany({});
  await prisma.servicePackage.deleteMany({});
  await prisma.organizerProfile.deleteMany({});
  await prisma.vendorProfile.deleteMany({});
  await prisma.userSocialEvent.deleteMany({});
  await prisma.ticketBooking.deleteMany({});
  await prisma.ticketTier.deleteMany({});
  await prisma.ticketedEvent.deleteMany({});
  await prisma.user.deleteMany({});

  // Standard development password: 'Password123!'
  const hashedDefaultPassword = await bcrypt.hash('Password123!', 10);

  console.log('👤 Injecting core systemic users...');
  
  // 1. Admin
  await prisma.user.create({
    data: {
      name: 'System Administrator',
      email: 'admin@eventflow.com',
      passwordHash: hashedDefaultPassword,
      role: Role.ADMIN,
      status: AccountStatus.APPROVED,
    },
  });

  // 2. Organizer
  const organizer = await prisma.user.create({
    data: {
      name: 'Pokhara Concerts Ltd.',
      email: 'organizer@eventflow.com',
      passwordHash: hashedDefaultPassword,
      role: Role.ORGANIZER,
      status: AccountStatus.APPROVED,
    },
  });

  // Create OrganizerProfile
  await prisma.organizerProfile.create({
    data: {
      userId: organizer.id,
      businessName: 'Pokhara Concerts Ltd.',
      businessType: 'event_company',
      phone: '9812345678',
    },
  });

  // 3. Vendor
  const vendorUser = await prisma.user.create({
    data: {
      name: 'Ram Catering Services',
      email: 'vendor@eventflow.com',
      passwordHash: hashedDefaultPassword,
      role: Role.VENDOR,
      status: AccountStatus.APPROVED,
    },
  });

  // Create VendorProfile
  const vendorProfile = await prisma.vendorProfile.create({
    data: {
      userId: vendorUser.id,
      businessName: 'Ram Catering Services',
      serviceType: 'catering',
      location: 'New Road, Pokhara',
      description: 'Premium organic catering services for weddings and social events.',
    },
  });

  // 4. Regular Customer / User
  await prisma.user.create({
    data: {
      name: 'Haabil Tamang',
      email: 'user@eventflow.com',
      passwordHash: hashedDefaultPassword,
      role: Role.USER,
      status: AccountStatus.APPROVED,
    },
  });

  console.log('🎫 Injecting ticketed event models...');
  const concertDate = new Date();
  concertDate.setDate(concertDate.getDate() + 30);

  const event = await prisma.ticketedEvent.create({
    data: {
      title: 'Pokhara Music Festival 2026',
      description: 'An ultimate live musical experience featuring top Nepalese artists.',
      eventDate: concertDate,
      eventTime: '16:00',
      location: 'Rangashala Ground, Pokhara',
      capacity: 1000,
      organizerId: organizer.id,
    },
  });

  // Add tiered ticket levels
  await prisma.ticketTier.createMany({
    data: [
      { eventId: event.id, name: 'Early Bird', price: 500.00, quantity: 200, soldCount: 0 },
      { eventId: event.id, name: 'GA', price: 1000.00, quantity: 700, soldCount: 0 },
      { eventId: event.id, name: 'VIP', price: 2500.00, quantity: 100, soldCount: 0 },
    ],
  });

  console.log('🍳 Injecting social vendor packaging details...');
  
  const silverPkg = await prisma.servicePackage.create({
    data: {
      vendorId: vendorProfile.id,
      name: 'Silver',
      price: 45000.00,
      description: 'Basic buffet options including 2 main courses, starters, and local desserts.',
    },
  });

  await prisma.packageAddOn.create({
    data: {
      packageId: silverPkg.id,
      name: 'Extra Chocolate Fountain Hour',
      extraPrice: 5000.00,
      isOptional: true,
    },
  });

  console.log('✅ Database successfully populated with structural seed configurations!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });