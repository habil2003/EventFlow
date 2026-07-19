"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeftIcon,
  BanknotesIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  EyeIcon,
  ChevronRightIcon,
  BuildingOfficeIcon,
  UserIcon,
  ReceiptRefundIcon,
  ArrowPathIcon,
  CreditCardIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";

interface RefundRecord {
  id: string;
  bookingId: string;
  type: "VENDOR" | "TICKET";
  vendorName: string;
  eventTitle: string;
  eventDate: string;
  packageName: string;
  totalAmount?: number;
  refundAmount: number;
  refundStatus: string;
  refundMethod: string | null;
  refundPercentage: number | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  createdAt: string;
  processedAt: string | null;
}

// Helper: Get status config
const getStatusConfig = (status: string) => {
  switch (status) {
    case "PROCESSED":
      return {
        label: "Completed",
        color: "emerald",
        icon: CheckCircleIcon,
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
        text: "text-emerald-700 dark:text-emerald-300",
        border: "border-emerald-200 dark:border-emerald-800",
        dot: "bg-emerald-500",
      };
    case "PENDING_ADMIN":
      return {
        label: "Processing",
        color: "amber",
        icon: ClockIcon,
        bg: "bg-amber-50 dark:bg-amber-900/20",
        text: "text-amber-700 dark:text-amber-300",
        border: "border-amber-200 dark:border-amber-800",
        dot: "bg-amber-500 animate-pulse",
      };
    case "FAILED":
      return {
        label: "Failed",
        color: "rose",
        icon: XCircleIcon,
        bg: "bg-rose-50 dark:bg-rose-900/20",
        text: "text-rose-700 dark:text-rose-300",
        border: "border-rose-200 dark:border-rose-800",
        dot: "bg-rose-500",
      };
    default:
      return {
        label: status,
        color: "gray",
        icon: ClockIcon,
        bg: "bg-gray-50 dark:bg-gray-800",
        text: "text-gray-700 dark:text-gray-300",
        border: "border-gray-200 dark:border-gray-700",
        dot: "bg-gray-400",
      };
  }
};

