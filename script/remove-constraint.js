/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function removeConstraint() {
  try {
    console.log('🔄 Removing unique constraint from ticketNumber...');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TicketBooking" 
      DROP CONSTRAINT IF EXISTS "TicketBooking_ticketNumber_key"
    `);
    
    console.log('✅ Unique constraint removed successfully!');
    
    // Verify
    console.log('🔄 Updating ticket numbers...');
    
    // Get all events
    const events = await prisma.ticketBooking.findMany({
      select: { eventId: true },
      distinct: ['eventId'],
    });
    
    for (const { eventId } of events) {
      const tickets = await prisma.ticketBooking.findMany({
        where: { eventId },
        orderBy: { createdAt: 'asc' },
      });
      
      for (let i = 0; i < tickets.length; i++) {
        await prisma.ticketBooking.update({
          where: { id: tickets[i].id },
          data: { ticketNumber: String(i + 1) },
        });
      }
      console.log(`   ✅ Updated ${tickets.length} tickets for event ${eventId.slice(-6)}`);
    }
    
    console.log('🎉 All done!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

removeConstraint();