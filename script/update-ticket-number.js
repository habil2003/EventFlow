const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateTicketNumbers() {
  console.log('🔄 Starting ticket number update...');
  
  try {
    // Get ALL tickets ordered by event and creation date
    const allTickets = await prisma.ticketBooking.findMany({
      orderBy: [
        { eventId: 'asc' },
        { createdAt: 'asc' }
      ],
    });
    
    console.log(`📊 Found ${allTickets.length} total tickets`);
    
    // Keep track of counter per event
    const eventCounters = {};
    let updatedCount = 0;
    
    for (const ticket of allTickets) {
      // Initialize counter for this event if not exists
      if (!eventCounters[ticket.eventId]) {
        eventCounters[ticket.eventId] = 1;
      } else {
        eventCounters[ticket.eventId]++;
      }
      
      const newNumber = String(eventCounters[ticket.eventId]);
      
      // Only update if the ticket number is different
      if (ticket.ticketNumber !== newNumber) {
        await prisma.ticketBooking.update({
          where: { id: ticket.id },
          data: { ticketNumber: newNumber },
        });
        updatedCount++;
        console.log(`   ✅ Ticket ${updatedCount}: "${ticket.ticketNumber}" → "${newNumber}" (Event: ${ticket.eventId.slice(-6)})`);
      } else {
        console.log(`   ⏭️ Ticket ${updatedCount + 1}: Already "${newNumber}" (no change)`);
      }
    }
    
    console.log(`\n🎉 Updated ${updatedCount} ticket numbers successfully!`);
    
    // Verify the update
    const sampleTickets = await prisma.ticketBooking.findMany({
      take: 10,
      select: { id: true, ticketNumber: true, eventId: true },
      orderBy: { eventId: 'asc' }
    });
    
    console.log('\n📊 Sample of updated tickets:');
    sampleTickets.forEach(t => {
      console.log(`   Ticket: ${t.ticketNumber} (Event: ${t.eventId.slice(-6)})`);
    });
    
  } catch (error) {
    console.error('❌ Error updating ticket numbers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
updateTicketNumbers();