"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  TicketIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  QrCodeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  ClipboardDocumentIcon,
  ShoppingCartIcon,
} from "@heroicons/react/24/outline";

interface Ticket {
  id: string;
  ticketNumber: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  ticketName: string;
  price: number;
  quantity: number;
  totalAmount: number;
  checkedIn: boolean;
  transactionId: string;
  paymentStatus: string;
  refundStatus?: string | null;
  refundAmount?: number | null;
}

function MyTicketsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedTicket, setCopiedTicket] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const paymentSuccess = searchParams.get("payment");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await fetch("/api/user/tickets");
        const data = await response.json();
        setTickets(data);
      } catch (error) {
        console.error("Error fetching tickets:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  const copyTicketNumber = (ticketNumber: string) => {
    navigator.clipboard.writeText(ticketNumber);
    setCopiedTicket(ticketNumber);
    setTimeout(() => setCopiedTicket(null), 2000);
  };

  const handleCancelTicket = async (ticket: Ticket) => {
    const daysUntil = Math.ceil(
      (new Date(ticket.eventDate).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    );
    const policyText =
      daysUntil >= 7
        ? "100% refund (7+ days notice)"
        : daysUntil >= 3
        ? "50% refund (3–6 days notice)"
        : "No refund (less than 3 days notice)";

    const reason = prompt(
      `Cancel this ticket?\n\nRefund policy: ${policyText}\n\nReason for cancellation (optional):`
    );
    if (reason === null) return;

    if (
      !confirm(
        `Are you sure you want to cancel "${ticket.eventTitle}"?\n\nPolicy: ${policyText}\n\nThis cannot be undone.`
      )
    )
      return;

    setCancellingId(ticket.id);
    try {
      const response = await fetch("/api/user/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: ticket.id,
          bookingType: "TICKET",
          reason: reason || "Customer cancelled ticket",
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        window.location.reload();
      } else {
        alert(data.error || "Failed to cancel ticket");
      }
    } catch (error) {
      alert("An error occurred. Please try again.");
    } finally {
      setCancellingId(null);
    }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  if (!mounted || status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400"></div>
          <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">
            Loading your tickets...
          </p>
        </motion.div>
      </div>
    );
  }

  // ✅ Fixed splits — cancelled tickets excluded from upcoming and past
  const upcomingTickets = tickets.filter(
    (t) =>
      !t.checkedIn &&
      t.paymentStatus !== "REFUNDED" &&
      new Date(t.eventDate) >= new Date()
  );

  const pastTickets = tickets.filter(
    (t) =>
      t.checkedIn ||
      (new Date(t.eventDate) < new Date() && t.paymentStatus !== "REFUNDED")
  );

  const cancelledTickets = tickets.filter(
    (t) => t.paymentStatus === "REFUNDED"
  );

  const getStatusBadge = (checkedIn: boolean) => {
    if (checkedIn) {
      return {
        text: "Checked In",
        icon: CheckCircleIcon,
        color:
          "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
      };
    }
    return {
      text: "Not Checked In",
      icon: XCircleIcon,
      color:
        "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
    };
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return {
          text: "Paid",
          color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
        };
      case "HELD_IN_ESCROW":
        return {
          text: "Confirmed (Escrow)",
          color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
        };
      case "PENDING":
        return {
          text: "Payment Pending",
          color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
        };
      case "REFUNDED":
        return {
          text: "Refunded",
          color: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
        };
      default:
        return {
          text: status || "Unknown",
          color: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
        };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mb-12"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                My Tickets
              </h1>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Manage your event tickets and QR codes
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/events"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <ShoppingCartIcon className="h-4 w-4 mr-2" />
                Buy More Tickets
              </Link>
              <div className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-3 py-1 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                <TicketIcon className="mr-1 h-4 w-4" />
                {upcomingTickets.length} Upcoming
              </div>
            </div>
          </div>
        </motion.div>

        {/* Payment Success Message */}
        {paymentSuccess === "success" && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              <p className="text-green-700 dark:text-green-300">
                ✅ Payment successful! Your tickets have been booked.
              </p>
            </div>
          </div>
        )}

        {/* Upcoming Tickets */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Upcoming Tickets
          </h2>

          {upcomingTickets.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center"
            >
              <div className="flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                  <TicketIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-gray-500 dark:text-gray-400">
                  No upcoming tickets
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Browse events to purchase tickets
                </p>
                <Link
                  href="/events"
                  className="mt-4 inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:shadow-md transition-all"
                >
                  Browse Events
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {upcomingTickets.map((ticket) => {
                const statusBadge = getStatusBadge(ticket.checkedIn);
                const StatusIcon = statusBadge.icon;
                const paymentBadge = getPaymentStatusBadge(ticket.paymentStatus);
                const isCancelling = cancellingId === ticket.id;

                return (
                  <motion.div
                    key={ticket.id}
                    variants={fadeUp}
                    whileHover={{ y: -2 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all"
                  >
                    <div className="p-5">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start justify-between flex-wrap gap-2">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {ticket.eventTitle}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}
                              >
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusBadge.text}
                              </span>
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${paymentBadge.color}`}
                              >
                                {paymentBadge.text}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-4 mt-3">
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <CalendarIcon className="h-4 w-4 mr-1 text-indigo-500" />
                              {new Date(ticket.eventDate).toLocaleDateString()}
                            </div>
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <ClockIcon className="h-4 w-4 mr-1 text-indigo-500" />
                              {ticket.eventTime}
                            </div>
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <MapPinIcon className="h-4 w-4 mr-1 text-indigo-500" />
                              {ticket.eventLocation}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-4 mt-3 text-sm">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500 dark:text-gray-400">
                                Ticket Number:
                              </span>
                              <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-300">
                                {ticket.ticketNumber || "N/A"}
                              </span>
                              {ticket.ticketNumber && (
                                <button
                                  onClick={() =>
                                    copyTicketNumber(ticket.ticketNumber)
                                  }
                                  className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                  title="Copy ticket number"
                                >
                                  <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {copiedTicket === ticket.ticketNumber && (
                                <span className="text-xs text-green-500">
                                  Copied!
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">
                                Type:
                              </span>
                              <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                                {ticket.ticketName}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">
                                Qty:
                              </span>
                              <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                                {ticket.quantity}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">
                                Total:
                              </span>
                              <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                                NPR {ticket.totalAmount.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 min-w-[160px]">
                          <Link
                            href={`/tickets/${ticket.id}`}
                            className="flex items-center justify-center px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-sm"
                          >
                            <QrCodeIcon className="h-4 w-4 mr-2" />
                            View QR Code
                          </Link>

                          {/* ✅ Cancel button - only for PENDING or HELD_IN_ESCROW */}
                          {(ticket.paymentStatus === "PENDING" || ticket.paymentStatus === "HELD_IN_ESCROW") && (
                            <button
                              onClick={() => handleCancelTicket(ticket)}
                              disabled={isCancelling}
                              className="flex items-center justify-center px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-sm disabled:opacity-50"
                            >
                              {isCancelling ? (
                                <>
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent mr-2"></div>
                                  Cancelling...
                                </>
                              ) : (
                                <>
                                  <XCircleIcon className="h-4 w-4 mr-2" />
                                  Cancel Ticket
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Past Tickets */}
        {pastTickets.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Past Tickets
            </h2>
            <div className="space-y-4">
              {pastTickets.map((ticket) => {
                const statusBadge = getStatusBadge(ticket.checkedIn);
                const StatusIcon = statusBadge.icon;
                const paymentBadge = getPaymentStatusBadge(ticket.paymentStatus);
                return (
                  <div
                    key={ticket.id}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 opacity-75"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {ticket.eventTitle}
                        </h3>
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
                          <span>
                            {new Date(ticket.eventDate).toLocaleDateString()}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusBadge.text}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentBadge.color}`}
                          >
                            {paymentBadge.text}
                          </span>
                        </div>
                        <div className="mt-2">
                          <span className="text-xs text-gray-400">
                            Ticket Number:
                          </span>
                          <span className="ml-1 text-xs font-mono text-gray-500">
                            {ticket.ticketNumber || "N/A"}
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cancelled Tickets */}
        {cancelledTickets.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Cancelled Tickets
            </h2>
            <div className="space-y-4">
              {cancelledTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 opacity-80"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {ticket.eventTitle}
                      </h3>
                      <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4" />
                          {new Date(ticket.eventDate).toLocaleDateString()}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                          <XCircleIcon className="h-3 w-3 mr-1" />
                          Cancelled
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        {ticket.ticketName} × {ticket.quantity} — NPR{" "}
                        {Number(ticket.totalAmount).toLocaleString()}
                      </div>
                    </div>

                    {/* Refund status */}
                    <div className="min-w-[180px]">
                      {ticket.refundStatus === "PENDING_ADMIN" && (
                        <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                          <ClockIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
                              Refund Pending
                            </p>
                            {ticket.refundAmount != null &&
                              ticket.refundAmount > 0 && (
                                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-0.5">
                                  NPR {ticket.refundAmount.toLocaleString()} —
                                  3–7 business days
                                </p>
                              )}
                          </div>
                        </div>
                      )}
                      {ticket.refundStatus === "PROCESSED" && (
                        <div className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                          <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-green-700 dark:text-green-400">
                              Refund Completed ✓
                            </p>
                            {ticket.refundAmount != null && (
                              <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                                NPR {ticket.refundAmount.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {ticket.refundStatus === "FAILED" && (
                        <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                          <XCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-red-700 dark:text-red-400">
                              Refund Failed
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                              Contact support
                            </p>
                          </div>
                        </div>
                      )}
                      {!ticket.refundStatus && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          No refund applicable
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ✅ Main export with Suspense boundary
export default function MyTicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400"></div>
            <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              Loading your tickets...
            </p>
          </div>
        </div>
      }
    >
      <MyTicketsContent />
    </Suspense>
  );
}