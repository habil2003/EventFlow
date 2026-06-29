"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeftIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyRupeeIcon,
  DocumentTextIcon,
  EyeIcon,
  XCircleIcon,
  ArrowPathIcon,
  UserIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  ChartBarIcon,
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
  refundReference: string | null;
  refundProcessedBy: string | null;
  refundProcessedAt: string | null;
  refundPercentage: number | null;
  refundKhaltiFee?: number | null;
  refundPlatformKeeps?: number | null;
  refundReason: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  daysUntilEvent?: number | null;
  createdAt: string;
  processedAt: string | null;
  gatewayResponse?: any;
}

// Helper function to format refund details based on type
function formatRefundDetails(gatewayResponse: any, refundStatus: string, refundMethod: string | null, refundPercentage: number | null, daysUntilEvent: number | null) {
  if (!gatewayResponse && refundStatus === "PROCESSED") {
    // Fallback for when gatewayResponse is missing but refund is processed
    return {
      type: "BASIC",
      title: "Refund Processed",
      details: [
        { label: "Refund Amount", value: refundPercentage ? `${refundPercentage}% of total` : null },
        { label: "Status", value: "Completed" },
      ].filter(d => d.value)
    };
  }

  // For PROCESSED refunds
  if (refundStatus === "PROCESSED") {
    // Khalti API Auto-Refund
    if (refundMethod === "KHALTI_API") {
      return {
        type: "API",
        title: "Auto-Refund via Khalti API",
        icon: BanknotesIcon,
        color: "purple",
        details: [
          { label: "Processed by", value: gatewayResponse?.processedBy || "System" },
          { label: "Processed at", value: gatewayResponse?.processedAt ? new Date(gatewayResponse.processedAt).toLocaleString() : null },
          { label: "Refund Percentage", value: refundPercentage ? `${refundPercentage}%` : null },
          { label: "Days Until Event", value: daysUntilEvent ? `${daysUntilEvent} days before event` : null },
          { label: "Khalti Fee", value: gatewayResponse?.khaltiFee ? `NPR ${gatewayResponse.khaltiFee.toLocaleString()}` : null },
          { label: "Transaction ID", value: gatewayResponse?.originalTxId || gatewayResponse?.refundId },
          { label: "API Response", value: gatewayResponse?.khaltiResponse?.detail || gatewayResponse?.message },
        ].filter(d => d.value)
      };
    }
    
    // Manual Refund (Bank, Cash, Cheque, etc.)
    if (refundMethod === "MANUAL" || ["BANK_TRANSFER", "CASH", "CHEQUE", "KHALTI_MANUAL"].includes(refundMethod || "")) {
      const methodNames: Record<string, string> = {
        "BANK_TRANSFER": "Bank Transfer",
        "CASH": "Cash",
        "CHEQUE": "Cheque",
        "KHALTI_MANUAL": "Khalti Dashboard",
        "MANUAL": "Manual"
      };
      
      return {
        type: "MANUAL",
        title: `Manual Refund: ${methodNames[refundMethod || "MANUAL"]}`,
        icon: BuildingOfficeIcon,
        color: "blue",
        details: [
          { label: "Reference Number", value: gatewayResponse?.transactionReference || refundReference },
          { label: "Processed by", value: gatewayResponse?.processedBy || "Admin" },
          { label: "Processed at", value: gatewayResponse?.processedAt ? new Date(gatewayResponse.processedAt).toLocaleString() : null },
          { label: "Refund Percentage", value: refundPercentage ? `${refundPercentage}%` : null },
          { label: "Notes", value: gatewayResponse?.adminNotes },
        ].filter(d => d.value)
      };
    }
  }

  // For PENDING_ADMIN refunds
  if (refundStatus === "PENDING_ADMIN") {
    return {
      type: "PENDING",
      title: "Pending Admin Review",
      icon: ClockIcon,
      color: "yellow",
      details: [
        { label: "Refund Amount", value: `NPR ${gatewayResponse?.refundAmount?.toLocaleString() || "Pending"}` },
        { label: "Refund Percentage", value: refundPercentage ? `${refundPercentage}%` : null },
        { label: "Days Until Event", value: daysUntilEvent ? `${daysUntilEvent} days before event` : null },
        { label: "Status", value: "Waiting for admin approval" },
        { label: "Expected Timeline", value: "3-7 business days" },
      ].filter(d => d.value)
    };
  }

  // For FAILED refunds
  if (refundStatus === "FAILED") {
    return {
      type: "FAILED",
      title: "Refund Failed",
      icon: XCircleIcon,
      color: "red",
      details: [
        { label: "Error", value: gatewayResponse?.error || gatewayResponse?.message || "Unknown error" },
        { label: "Attempted at", value: gatewayResponse?.attemptedAt ? new Date(gatewayResponse.attemptedAt).toLocaleString() : null },
        { label: "Processed by", value: gatewayResponse?.processedBy },
        { label: "Admin Notes", value: gatewayResponse?.adminNotes },
      ].filter(d => d.value)
    };
  }

  return null;
}

