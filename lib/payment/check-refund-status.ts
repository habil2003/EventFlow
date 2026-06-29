// lib/payment/check-refund-status.ts
import { prisma } from '@/lib/prisma'; // ✅ FIXED: was missing

/**
 * Khalti doesn't return a refund ID in their API response,
 * so there's nothing to poll. This utility just checks our
 * own database for refunds that have been stuck in PENDING_ADMIN
 * for too long and flags them for admin attention.
 */
export async function getOverdueRefunds(olderThanDays = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const overdueRefunds = await prisma.refund.findMany({
    where: {
      refundStatus: 'PENDING_ADMIN',
      createdAt: { lt: cutoff },
    },
    include: {
      vendorBooking: { include: { user: true } },
      ticketBooking: { include: { user: true } },
      paymentTransaction: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return overdueRefunds;
}

/**
 * For the cron route — returns a summary of pending refund health
 */
export async function updatePendingRefunds() {
  const overdueRefunds = await getOverdueRefunds(7);

  console.log(`Found ${overdueRefunds.length} refunds pending admin action for 7+ days`);

  return {
    overdueCount: overdueRefunds.length,
    overdueRefundIds: overdueRefunds.map((r) => r.id),
    message:
      overdueRefunds.length > 0
        ? `${overdueRefunds.length} refund(s) require admin attention`
        : 'All refunds are up to date',
  };
}