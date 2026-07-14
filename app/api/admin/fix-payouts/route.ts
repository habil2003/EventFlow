import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all completed payouts
    const payouts = await prisma.payout.findMany({
      where: {
        status: 'COMPLETED',
      },
    });

    console.log(`Found ${payouts.length} payouts to check`);

    let updated = 0;
    let skipped = 0;
    const updates = [];

    for (const payout of payouts) {
      const amount = Number(payout.amount);
      const currentCommission = payout.platformCommission ? Number(payout.platformCommission) : 0;
      const currentVendorPayout = payout.vendorPayout ? Number(payout.vendorPayout) : 0;
      
      // Calculate what they should be
      const expectedCommission = amount * 0.1;
      const expectedVendorPayout = amount - expectedCommission;
      
      // Update if mismatch
      if (currentCommission !== expectedCommission || currentVendorPayout !== expectedVendorPayout) {
        const updatedPayout = await prisma.payout.update({
          where: { id: payout.id },
          data: {
            platformCommission: expectedCommission,
            vendorPayout: expectedVendorPayout,
          },
        });

        updates.push({
          id: updatedPayout.id,
          amount: Number(updatedPayout.amount),
          oldCommission: currentCommission,
          newCommission: Number(updatedPayout.platformCommission),
          oldVendorPayout: currentVendorPayout,
          newVendorPayout: Number(updatedPayout.vendorPayout),
        });
        
        updated++;
        console.log(`Updated payout ${payout.id}: amount=${amount}, commission ${currentCommission} → ${expectedCommission}`);
      } else {
        skipped++;
        console.log(`Skipped payout ${payout.id} - already correct`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} payouts, skipped ${skipped}`,
      updatedCount: updated,
      skippedCount: skipped,
      updates,
    });
  } catch (error) {
    console.error('Error fixing payouts:', error);
    return NextResponse.json({ 
      error: 'Failed to fix payouts', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}