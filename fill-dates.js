const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get all bookings without dates
  const bookings = await prisma.vendorBooking.findMany({
    where: {
      startDate: null,
    },
  });

  console.log(`Found ${bookings.length} bookings to update`);

  for (const booking of bookings) {
    // Get the event date from UserSocialEvent
    const event = await prisma.userSocialEvent.findUnique({
      where: { id: booking.userSocialEventId },
    });

    if (event && event.eventDate) {
      const date = event.eventDate;
      const totalAmount = Number(booking.totalAmount);
      const dailyRate = totalAmount; // For existing single-day bookings
      
      await prisma.vendorBooking.update({
        where: { id: booking.id },
        data: {
          startDate: date,
          endDate: date,
          totalDays: 1,
          dailyRate: dailyRate,
          bookingReference: `BKG_${booking.id}_${Date.now()}`,
        },
      });
      console.log(`Updated booking ${booking.id}`);
    }
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());