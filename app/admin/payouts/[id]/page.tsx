"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyRupeeIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  UserIcon,
  CalendarIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";

interface PayoutDetail {
  id: string;
  amount: number;
  platformCommission: number;
  vendorPayout: number;
  type: string;
  status: string;
  createdAt: string;
  processedAt: string;
  notes: string;
  transactionId: string;
  khaltiPayoutId: string;
  isBulk: boolean;
  ticketCount: number;
  childPayouts: {
    id: string;
    amount: number;
    vendorPayout: number;
    customerName: string;
    ticketNumber: string;
  }[];
  vendor: {
    businessName: string;
    user: { name: string; email: string };
  } | null;
  vendorBooking: {
    user: { name: string; email: string };
    userSocialEvent: { title: string; eventDate: string };
    servicePackage: { name: string };
  } | null;
  ticketBooking: {
    event: { title: string };
    user: { name: string; email: string };
    tier: { name: string };
  } | null;
  admin: { name: string; email: string };
}

export default function AdminPayoutDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [payout, setPayout] = useState<PayoutDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session && session.user?.role !== "ADMIN") {
      router.push("/");
    }
  }, [session, router]);

  useEffect(() => {
    const fetchPayout = async () => {
      try {
        const response = await fetch(`/api/admin/payouts/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setPayout(data.data);
        }
      } catch (error) {
        console.error("Error fetching payout:", error);
      } finally {
        setLoading(false);
      }
    };
    if (params.id) {
      fetchPayout();
    }
  }, [params.id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-NP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return `NPR ${amount.toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return { 
          text: "✅ Completed", 
          color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          icon: CheckCircleIcon
        };
      case "PENDING":
        return { 
          text: "⏳ Pending", 
          color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
          icon: ClockIcon
        };
      case "PROCESSING":
        return { 
          text: "🔄 Processing", 
          color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
          icon: ClockIcon
        };
      case "CANCELLED":
        return { 
          text: "❌ Cancelled", 
          color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          icon: ClockIcon
        };
      default:
        return { 
          text: status, 
          color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
          icon: ClockIcon
        };
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading payout details...</p>
        </div>
      </div>
    );
  }

  if (!payout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12">
            <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payout Not Found</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">The payout you're looking for doesn't exist.</p>
            <Link href="/admin/payouts" className="mt-6 inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Back to Payouts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusBadge = getStatusBadge(payout.status);
  const StatusIcon = statusBadge.icon;
  const isCompleted = payout.status === 'COMPLETED';
  const isPending = payout.status === 'PENDING';
  const isProcessing = payout.status === 'PROCESSING';
  const isBulk = payout.isBulk || payout.type === 'TICKET_SALES_BULK';

  // Determine recipient info
  const recipientName = payout.vendor?.businessName || payout.ticketBooking?.event?.title || 'Unknown';
  const recipientUser = payout.vendor?.user?.name || payout.ticketBooking?.user?.name || 'N/A';
  const recipientEmail = payout.vendor?.user?.email || payout.ticketBooking?.user?.email || 'N/A';
  const eventTitle = payout.vendorBooking?.userSocialEvent?.title || payout.ticketBooking?.event?.title || 'N/A';
  const eventDate = payout.vendorBooking?.userSocialEvent?.eventDate || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Back button */}
        <div className="mb-8">
          <Link
            href="/admin/payouts"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Payouts
          </Link>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className={`px-6 py-5 ${
            isCompleted 
              ? 'bg-gradient-to-r from-green-600 to-emerald-600' 
              : isPending 
                ? 'bg-gradient-to-r from-yellow-600 to-amber-600'
                : isProcessing
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
                  : 'bg-gradient-to-r from-gray-600 to-gray-700'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">
                  {isBulk ? `📦 Bulk Payout #${payout.id.slice(0, 8)}` : `Payout #${payout.id.slice(0, 8)}`}
                </h1>
                <p className="text-white/80 text-sm mt-1">
                  Created: {formatDate(payout.createdAt)}
                  {isBulk && payout.ticketCount > 0 && (
                    <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      {payout.ticketCount} tickets
                    </span>
                  )}
                </p>
              </div>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${statusBadge.color}`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusBadge.text}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* ✅ Bulk Summary Banner */}
            {isBulk && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      📦 Bulk Payout - {payout.ticketCount} tickets
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      One manual transfer of {formatCurrency(payout.vendorPayout)} for all {payout.ticketCount} tickets
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Amount Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Gross Amount</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(payout.amount)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Platform Commission (10%)</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(payout.platformCommission)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Net Payout</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(payout.vendorPayout)}</p>
              </div>
            </div>

            {/* Recipient & Event Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  <UserIcon className="h-4 w-4 inline mr-1" />
                  Recipient
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="font-medium text-gray-900 dark:text-white">{recipientName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{recipientUser}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{recipientEmail}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  <CalendarIcon className="h-4 w-4 inline mr-1" />
                  Event Details
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="font-medium text-gray-900 dark:text-white">{eventTitle}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Type: {payout.type === 'TICKET_SALES_BULK' ? 'Bulk Ticket Sales' : payout.type === 'TICKET_SALES' ? 'Ticket Sales' : payout.type === 'DEPOSIT' ? 'Deposit' : 'Remaining'}
                  </p>
                  {eventDate && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDate(eventDate)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ✅ Individual Ticket Breakdown (for Bulk) */}
            {isBulk && payout.childPayouts && payout.childPayouts.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                  🎫 Individual Tickets ({payout.childPayouts.length})
                </h3>
                <div className="space-y-2">
                  {payout.childPayouts.map((ticket) => (
                    <div key={ticket.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {ticket.customerName}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Ticket #{ticket.ticketNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(ticket.amount)}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Payout: {formatCurrency(ticket.vendorPayout)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between font-medium text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 mt-3 pt-3">
                    <span>Total</span>
                    <span>{formatCurrency(payout.vendorPayout)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                <ShieldCheckIcon className="h-4 w-4 inline mr-1" />
                Processed By
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-gray-900 dark:text-white">{payout.admin?.name || 'System'}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{payout.admin?.email || 'N/A'}</p>
                {payout.processedAt && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Processed: {formatDate(payout.processedAt)}
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            {payout.notes && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  <DocumentTextIcon className="h-4 w-4 inline mr-1" />
                  Notes
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{payout.notes}</p>
                </div>
              </div>
            )}

            {/* Verification Info (if completed via escrow) */}
            {isCompleted && payout.khaltiPayoutId && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheckIcon className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">
                      ✅ Verified via Escrow
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      <strong>Transaction Reference:</strong> {payout.khaltiPayoutId}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      <strong>Verified At:</strong> {formatDate(payout.processedAt)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Status Info for Pending/Processing */}
            {isPending && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                      ⏳ Awaiting Verification
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                      This payout is pending verification. Please go to the 
                      <Link href="/admin/escrow" className="font-medium underline mx-1">
                        Escrow Management
                      </Link>
                      page to confirm the transfer with proof.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ClockIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0 animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      🔄 Processing
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      This payout is being processed. Please wait for completion or 
                      <Link href="/admin/escrow" className="font-medium underline mx-1">
                        check the Escrow page
                      </Link>
                      for status updates.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction ID */}
            {payout.transactionId && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  <strong>Transaction ID:</strong> {payout.transactionId}
                </p>
              </div>
            )}

            {/* Status Timeline */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Status Timeline
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-3 w-3 rounded-full ${
                      isCompleted ? 'bg-green-500' : 'bg-green-300 dark:bg-green-700'
                    }`}></div>
                    {!isCompleted && <div className="h-8 w-0.5 bg-gray-300 dark:bg-gray-600"></div>}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Payout Created</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(payout.createdAt)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {isBulk ? `Bulk payout created for ${payout.ticketCount} tickets` : 'Payout request was initiated'}
                    </p>
                  </div>
                </div>

                {(isProcessing || isCompleted) && (
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-3 w-3 rounded-full ${
                        isCompleted ? 'bg-green-500' : 'bg-blue-500'
                      }`}></div>
                      {!isCompleted && <div className="h-8 w-0.5 bg-gray-300 dark:bg-gray-600"></div>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Funds Released</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isProcessing ? 'Processing...' : formatDate(payout.processedAt)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Funds were released from escrow</p>
                    </div>
                  </div>
                )}

                {isCompleted && (
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">✅ Transfer Verified</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(payout.processedAt)}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Transfer confirmed with proof 
                        {payout.khaltiPayoutId && ` (Ref: ${payout.khaltiPayoutId})`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action: Go to Escrow */}
            {(isPending || isProcessing) && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <Link
                  href="/admin/escrow"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <ShieldCheckIcon className="h-4 w-4" />
                  Go to Escrow Management
                </Link>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Verification with proof must be done through the Escrow Management page.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}