export default function MyRefundsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRefund, setSelectedRefund] = useState<RefundRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "PROCESSED" | "PENDING_ADMIN" | "FAILED">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showPolicyInfo, setShowPolicyInfo] = useState(false);

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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "PROCESSED":
        return {
          text: "Completed",
          badgeColor: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          iconColor: "text-green-600",
          bgColor: "bg-green-50 dark:bg-green-900/20",
          borderColor: "border-green-200 dark:border-green-800",
          icon: CheckCircleIcon,
        };
      case "PENDING_ADMIN":
        return {
          text: "Processing",
          badgeColor: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
          iconColor: "text-yellow-600",
          bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
          borderColor: "border-yellow-200 dark:border-yellow-800",
          icon: ClockIcon,
        };
      case "FAILED":
        return {
          text: "Failed",
          badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          iconColor: "text-red-600",
          bgColor: "bg-red-50 dark:bg-red-900/20",
          borderColor: "border-red-200 dark:border-red-800",
          icon: XCircleIcon,
        };
      default:
        return {
          text: status,
          badgeColor: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
          iconColor: "text-gray-500",
          bgColor: "bg-gray-50 dark:bg-gray-800",
          borderColor: "border-gray-200 dark:border-gray-700",
          icon: ClockIcon,
        };
    }
  };

  const getMethodConfig = (method: string | null) => {
    switch (method) {
      case "KHALTI_API":
        return {
          label: "Auto-Refund (Khalti API)",
          icon: BanknotesIcon,
          color: "purple",
        };
      case "BANK_TRANSFER":
        return {
          label: "Bank Transfer",
          icon: BuildingOfficeIcon,
          color: "blue",
        };
      case "KHALTI_MANUAL":
        return {
          label: "Khalti Dashboard Refund",
          icon: BanknotesIcon,
          color: "green",
        };
      case "CASH":
        return {
          label: "Cash Refund",
          icon: CurrencyRupeeIcon,
          color: "orange",
        };
      case "CHEQUE":
        return {
          label: "Cheque Refund",
          icon: DocumentTextIcon,
          color: "purple",
        };
      default:
        return {
          label: "Manual Refund",
          icon: DocumentTextIcon,
          color: "gray",
        };
    }
  };

  const getCancelledByInfo = (cancelledBy: string | null) => {
    if (cancelledBy === "CUSTOMER") {
      return { text: "You cancelled this booking", icon: UserIcon, color: "orange" };
    }
    if (cancelledBy === "VENDOR") {
      return { text: "Vendor declined the booking", icon: BuildingOfficeIcon, color: "red" };
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-NP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-NP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredRefunds = refunds.filter((refund) => {
    if (filter !== "all" && refund.refundStatus !== filter) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        refund.vendorName.toLowerCase().includes(searchLower) ||
        refund.eventTitle.toLowerCase().includes(searchLower) ||
        refund.packageName.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const stats = {
    total: refunds.length,
    processed: refunds.filter((r) => r.refundStatus === "PROCESSED").length,
    pending: refunds.filter((r) => r.refundStatus === "PENDING_ADMIN").length,
    failed: refunds.filter((r) => r.refundStatus === "FAILED").length,
    totalAmount: refunds.reduce((sum, r) => sum + r.refundAmount, 0),
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading your refunds...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "USER") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Header with Back Button */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <BanknotesIcon className="h-8 w-8 text-purple-600" />
                  My Refunds
                </h1>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  Track the status of your refund requests
                </p>
              </div>
            </div>
            
            {/* Refund Policy Info Button */}
            <button
              onClick={() => setShowPolicyInfo(!showPolicyInfo)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <InformationCircleIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Refund Policy</span>
            </button>
          </div>
        </div>

        {/* Refund Policy Info Panel */}
        <AnimatePresence>
          {showPolicyInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheckIcon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Refund Policy</h3>
                    <div className="space-y-3 text-sm text-blue-700 dark:text-blue-300">
                      <p>Refund amounts are calculated based on when you cancel relative to the event date:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
                          <div className="text-2xl font-bold text-green-600">100%</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">7+ days before event</div>
                          <div className="text-xs text-green-600 mt-1">Full refund</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-yellow-200 dark:border-yellow-800">
                          <div className="text-2xl font-bold text-yellow-600">50%</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">3-6 days before event</div>
                          <div className="text-xs text-yellow-600 mt-1">Partial refund</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-red-200 dark:border-red-800">
                          <div className="text-2xl font-bold text-red-600">0%</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Less than 3 days</div>
                          <div className="text-xs text-red-600 mt-1">No refund</div>
                        </div>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
                        Note: Khalti payment gateway fees are non-refundable. The platform fee is also non-refundable.
                        For vendor declines, you receive a 100% refund of the deposit paid.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Refunds</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <DocumentTextIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-500">{stats.processed}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Processing</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">{stats.pending}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-500">{stats.failed}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl shadow-sm border border-purple-100 dark:border-purple-800 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 dark:text-purple-400">Total Refunded</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  NPR {stats.totalAmount.toLocaleString()}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <CurrencyRupeeIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by vendor, event, or package..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: "all", label: "All", count: stats.total },
              { value: "PROCESSED", label: "Completed", count: stats.processed },
              { value: "PENDING_ADMIN", label: "Processing", count: stats.pending },
              { value: "FAILED", label: "Failed", count: stats.failed },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value as any)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  filter === option.value
                    ? "bg-indigo-600 text-white"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {option.label} ({option.count})
              </button>
            ))}
          </div>
        </div>

        {/* Refunds List */}
        {filteredRefunds.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
            <div className="flex flex-col items-center">
              <div className="h-20 w-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                <BanknotesIcon className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-lg">No refunds found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {searchTerm || filter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Refunds from cancelled bookings will appear here"}
              </p>
              <Link
                href="/my-bookings"
                className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                View My Bookings
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRefunds.map((refund, index) => {
              const StatusConfig = getStatusConfig(refund.refundStatus);
              const StatusIcon = StatusConfig.icon;
              const MethodInfo = getMethodConfig(refund.refundMethod);
              const CancelledInfo = getCancelledByInfo(refund.cancelledBy);
              const isProcessed = refund.refundStatus === "PROCESSED";
              const isPending = refund.refundStatus === "PENDING_ADMIN";

              return (
                <motion.div
                  key={refund.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -2 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-200"
                >
                  <div className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      {/* Left Section - Main Info */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between flex-wrap gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {refund.vendorName}
                              </h3>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${StatusConfig.badgeColor}`}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {StatusConfig.text}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                              {refund.packageName}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 mt-3">
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <CalendarIcon className="h-4 w-4 mr-1 text-indigo-500" />
                            {formatDate(refund.eventDate)}
                          </div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <BanknotesIcon className="h-4 w-4 mr-1 text-indigo-500" />
                            Refund Received: <span className="font-semibold text-green-600 dark:text-green-400 ml-1">NPR {refund.refundAmount.toLocaleString()}</span>
                          </div>
                          {refund.refundPercentage !== null && (
                            <div className="flex items-center text-sm">
                              <ChartBarIcon className="h-4 w-4 mr-1 text-indigo-500" />
                              <span className="text-gray-600 dark:text-gray-300">
                                {refund.refundPercentage}% of amount paid
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-2">
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            <span className="text-gray-500">Event:</span> {refund.eventTitle}
                          </p>
                        </div>

                        {/* Refund Percentage Badge */}
                        {refund.refundPercentage !== null && refund.refundPercentage > 0 && (
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircleIcon className="h-3 w-3" />
                            {refund.refundPercentage}% Refund Issued
                          </div>
                        )}

                        {/* Cancellation Info */}
                        {CancelledInfo && (
                          <div className="mt-2 flex items-center gap-1">
                            <CancelledInfo.icon className={`h-3 w-3 text-${CancelledInfo.color}-500`} />
                            <p className={`text-xs text-${CancelledInfo.color}-600 dark:text-${CancelledInfo.color}-400`}>
                              {CancelledInfo.text}
                            </p>
                            {refund.cancellationReason && (
                              <span className="text-xs text-gray-400 ml-1">
                                • Reason: {refund.cancellationReason}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right Section - Action */}
                      <div className="flex flex-col items-end gap-2 min-w-[140px]">
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Requested on</p>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {formatDate(refund.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedRefund(refund);
                            setModalOpen(true);
                          }}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-sm font-medium transition-colors w-full"
                        >
                          <EyeIcon className="h-4 w-4" />
                          View Details
                          <ChevronRightIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Timeline for Processing Status */}
                    {isPending && (
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ArrowPathIcon className="h-4 w-4 text-yellow-600 animate-spin" />
                            <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                              Refund in Progress
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">3-7 business days</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div className="bg-yellow-600 h-1.5 rounded-full w-2/3 animate-pulse"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Refund Details Modal */}
      <AnimatePresence>
        {modalOpen && selectedRefund && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-90 transition-opacity"
                onClick={() => setModalOpen(false)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative inline-block transform overflow-hidden rounded-xl bg-white dark:bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:align-middle"
              >
                <div className="bg-white dark:bg-gray-800">
                  {/* Modal Header */}
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                        <DocumentTextIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">Refund Details</h3>
                        <p className="text-xs text-purple-100">Reference: {selectedRefund.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </div>

                  {/* Modal Body */}
                  <div className="px-6 py-5">
                    {/* Status Banner */}
                    <div className={`mb-5 p-4 rounded-lg ${getStatusConfig(selectedRefund.refundStatus).bgColor} border ${getStatusConfig(selectedRefund.refundStatus).borderColor}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm`}>
                          {selectedRefund.refundStatus === "PROCESSED" && <CheckCircleIcon className={`h-5 w-5 text-green-600`} />}
                          {selectedRefund.refundStatus === "PENDING_ADMIN" && <ClockIcon className={`h-5 w-5 text-yellow-600`} />}
                          {selectedRefund.refundStatus === "FAILED" && <XCircleIcon className={`h-5 w-5 text-red-600`} />}
                        </div>
                        <div>
                          <p className={`font-semibold ${getStatusConfig(selectedRefund.refundStatus).iconColor}`}>
                            {selectedRefund.refundStatus === "PROCESSED" && "Refund Completed Successfully"}
                            {selectedRefund.refundStatus === "PENDING_ADMIN" && "Refund is Being Processed"}
                            {selectedRefund.refundStatus === "FAILED" && "Refund Failed"}
                          </p>
                          {selectedRefund.refundStatus === "PENDING_ADMIN" && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Your refund will reflect in your account within 3-7 business days.
                            </p>
                          )}
                          {selectedRefund.refundStatus === "PROCESSED" && selectedRefund.refundProcessedAt && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Processed on {formatDateTime(selectedRefund.refundProcessedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Two Column Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left Column */}
                      <div className="space-y-4">
                        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Booking Details</p>
                          <p className="font-medium text-gray-900 dark:text-white mt-1">{selectedRefund.vendorName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{selectedRefund.packageName}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{selectedRefund.eventTitle}</p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Event Date</p>
                          <div className="flex items-center gap-2 mt-1">
                            <CalendarIcon className="h-4 w-4 text-indigo-500" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {formatDate(selectedRefund.eventDate)}
                            </span>
                          </div>
                        </div>

                        {selectedRefund.cancelledBy && (
                          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cancellation</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                              {selectedRefund.cancelledBy === "CUSTOMER" ? "Cancelled by you" : "Declined by vendor"}
                            </p>
                            {selectedRefund.cancellationReason && (
                              <p className="text-xs text-gray-500 mt-1">Reason: {selectedRefund.cancellationReason}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right Column */}
                      <div className="space-y-4">
                        {/* Refund Amount Breakdown */}
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Refund Summary</p>
                          
                          {/* Refund Percentage */}
                          {selectedRefund.refundPercentage !== null && (
                            <div className="flex justify-between items-center mt-2 pt-1">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Refund Percentage:</span>
                              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                {selectedRefund.refundPercentage}%
                              </span>
                            </div>
                          )}
                          
                          {/* Refund Amount */}
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Amount Refunded:</span>
                            <span className="text-xl font-bold text-green-600 dark:text-green-400">
                              NPR {selectedRefund.refundAmount.toLocaleString()}
                            </span>
                          </div>

                          {/* Khalti Fee Deduction (if applicable) */}
                          {selectedRefund.refundKhaltiFee && selectedRefund.refundKhaltiFee > 0 && (
                            <div className="flex justify-between items-center mt-1 pt-1 border-t border-green-200 dark:border-green-800">
                              <span className="text-xs text-gray-500 dark:text-gray-400">Khalti Fee (non-refundable):</span>
                              <span className="text-xs text-red-500">- NPR {selectedRefund.refundKhaltiFee.toLocaleString()}</span>
                            </div>
                          )}

                          {/* Platform Keeps (if applicable) */}
                          {selectedRefund.refundPlatformKeeps && selectedRefund.refundPlatformKeeps > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-500 dark:text-gray-400">Platform Fee (non-refundable):</span>
                              <span className="text-xs text-red-500">- NPR {selectedRefund.refundPlatformKeeps.toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        {/* Refund Method Details - Using formatRefundDetails helper */}
                        {(selectedRefund.refundStatus === "PROCESSED" || selectedRefund.refundStatus === "PENDING_ADMIN" || selectedRefund.refundStatus === "FAILED") && (
                          (() => {
                            const formattedDetails = formatRefundDetails(
                              selectedRefund.gatewayResponse,
                              selectedRefund.refundStatus,
                              selectedRefund.refundMethod,
                              selectedRefund.refundPercentage,
                              selectedRefund.daysUntilEvent
                            );
                            
                            if (!formattedDetails) return null;
                            
                            const colorMap: Record<string, string> = {
                              API: "purple",
                              MANUAL: "blue",
                              PENDING: "yellow",
                              FAILED: "red",
                              BASIC: "gray"
                            };
                            
                            const color = colorMap[formattedDetails.type] || "gray";
                            const DetailIcon = formattedDetails.icon || DocumentTextIcon;
                            
                            return (
                              <div className={`bg-${color}-50 dark:bg-${color}-900/20 rounded-lg p-3 border border-${color}-200 dark:border-${color}-800`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <DetailIcon className={`h-5 w-5 text-${color}-600`} />
                                  <p className={`font-medium text-${color}-700 dark:text-${color}-400`}>
                                    {formattedDetails.title}
                                  </p>
                                </div>
                                <div className="space-y-1 text-sm">
                                  {formattedDetails.details.map((detail, idx) => (
                                    <p key={idx}>
                                      <span className="text-gray-500">{detail.label}:</span>{" "}
                                      <span className="text-gray-700 dark:text-gray-300">{detail.value}</span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                            );
                          })()
                        )}

                        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Request Date</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            {formatDateTime(selectedRefund.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Refund Reason */}
                    {selectedRefund.refundReason && (
                      <div className="mt-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Refund Reason</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                          {selectedRefund.refundReason}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Close
                    </button>
                    <Link
                      href={`/my-bookings?tab=past`}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      View Related Booking
                    </Link>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}