// ✅ Helper: Get refund method config - NO FALLBACKS
const getMethodConfig = (method: string | null) => {
  // ✅ If method is null, show "Not Available" - NOT a fallback
  if (!method) {
    return {
      label: "Not Available",
      icon: XCircleIcon,
      color: "gray",
      bg: "bg-gray-50 dark:bg-gray-700/30",
      text: "text-gray-500 dark:text-gray-400",
      border: "border-gray-200 dark:border-gray-700",
    };
  }

  // ✅ Only map real methods from the database
  switch (method) {
    case "KHALTI_API":
      return {
        label: "Auto-Refund (Khalti API)",
        icon: CreditCardIcon,
        color: "purple",
        bg: "bg-purple-50 dark:bg-purple-900/20",
        text: "text-purple-700 dark:text-purple-300",
        border: "border-purple-200 dark:border-purple-800",
      };
    case "BANK_TRANSFER":
      return {
        label: "Bank Transfer",
        icon: BuildingOfficeIcon,
        color: "blue",
        bg: "bg-blue-50 dark:bg-blue-900/20",
        text: "text-blue-700 dark:text-blue-300",
        border: "border-blue-200 dark:border-blue-800",
      };
    case "KHALTI_MANUAL":
      return {
        label: "Khalti Dashboard",
        icon: BanknotesIcon,
        color: "green",
        bg: "bg-green-50 dark:bg-green-900/20",
        text: "text-green-700 dark:text-green-300",
        border: "border-green-200 dark:border-green-800",
      };
    case "CASH":
      return {
        label: "Cash Refund",
        icon: BanknotesIcon,
        color: "yellow",
        bg: "bg-yellow-50 dark:bg-yellow-900/20",
        text: "text-yellow-700 dark:text-yellow-300",
        border: "border-yellow-200 dark:border-yellow-800",
      };
    case "CHEQUE":
      return {
        label: "Cheque Refund",
        icon: AcademicCapIcon,
        color: "indigo",
        bg: "bg-indigo-50 dark:bg-indigo-900/20",
        text: "text-indigo-700 dark:text-indigo-300",
        border: "border-indigo-200 dark:border-indigo-800",
      };
    case "MANUAL":
      return {
        label: "Manual Refund",
        icon: BuildingOfficeIcon,
        color: "gray",
        bg: "bg-gray-50 dark:bg-gray-700/30",
        text: "text-gray-700 dark:text-gray-300",
        border: "border-gray-200 dark:border-gray-700",
      };
    default:
      return {
        label: `Unknown: ${method}`,
        icon: XCircleIcon,
        color: "red",
        bg: "bg-red-50 dark:bg-red-900/20",
        text: "text-red-700 dark:text-red-300",
        border: "border-red-200 dark:border-red-800",
      };
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-NP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString("en-NP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function MyRefundsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRefund, setSelectedRefund] = useState<RefundRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "PROCESSED" | "PENDING_ADMIN" | "FAILED">("all");
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchRefunds = async () => {
      try {
        const response = await fetch("/api/user/refunds");
        const data = await response.json();
        setRefunds(data.refunds);
      } catch (error) {
        console.error("Error fetching refunds:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRefunds();
  }, []);

  const stats = {
    total: refunds.length,
    processed: refunds.filter((r) => r.refundStatus === "PROCESSED").length,
    pending: refunds.filter((r) => r.refundStatus === "PENDING_ADMIN").length,
    failed: refunds.filter((r) => r.refundStatus === "FAILED").length,
    totalAmount: refunds.reduce((sum, r) => sum + r.refundAmount, 0),
  };

  const filteredRefunds = refunds.filter((refund) => {
    if (filter !== "all" && refund.refundStatus !== filter) return false;
    return true;
  });

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-gray-500">Loading your refunds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ===== HEADER ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:shadow-md"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ReceiptRefundIcon className="h-7 w-7 text-indigo-600" />
                Refunds
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Track your refund requests and status
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Total Refunded:</span>
              <span className="ml-1 font-semibold text-indigo-600 dark:text-indigo-400">
                NPR {stats.totalAmount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ===== STATS CARDS ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Refunds</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <ReceiptRefundIcon className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-emerald-600">{stats.processed}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Processing</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <ClockIcon className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-rose-600">{stats.failed}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Failed</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <XCircleIcon className="h-5 w-5 text-rose-600" />
              </div>
            </div>
          </div>
        </div>

        {/* ===== FILTER TABS ===== */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {[
            { value: "all", label: "All", count: stats.total },
            { value: "PROCESSED", label: "Completed", count: stats.processed },
            { value: "PENDING_ADMIN", label: "Processing", count: stats.pending },
            { value: "FAILED", label: "Failed", count: stats.failed },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as any)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                filter === tab.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs ${filter === tab.value ? "text-white/70" : "text-gray-400"}`}>
                ({tab.count})
              </span>
            </button>
          ))}
        </div>

        {/* ===== REFUNDS LIST ===== */}
        {filteredRefunds.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex flex-col items-center">
              <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                <ReceiptRefundIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No refunds found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {filter !== "all" ? "Try changing the filter" : "Refunds will appear here when processed"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRefunds.map((refund, index) => {
              const Status = getStatusConfig(refund.refundStatus);
              const StatusIcon = Status.icon;
              const Method = getMethodConfig(refund.refundMethod);
              const isProcessing = refund.refundStatus === "PENDING_ADMIN";
              const isCompleted = refund.refundStatus === "PROCESSED";

              return (
                <motion.div
                  key={refund.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onMouseEnter={() => setHoveredCard(refund.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Status Dot */}
                      <div className="flex-shrink-0 pt-1">
                        <div className={`h-3 w-3 rounded-full ${Status.dot}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Top Row: Vendor & Status */}
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {refund.vendorName}
                          </h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${Status.bg} ${Status.text}`}>
                            <StatusIcon className="h-3 w-3" />
                            {Status.label}
                          </span>
                          {refund.refundPercentage !== null && (
                            <span className={`text-xs font-medium ${refund.refundPercentage >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {refund.refundPercentage}% refund
                            </span>
                          )}
                        </div>

                        {/* Event & Package */}
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 truncate">
                          {refund.eventTitle} · <span className="text-gray-500 dark:text-gray-400">{refund.packageName}</span>
                        </p>

                        {/* Meta Row with Gateway Method */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {formatDate(refund.eventDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <BanknotesIcon className="h-3 w-3" />
                            NPR {refund.refundAmount.toLocaleString()}
                          </span>
                          {/* ✅ Show Gateway Method - Real data only */}
                          {isCompleted && (
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${Method.bg} ${Method.text} border ${Method.border}`}>
                              <Method.icon className="h-3 w-3" />
                              {Method.label}
                            </span>
                          )}
                          {refund.cancelledBy && (
                            <span className="flex items-center gap-1 text-gray-400">
                              <UserIcon className="h-3 w-3" />
                              {refund.cancelledBy === "VENDOR" ? "Vendor declined" : "Cancelled by you"}
                            </span>
                          )}
                        </div>

                        {/* Cancellation reason */}
                        {refund.cancellationReason && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 truncate">
                            💬 {refund.cancellationReason}
                          </p>
                        )}
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => {
                          setSelectedRefund(refund);
                          setModalOpen(true);
                        }}
                        className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                      >
                        <EyeIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">Details</span>
                        <ChevronRightIcon className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Progress Bar for Processing */}
                    {isProcessing && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <ArrowPathIcon className="h-3 w-3 animate-spin" />
                            Processing refund...
                          </span>
                          <span className="text-gray-400">3-7 business days</span>
                        </div>
                        <div className="mt-1.5 w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full w-2/3 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full animate-pulse" />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== REFUND DETAIL MODAL ===== */}
      <AnimatePresence>
        {modalOpen && selectedRefund && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <ReceiptRefundIcon className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Refund Details</h3>
                      <p className="text-xs text-gray-400">#{selectedRefund.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XCircleIcon className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                {/* Status Banner */}
                {(() => {
                  const Status = getStatusConfig(selectedRefund.refundStatus);
                  const StatusIcon = Status.icon;
                  return (
                    <div className={`flex items-center gap-3 p-4 rounded-xl ${Status.bg} border ${Status.border} mb-5`}>
                      <StatusIcon className={`h-5 w-5 ${Status.text}`} />
                      <div>
                        <p className={`font-medium ${Status.text}`}>Refund {Status.label}</p>
                        {selectedRefund.processedAt && (
                          <p className="text-xs text-gray-500">
                            Processed on {formatDateTime(selectedRefund.processedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Details Grid */}
                <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-700">
                  <div className="flex justify-between py-3">
                    <span className="text-sm text-gray-500">Event</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-[60%]">
                      {selectedRefund.eventTitle}
                    </span>
                  </div>
                  <div className="flex justify-between py-3">
                    <span className="text-sm text-gray-500">Vendor</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-[60%]">
                      {selectedRefund.vendorName}
                    </span>
                  </div>
                  <div className="flex justify-between py-3">
                    <span className="text-sm text-gray-500">Package</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-[60%]">
                      {selectedRefund.packageName}
                    </span>
                  </div>
                  <div className="flex justify-between py-3">
                    <span className="text-sm text-gray-500">Event Date</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(selectedRefund.eventDate)}
                    </span>
                  </div>
                  <div className="flex justify-between py-3">
                    <span className="text-sm text-gray-500">Amount Refunded</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      NPR {selectedRefund.refundAmount.toLocaleString()}
                    </span>
                  </div>
                  {selectedRefund.totalAmount && (
                    <div className="flex justify-between py-3">
                      <span className="text-sm text-gray-500">Original Amount</span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        NPR {selectedRefund.totalAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedRefund.refundPercentage !== null && (
                    <div className="flex justify-between py-3">
                      <span className="text-sm text-gray-500">Refund Percentage</span>
                      <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                        {selectedRefund.refundPercentage}%
                      </span>
                    </div>
                  )}

                  {/* ✅ Gateway Method - Real data only */}
                  {selectedRefund.refundMethod && (
                    (() => {
                      const Method = getMethodConfig(selectedRefund.refundMethod);
                      return (
                        <div className="flex justify-between py-3">
                          <span className="text-sm text-gray-500">Refund Method</span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${Method.bg} ${Method.text} border ${Method.border}`}>
                            <Method.icon className="h-3.5 w-3.5" />
                            {Method.label}
                          </span>
                        </div>
                      );
                    })()
                  )}

                  <div className="flex justify-between py-3">
                    <span className="text-sm text-gray-500">Requested On</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {formatDateTime(selectedRefund.createdAt)}
                    </span>
                  </div>
                  {selectedRefund.cancelledBy && (
                    <div className="flex justify-between py-3">
                      <span className="text-sm text-gray-500">Cancelled By</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {selectedRefund.cancelledBy === "VENDOR" ? "Vendor" : "You"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Cancellation Reason */}
                {selectedRefund.cancellationReason && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Cancellation Reason</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                      {selectedRefund.cancellationReason}
                    </p>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                  >
                    Close
                  </button>
                  <Link
                    href={`/my-bookings?tab=past`}
                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium text-center"
                  >
                    View Booking
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}