"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,

  BuildingOfficeIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  EyeIcon,
  PhotoIcon,
  UserIcon,
  MapPinIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

interface Payout {
  id: string;
  type?: string;
  amount?: number;
  vendorPayout?: number;
  platformCommission?: number;
  status?: string;
  parentPayoutId?: string | null;
  ticketCount?: number;
  bookingIds?: string[];
  payoutIds?: string[];
  eventTitle?: string;
  isBulk?: boolean;
  individualPayouts?: Array<{
    id: string;
    customerName?: string;
    amount?: number;
    payout?: number;
    payoutId?: string | null;
  }>;
}

interface EscrowBooking {
  id: string;
  type: "VENDOR" | "TICKET";
  eventTitle: string;
  eventDate: string;
  vendorName?: string;
  organizerName?: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  depositAmount?: number;
  remainingAmount?: number;
  platformCommission?: number;
  organizerPayout?: number;
  paymentStatus: string;
  isCompleted?: boolean;
  canRelease?: boolean;
  location?: string;
  depositPaidAt?: string | null;
  remainingPaidAt?: string | null;
  hasDepositPayout?: boolean;
  hasRemainingPayout?: boolean;
  hasPendingPayout?: boolean;
  pendingPayouts: Payout[];
  customerPaidDeposit?: boolean;
  customerPaidFull?: boolean;
  amountReleasedAt?: string | null;
  availableActions?: string[];
  vendorPaymentStatus?: string;
  depositReleasedAt?: string | null;
  bookingStatus?: string;
  vendorAccepted?: boolean;
  vendorPending?: boolean;
  vendorDeclined?: boolean;
  vendorStatusDisplay?: string;
  vendorStatusColor?: string;
  depositReleaseDisabledReason?: string | null;
  canBulkRelease?: boolean;
  bulkReleaseType?: string | null;
  ticketNumber?: string;
  hasParentPayout?: boolean;
  // ✅ New display fields
  displayAmount?: number;
  displayCommission?: number;
  displayPayout?: number;
  vendorMarkedComplete?: boolean;
  customerConfirmed?: boolean;
}

interface EventGroup {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  organizerName: string;
  organizerId: string;
  bookings: EscrowBooking[];
  totalAmount: number;
  totalCommission: number;
  organizerPayout: number;
  count: number;
  bookingIds: string[];
  canBulkReleaseAll: boolean;
  displayCount?: number;
  heldCount?: number;
  processingCount?: number;
  bulkReleaseCount?: number;
  bulkTotalAmount?: number;
  bulkTotalCommission?: number;
  bulkOrganizerPayout?: number;
}

export default function AdminEscrowPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [bookings, setBookings] = useState<EscrowBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<EscrowBooking | null>(
    null,
  );
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<
    "deposit" | "remaining" | "ticket" | "all" | null
  >(null);
  const [escrowType, setEscrowType] = useState<"all" | "VENDOR" | "TICKET">(
    "all",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "HELD_IN_ESCROW" | "PROCESSING_PAYOUT"
  >("all");

  const [bulkReleasing, setBulkReleasing] = useState(false);
  const [bulkReleaseModalOpen, setBulkReleaseModalOpen] = useState(false);
  const [selectedEventGroup, setSelectedEventGroup] =
    useState<EventGroup | null>(null);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [verificationData, setVerificationData] = useState({
    transactionReference: "",
    transferMethod: "BANK_TRANSFER",
    proofImage: null as File | null,
    notes: "",
  });
  const [uploading, setUploading] = useState(false);

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

  const fetchEscrowData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/escrow");
      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || []);
      }
    } catch (error) {
      console.error("Error fetching escrow data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEscrowData();
  }, []);

  const releaseFunds = async (
    bookingId: string,
    amount: number,
    type: string,
  ) => {
    const amountNPR = amount.toLocaleString();
    const commission = Math.round(amount * 0.1).toLocaleString();
    const payout = Math.round(amount * 0.9).toLocaleString();

    let confirmMessage = "";
    if (type === "ticket") {
      confirmMessage = `Release TICKET funds of NPR ${amountNPR}?\n\n• Platform Commission (10%): NPR ${commission}\n• Organizer will receive: NPR ${payout}\n\nAfter this, you will need to manually transfer the money to the organizer and verify.`;
    } else if (type === "deposit") {
      confirmMessage = `Release DEPOSIT of NPR ${amountNPR}?\n\n• Platform Commission (10%): NPR ${commission}\n• Vendor will receive: NPR ${payout}\n\nAfter this, you will need to manually transfer the money to the vendor and verify.`;
    } else if (type === "all") {
      confirmMessage = `Release FULL amount of NPR ${amountNPR}?\n\n• Platform Commission (10%): NPR ${commission}\n• Vendor will receive: NPR ${payout}\n\nAfter this, you will need to manually transfer the money to the vendor and verify.`;
    } else {
      confirmMessage = `Release REMAINING amount of NPR ${amountNPR}?\n\n• Platform Commission (10%): NPR ${commission}\n• Vendor will receive: NPR ${payout}\n\nAfter this, you will need to manually transfer the money to the vendor and verify.`;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    setReleasingId(bookingId);

    try {
      const response = await fetch("/api/admin/release-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, amount, type }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          text:
            data.message ||
            "Release initiated! Please manually transfer funds and verify.",
          type: "success",
        });
        setReleaseModalOpen(false);
        await fetchEscrowData();
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({
          text: data.error || "Failed to release funds",
          type: "error",
        });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error) {
      console.error("Error releasing funds:", error);
      setMessage({
        text: "Error releasing funds. Please try again.",
        type: "error",
      });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setReleasingId(null);
    }
  };

  const handleBulkRelease = async () => {
    if (!selectedEventGroup || selectedEventGroup.bookingIds.length === 0)
      return;

    setBulkReleasing(true);
    setBulkReleaseModalOpen(false);

    try {
      const response = await fetch("/api/admin/release-funds/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingIds: selectedEventGroup.bookingIds,
          eventId: selectedEventGroup.eventId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const successCount = data.summary?.successCount || 0;
        const failCount = data.summary?.failureCount || 0;
        const totalAmount = data.summary?.totalAmount || 0;

        setMessage({
          text: `✅ Bulk release completed! ${successCount} tickets released for "${selectedEventGroup.eventTitle}". Total: NPR ${totalAmount.toLocaleString()}. ${failCount > 0 ? `${failCount} failed.` : ""}`,
          type: successCount > 0 ? "success" : "error",
        });
        await fetchEscrowData();
        setTimeout(() => setMessage(null), 8000);
      } else {
        setMessage({
          text: data.error || "Bulk release failed",
          type: "error",
        });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error) {
      console.error("Error in bulk release:", error);
      setMessage({ text: "Error performing bulk release", type: "error" });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setBulkReleasing(false);
      setSelectedEventGroup(null);
    }
  };

  const verifyPayout = async () => {
    if (!selectedPayout) {
      return;
    }

    if (
      !verificationData.transactionReference ||
      !verificationData.proofImage
    ) {
      alert("Please provide transaction reference and proof image");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", verificationData.proofImage);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      const proofImageUrl = uploadData.url;

      if (
        selectedPayout.isBulk &&
        selectedPayout.payoutIds &&
        selectedPayout.payoutIds.length > 0
      ) {
        console.log("Sending bulk verification:", {
          eventId: selectedPayout.eventTitle,
          bookingIds: selectedPayout.bookingIds,
          payoutIds: selectedPayout.payoutIds,
        });

        const response = await fetch("/api/admin/verify-payout/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: selectedPayout.eventTitle,
            bookingIds: selectedPayout.bookingIds,
            payoutIds: selectedPayout.payoutIds,
            transactionReference: verificationData.transactionReference,
            proofImageUrl: proofImageUrl,
            transferMethod: verificationData.transferMethod,
            notes: verificationData.notes,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setMessage({
            text: `✅ Bulk verification completed! ${data.totalProcessed} payouts confirmed.`,
            type: "success",
          });
          setShowVerifyModal(false);
          setVerificationData({
            transactionReference: "",
            transferMethod: "BANK_TRANSFER",
            proofImage: null,
            notes: "",
          });
          fetchEscrowData();
          setTimeout(() => setMessage(null), 5000);
        } else {
          console.error("Bulk verification error:", data);
          setMessage({
            text: data.error || "Bulk verification failed",
            type: "error",
          });
          setTimeout(() => setMessage(null), 5000);
        }
      } else {
        const response = await fetch("/api/admin/verify-payout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payoutId: selectedPayout.id,
            transactionReference: verificationData.transactionReference,
            proofImageUrl: proofImageUrl,
            transferMethod: verificationData.transferMethod,
            notes: verificationData.notes,
          }),
        });

        if (response.ok) {
          setMessage({
            text: "✅ Bank transfer confirmed and marked as paid!",
            type: "success",
          });
          setShowVerifyModal(false);
          setVerificationData({
            transactionReference: "",
            transferMethod: "BANK_TRANSFER",
            proofImage: null,
            notes: "",
          });
          fetchEscrowData();
          setTimeout(() => setMessage(null), 3000);
        } else {
          const error = await response.json();
          setMessage({
            text: error.error || "Failed to confirm transfer",
            type: "error",
          });
          setTimeout(() => setMessage(null), 5000);
        }
      }
    } catch (error) {
      console.error("Error confirming transfer:", error);
      setMessage({ text: "Error confirming transfer", type: "error" });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setUploading(false);
    }
  };

  const openViewModal = (booking: EscrowBooking) => {
    setSelectedBooking(booking);
    setViewModalOpen(true);
  };

  const openReleaseModal = (
    booking: EscrowBooking,
    action: "deposit" | "remaining" | "ticket" | "all",
  ) => {
    setSelectedBooking(booking);
    setModalAction(action);
    setReleaseModalOpen(true);
  };

  const openVerifyModal = (payout: Payout) => {
    setSelectedPayout(payout);
    setShowVerifyModal(true);
  };

  const getReleaseStatusBadge = (booking: EscrowBooking) => {
    if (booking.paymentStatus === "PROCESSING_PAYOUT") {
      return {
        text: "Processing Payment",
        color:
          "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
        icon: ArrowPathIcon,
      };
    }

    if (booking.type === "VENDOR") {
      const fullyReleased =
        booking.hasRemainingPayout || booking.paymentStatus === "COMPLETED";

      if (fullyReleased) {
        return {
          text: "✅ Fully Released",
          color:
            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          icon: CheckCircleIcon,
        };
      }

      // ✅ CASE 1: FULLY_PAID + Both Confirmed → Ready to Release
      if (
        booking.vendorPaymentStatus === "FULLY_PAID" &&
        booking.vendorMarkedComplete === true &&
        booking.customerConfirmed === true &&
        !booking.hasRemainingPayout
      ) {
        return {
          text: "✅ Fully Paid - Ready to Release",
          color:
            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          icon: CheckCircleIcon,
        };
      }

      // ✅ CASE 2: FULLY_PAID + Waiting for Confirmations
      if (
        booking.vendorPaymentStatus === "FULLY_PAID" &&
        (!booking.vendorMarkedComplete || !booking.customerConfirmed)
      ) {
        const waitingFor: string[] = [];
        if (!booking.vendorMarkedComplete) waitingFor.push("Vendor");
        if (!booking.customerConfirmed) waitingFor.push("Customer");
        return {
          text: `⏳ Waiting for ${waitingFor.join(" & ")} Confirmation`,
          color:
            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
          icon: ClockIcon,
        };
      }

      // ✅ CASE 3: DEPOSIT_PAID → Deposit Ready
      if (booking.customerPaidDeposit && !booking.hasDepositPayout) {
        return {
          text: "Deposit Paid - Ready to Release",
          color:
            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
          icon: ClockIcon,
        };
      }

      // ✅ CASE 4: Deposit Released, Awaiting Remaining
      const depositReleasedByAdmin =
        booking.hasDepositPayout || !!booking.depositReleasedAt;
      if (depositReleasedByAdmin && !booking.customerPaidFull) {
        return {
          text: "Deposit Released - Awaiting Customer Payment",
          color:
            "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
          icon: ClockIcon,
        };
      }

      // ✅ CASE 5: Deposit Released, Remaining Ready
      if (
        depositReleasedByAdmin &&
        booking.customerPaidFull &&
        !booking.hasRemainingPayout
      ) {
        return {
          text: "Ready to Release Remaining",
          color:
            "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
          icon: BanknotesIcon,
        };
      }

      return {
        text: "Pending Payment",
        color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
        icon: ClockIcon,
      };
    }

    if (booking.type === "TICKET") {
      if (booking.isCompleted) {
        return {
          text: "Event Completed",
          color:
            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          icon: CheckCircleIcon,
        };
      }
      return {
        text: "Awaiting Event",
        color:
          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        icon: ClockIcon,
      };
    }

    return {
      text: "Unknown",
      color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
      icon: ClockIcon,
    };
  };

  const getVendorStatusBadge = (booking: EscrowBooking) => {
    if (booking.vendorAccepted) {
      return {
        text: "✓ Vendor Accepted",
        color:
          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        icon: CheckCircleIcon,
      };
    }
    if (booking.vendorPending) {
      return {
        text: "⏳ Waiting for Vendor",
        color:
          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        icon: ClockIcon,
      };
    }
    if (booking.vendorDeclined) {
      return {
        text: "✗ Vendor Declined",
        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        icon: XCircleIcon,
      };
    }
    return null;
  };

  const heldBookings = bookings.filter(
    (b) =>
      b.paymentStatus === "HELD_IN_ESCROW" ||
      b.paymentStatus === "PROCESSING_PAYOUT",
  );

  let filteredBookings = heldBookings.filter((b) => {
    if (escrowType === "all") return true;
    return b.type === escrowType;
  });

  if (searchTerm) {
    filteredBookings = filteredBookings.filter(
      (b) =>
        b.eventTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.vendorName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.organizerName || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }

  if (statusFilter !== "all") {
    filteredBookings = filteredBookings.filter(
      (b) => b.paymentStatus === statusFilter,
    );
  }

  const totalHeldAmount = heldBookings.reduce((sum, b) => {
    if (b.type === "VENDOR") {
      // ✅ If processing payout, check what's actually remaining in escrow
      if (b.paymentStatus === "PROCESSING_PAYOUT") {
        // For FULL release, nothing is left in escrow
        if (b.hasPendingPayout) {
          const pendingPayout = b.pendingPayouts[0];
          if (pendingPayout?.type === "FULL") {
            return sum + 0; // Full release → nothing left
          }
        }
        // For remaining release, only remaining is left
        return sum + (b.remainingAmount || 0);
      }
      // HELD_IN_ESCROW
      if (b.hasDepositPayout && !b.hasRemainingPayout) {
        return sum + (b.remainingAmount || 0);
      }
      return sum + (b.depositAmount || 0);
    }
    return sum + b.totalAmount;
  }, 0);

  const pendingVendorApproval = bookings.filter(
    (b) =>
      b.type === "VENDOR" &&
      b.vendorPending &&
      b.customerPaidDeposit &&
      !b.hasDepositPayout,
  ).length;

  const totalPendingVerification = heldBookings.filter(
    (b) => b.paymentStatus === "PROCESSING_PAYOUT",
  ).length;

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Loading escrow data...
          </p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Escrow Management
              </h1>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Manage funds held in escrow for vendor bookings and ticket sales
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin/payouts"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <DocumentTextIcon className="h-4 w-4" />
                <span className="text-sm font-medium">View Payout History</span>
              </Link>

              <button
                onClick={fetchEscrowData}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Refresh
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Message Alert */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-6 p-4 rounded-lg ${
                message.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
                  : "bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
              }`}
            >
              <div className="flex items-center">
                {message.type === "success" ? (
                  <CheckCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                ) : (
                  <XCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================ */}
        {/* SECTION 1: Escrow Overview */}
        {/* ============================================ */}
        <div className="flex items-center gap-3 mb-4">
          <BanknotesIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Escrow Overview
          </h2>
          <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Total in Escrow
                </p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                  NPR {totalHeldAmount.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <BanknotesIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {heldBookings.length} items in escrow
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Vendor Bookings
                </p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-500">
                  {heldBookings.filter((b) => b.type === "VENDOR").length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <BuildingOfficeIcon className="h-6 w-6 text-purple-600 dark:text-purple-500" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Ticket Sales
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-500">
                  {heldBookings.filter((b) => b.type === "TICKET").length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <BanknotesIcon className="h-6 w-6 text-blue-600 dark:text-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Processing Payments
                </p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-500">
                  {totalPendingVerification}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                {totalPendingVerification > 0 ? (
                  <ArrowPathIcon className="h-6 w-6 text-purple-600 dark:text-purple-500 animate-spin" />
                ) : (
                  <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-500" />
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {totalPendingVerification > 0
                ? "Awaiting manual transfer confirmation"
                : "All payouts completed"}
            </p>
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 2: Pending Actions */}
        {/* ============================================ */}
        <div className="flex items-center gap-3 mb-4 mt-8">
          <ClockIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Pending Actions
          </h2>
          <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
        </div>

        {/* Awaiting Vendor Approval Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Awaiting Vendor Approval
              </p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-500">
                {pendingVendorApproval}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <ClockIcon className="h-6 w-6 text-orange-600 dark:text-orange-500" />
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Deposit paid, waiting for vendor
          </p>
        </div>

        {/* ============================================ */}
        {/* SECTION 3: Manage Bookings */}
        {/* ============================================ */}
        <div className="flex items-center gap-3 mb-4 mt-8">
          <DocumentTextIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Manage Bookings
          </h2>
          <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by event, vendor, customer, or email..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEscrowType("all")}
              className={`px-3 py-2 text-sm rounded-lg font-medium ${
                escrowType === "all"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              All ({heldBookings.length})
            </button>
            <button
              onClick={() => setEscrowType("VENDOR")}
              className={`px-3 py-2 text-sm rounded-lg font-medium ${
                escrowType === "VENDOR"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              Vendors ({heldBookings.filter((b) => b.type === "VENDOR").length})
            </button>
            <button
              onClick={() => setEscrowType("TICKET")}
              className={`px-3 py-2 text-sm rounded-lg font-medium ${
                escrowType === "TICKET"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              Tickets ({heldBookings.filter((b) => b.type === "TICKET").length})
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "HELD_IN_ESCROW" | "PROCESSING_PAYOUT",
              )
            }
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">All Status</option>
            <option value="HELD_IN_ESCROW">Held in Escrow</option>
            <option value="PROCESSING_PAYOUT">Processing</option>
          </select>
        </div>

        {/* Escrow Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Individual Bookings
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Release funds for individual bookings
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Event / Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Vendor/Organizer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Payment Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Vendor Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredBookings.map((booking) => {
                  const statusBadge = getReleaseStatusBadge(booking);
                  const StatusIcon = statusBadge.icon;
                  const isProcessingPayout =
                    booking.paymentStatus === "PROCESSING_PAYOUT";
                  const vendorStatusBadge =
                    booking.type === "VENDOR"
                      ? getVendorStatusBadge(booking)
                      : null;

                  return (
                    <tr
                      key={booking.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      {/* Type column */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            booking.type === "VENDOR"
                              ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                          }`}
                        >
                          {booking.type === "VENDOR" ? "Vendor" : "Ticket"}
                        </span>
                      </td>

                      {/* Event / Customer column */}
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {booking.eventTitle}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <UserIcon className="h-3 w-3 text-gray-400" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {booking.customerName}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {booking.customerEmail}
                        </p>
                      </td>

                      {/* Vendor/Organizer column */}
                      <td className="px-6 py-4">
                        <p className="text-gray-900 dark:text-white font-medium">
                          {booking.type === "VENDOR"
                            ? booking.vendorName
                            : booking.organizerName}
                        </p>
                        {booking.type === "VENDOR" && booking.location && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPinIcon className="h-3 w-3 text-gray-400" />
                            <p className="text-xs text-gray-500">
                              {booking.location}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Amount column */}
                      <td className="px-6 py-4">
                        <p className="font-semibold text-green-600">
                          NPR{" "}
                          {(
                            booking.displayAmount || booking.totalAmount
                          )?.toLocaleString()}
                        </p>
                        {booking.type === "VENDOR" &&
                          booking.remainingAmount &&
                          !booking.hasRemainingPayout &&
                          booking.vendorPaymentStatus !== "FULLY_PAID" &&
                          booking.vendorPaymentStatus !==
                            "PROCESSING_PAYOUT" && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              Remaining: NPR{" "}
                              {booking.remainingAmount.toLocaleString()}
                            </p>
                          )}
                      </td>

                      {/* Commission column */}
                      <td className="px-6 py-4">
                        <p className="text-sm text-purple-600 dark:text-purple-400">
                          NPR{" "}
                          {(
                            booking.displayCommission ||
                            (booking.depositAmount || 0) * 0.1
                          )?.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          10% platform fee
                        </p>
                      </td>

                      {/* Payment Status column */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}
                        >
                          <StatusIcon
                            className={`h-3 w-3 mr-1 ${isProcessingPayout ? "animate-spin" : ""}`}
                          />
                          {statusBadge.text}
                        </span>
                      </td>

                      {/* Vendor Status column */}
                      <td className="px-6 py-4">
                        {booking.type === "VENDOR" && vendorStatusBadge ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${vendorStatusBadge.color}`}
                          >
                            <vendorStatusBadge.icon className="h-3 w-3 mr-1" />
                            {vendorStatusBadge.text}
                          </span>
                        ) : booking.type === "TICKET" ? (
                          <span className="text-xs text-gray-400">N/A</span>
                        ) : null}
                      </td>

                      {/* Actions column */}
                      <td className="px-6 py-4">
                        <div className="flex gap-2 flex-wrap">
                          {/* View Details Button */}
                          <button
                            onClick={() => openViewModal(booking)}
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <EyeIcon className="h-4 w-4 inline mr-1" />
                            Details
                          </button>

                          {/* ─── RELEASE DEPOSIT ──────────────────────────────────────── */}
                          {/* Scenario 1: DEPOSIT_PAID */}
                          {booking.availableActions?.includes(
                            "RELEASE_DEPOSIT",
                          ) && (
                            <button
                              onClick={() =>
                                openReleaseModal(booking, "deposit")
                              }
                              disabled={releasingId === booking.id}
                              className="px-3 py-1.5 text-sm rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                              title={booking.depositReleaseDisabledReason || ""}
                            >
                              <BanknotesIcon className="h-4 w-4 inline mr-1" />
                              Release Deposit
                            </button>
                          )}

                          {/* ─── RELEASE FULL ────────────────────────────────────────── */}
                          {/* Scenario 2: FULLY_PAID + No releases */}
                          {booking.availableActions?.includes(
                            "RELEASE_FULL",
                          ) && (
                            <button
                              onClick={() => openReleaseModal(booking, "all")}
                              disabled={releasingId === booking.id}
                              className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              <BanknotesIcon className="h-4 w-4 inline mr-1" />
                              Release Full Amount
                            </button>
                          )}

                          {/* ─── RELEASE REMAINING ───────────────────────────────────── */}
                          {/* Scenario 3: FULLY_PAID + Deposit already released */}
                          {booking.availableActions?.includes(
                            "RELEASE_REMAINING",
                          ) && (
                            <button
                              onClick={() =>
                                openReleaseModal(booking, "remaining")
                              }
                              disabled={releasingId === booking.id}
                              className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                              <BanknotesIcon className="h-4 w-4 inline mr-1" />
                              Release Remaining
                            </button>
                          )}

                          {/* ─── RELEASE TICKET ───────────────────────────────────────── */}
                          {booking.type === "TICKET" && (
                            <button
                              onClick={() =>
                                openReleaseModal(booking, "ticket")
                              }
                              disabled={!booking.canRelease}
                              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                !booking.canRelease
                                  ? "bg-gray-400 dark:bg-gray-600 text-white cursor-not-allowed"
                                  : "bg-indigo-600 text-white hover:bg-indigo-700"
                              }`}
                            >
                              Release Funds
                            </button>
                          )}

                          {/* ─── CONFIRM TRANSFER ────────────────────────────────────── */}
                          {booking.paymentStatus === "PROCESSING_PAYOUT" &&
                            booking.pendingPayouts &&
                            booking.pendingPayouts.length > 0 && (
                              <button
                                onClick={() => {
                                  if (
                                    booking.pendingPayouts &&
                                    booking.pendingPayouts.length > 0
                                  ) {
                                    openVerifyModal(booking.pendingPayouts[0]);
                                  }
                                }}
                                className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                              >
                                <CheckCircleIcon className="h-4 w-4 inline mr-1" />
                                Confirm Transfer
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredBookings.length === 0 && (
            <div className="text-center py-12">
              <CheckCircleIcon className="h-12 w-12 mx-auto text-green-400 dark:text-green-500 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                No funds held in escrow
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                All bookings have been processed
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ============================================ */}
      {/* VIEW DETAILS MODAL */}
      {/* ============================================ */}
      <AnimatePresence>
        {viewModalOpen && selectedBooking && (
          <div className="fixed inset-0 z-[100] overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-90 transition-opacity"
                onClick={() => setViewModalOpen(false)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative inline-block transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle"
              >
                <div className="bg-white dark:bg-gray-800 px-6 pt-5 pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 sm:mx-0 sm:h-10 sm:w-10">
                      <DocumentTextIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                        Booking Details
                      </h3>

                      <div className="mt-4 space-y-3">
                        {/* ─── STATUS BADGE ────────────────────────────────────── */}
                        {(() => {
                          const statusBadge =
                            getReleaseStatusBadge(selectedBooking);
                          const StatusIcon = statusBadge.icon;
                          return (
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Current Status
                              </p>
                              <div className="mt-1">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}
                                >
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusBadge.text}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* ─── EVENT INFO ──────────────────────────────────────── */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Event
                          </p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedBooking.eventTitle}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <CalendarIcon className="h-3 w-3 text-gray-400" />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(
                                selectedBooking.eventDate,
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* ─── VENDOR/ORGANIZER ────────────────────────────────── */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {selectedBooking.type === "VENDOR"
                              ? "Vendor"
                              : "Organizer"}
                          </p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedBooking.type === "VENDOR"
                              ? selectedBooking.vendorName
                              : selectedBooking.organizerName}
                          </p>
                          {selectedBooking.type === "VENDOR" &&
                            selectedBooking.location && (
                              <div className="flex items-center gap-2 mt-1">
                                <MapPinIcon className="h-3 w-3 text-gray-400" />
                                <p className="text-xs text-gray-500">
                                  {selectedBooking.location}
                                </p>
                              </div>
                            )}
                        </div>

                        {/* ─── CUSTOMER INFO ───────────────────────────────────── */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Customer
                          </p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedBooking.customerName}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {selectedBooking.customerEmail}
                          </p>
                        </div>

                        {/* ─── PAYMENT BREAKDOWN ───────────────────────────────── */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                              Total Amount:
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              NPR {selectedBooking.totalAmount.toLocaleString()}
                            </span>
                          </div>

                          {selectedBooking.type === "VENDOR" && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                  Deposit Amount:
                                </span>
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  NPR{" "}
                                  {selectedBooking.depositAmount?.toLocaleString()}
                                </span>
                              </div>

                              {selectedBooking.hasDepositPayout && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Deposit Released to Vendor:
                                  </span>
                                  <span className="text-blue-600 dark:text-blue-400">
                                    NPR{" "}
                                    {Math.round(
                                      (selectedBooking.depositAmount || 0) *
                                        0.9,
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              )}

                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                  Remaining Amount:
                                </span>
                                <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                                  NPR{" "}
                                  {selectedBooking.remainingAmount?.toLocaleString()}
                                </span>
                              </div>

                              {/* ✅ FIXED: Remaining Payment Status */}
                              {selectedBooking.vendorPaymentStatus ===
                                "DEPOSIT_PAID" &&
                                !selectedBooking.customerPaidFull && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">
                                      Remaining Payment Status:
                                    </span>
                                    <span className="text-red-600 dark:text-red-400">
                                      Not Paid Yet
                                    </span>
                                  </div>
                                )}
                              {(selectedBooking.vendorPaymentStatus ===
                                "FULLY_PAID" ||
                                selectedBooking.vendorPaymentStatus ===
                                  "PROCESSING_PAYOUT") && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Remaining Payment Status:
                                  </span>
                                  <span className="text-green-600 dark:text-green-400">
                                    ✅ Paid
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {/* ✅ FIXED: Platform Fee - shows 10% of total for FULLY_PAID or PROCESSING_PAYOUT */}
                          <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-gray-600 dark:text-gray-400">
                              Platform Fee (10%):
                            </span>
                            <span className="text-purple-600 dark:text-purple-400">
                              -NPR{" "}
                              {(() => {
                                let amount = 0;
                                if (selectedBooking.type === "VENDOR") {
                                  // ✅ For FULLY_PAID or PROCESSING_PAYOUT, use total amount
                                  if (
                                    selectedBooking.vendorPaymentStatus ===
                                      "FULLY_PAID" ||
                                    selectedBooking.vendorPaymentStatus ===
                                      "PROCESSING_PAYOUT"
                                  ) {
                                    amount = selectedBooking.totalAmount || 0;
                                  } else {
                                    amount = selectedBooking.depositAmount || 0;
                                  }
                                } else {
                                  amount = selectedBooking.totalAmount || 0;
                                }
                                return Math.round(
                                  amount * 0.1,
                                ).toLocaleString();
                              })()}
                            </span>
                          </div>
                        </div>

                        {/* ─── WARNING MESSAGES ────────────────────────────────── */}

                        {/* ✅ CASE 1: DEPOSIT PAID + NOT FULLY PAID → Show Deposit Ready */}
                        {selectedBooking.type === "VENDOR" &&
                          !selectedBooking.hasDepositPayout &&
                          selectedBooking.customerPaidDeposit &&
                          selectedBooking.vendorPaymentStatus !==
                            "FULLY_PAID" &&
                          selectedBooking.vendorPaymentStatus !==
                            "PROCESSING_PAYOUT" && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                              <div className="flex items-start">
                                <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                    Deposit Ready for Release
                                  </p>
                                  <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                                    Customer has paid the deposit. You can now
                                    release the deposit to the vendor.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* ✅ CASE 2: FULLY_PAID + NO RELEASES → Show Fully Paid - Ready */}
                        {selectedBooking.type === "VENDOR" &&
                          selectedBooking.vendorPaymentStatus ===
                            "FULLY_PAID" &&
                          !selectedBooking.hasDepositPayout &&
                          !selectedBooking.hasRemainingPayout && (
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                              <div className="flex items-start">
                                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                    Fully Paid - Ready to Release
                                  </p>
                                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                                    Customer has paid the full amount. You can
                                    release the full amount to the vendor.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* ✅ CASE 3: PROCESSING PAYOUT (AFTER RELEASE) → Show Processing */}
                        {selectedBooking.type === "VENDOR" &&
                          selectedBooking.paymentStatus ===
                            "PROCESSING_PAYOUT" && (
                            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                              <div className="flex items-start">
                                <ArrowPathIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2 flex-shrink-0 mt-0.5 animate-spin" />
                                <div>
                                  <p className="text-sm font-medium text-purple-700 dark:text-purple-400">
                                    Processing Payment
                                  </p>
                                  <p className="text-xs text-purple-600 dark:text-purple-500 mt-1">
                                    Funds have been released and are awaiting
                                    admin confirmation of manual transfer.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* ✅ CASE 4: DEPOSIT RELEASED, AWAITING REMAINING */}
                        {selectedBooking.type === "VENDOR" &&
                          selectedBooking.hasDepositPayout &&
                          !selectedBooking.customerPaidFull && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                              <div className="flex items-start">
                                <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                                    Awaiting Customer Payment
                                  </p>
                                  <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                                    Deposit has been released to vendor.
                                    Customer has not paid the remaining amount
                                    yet. Once customer pays, you can release the
                                    remaining funds.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* ✅ CASE 5: DEPOSIT RELEASED, REMAINING READY */}
                        {selectedBooking.type === "VENDOR" &&
                          selectedBooking.customerPaidFull &&
                          selectedBooking.hasDepositPayout &&
                          !selectedBooking.hasRemainingPayout && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
                              <div className="flex items-start">
                                <CheckCircleIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
                                    Ready to Release Remaining
                                  </p>
                                  <p className="text-xs text-indigo-600 dark:text-indigo-500 mt-1">
                                    Customer has paid the remaining amount. You
                                    can now release the remaining funds to the
                                    vendor.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* ✅ CASE 6: FULLY RELEASED */}
                        {selectedBooking.type === "VENDOR" &&
                          selectedBooking.hasRemainingPayout && (
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                              <div className="flex items-start">
                                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                    ✅ Fully Released
                                  </p>
                                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                                    All funds have been released to the vendor.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* Ticket Event Completed */}
                        {selectedBooking.type === "TICKET" &&
                          selectedBooking.isCompleted && (
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                              <div className="flex items-start">
                                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                    Event Completed
                                  </p>
                                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                                    Event has been marked as completed. You can
                                    now release the ticket funds to the
                                    organizer.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-3 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="button"
                    onClick={() => setViewModalOpen(false)}
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* RELEASE MODAL - Universal with Type Checking */}
      {/* ============================================ */}
      <AnimatePresence>
        {releaseModalOpen && selectedBooking && modalAction && (
          <div className="fixed inset-0 z-[100] overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-90 transition-opacity"
                onClick={() => setReleaseModalOpen(false)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative inline-block transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle"
              >
                <div className="bg-white dark:bg-gray-800 px-6 pt-5 pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 sm:mx-0 sm:h-10 sm:w-10">
                      <BanknotesIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                        {selectedBooking.type === "TICKET"
                          ? "Release Ticket Funds"
                          : modalAction === "deposit"
                            ? "Release Deposit Funds"
                            : modalAction === "all"
                              ? "Release Full Amount"
                              : "Release Remaining Funds"}
                      </h3>

                      <div className="mt-4 space-y-3">
                        {/* Event Info */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Event
                          </p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedBooking.eventTitle}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {new Date(
                              selectedBooking.eventDate,
                            ).toLocaleDateString()}
                          </p>
                        </div>

                        {/* Vendor/Organizer */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {selectedBooking.type === "VENDOR"
                              ? "Vendor"
                              : "Organizer"}
                          </p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedBooking.type === "VENDOR"
                              ? selectedBooking.vendorName
                              : selectedBooking.organizerName}
                          </p>
                        </div>

                        {/* Customer Info */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Customer
                          </p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedBooking.customerName}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {selectedBooking.customerEmail}
                          </p>
                        </div>

                        {/* Payment Breakdown */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                              Total Amount:
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              NPR {selectedBooking.totalAmount.toLocaleString()}
                            </span>
                          </div>

                          {selectedBooking.type === "VENDOR" && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                  Deposit Amount:
                                </span>
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  NPR{" "}
                                  {selectedBooking.depositAmount?.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                  Remaining Amount:
                                </span>
                                <span className="text-gray-900 dark:text-white font-medium">
                                  NPR{" "}
                                  {selectedBooking.remainingAmount?.toLocaleString()}
                                </span>
                              </div>
                            </>
                          )}

                          {/* Amount to Release */}
                          <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              Amount to Release:
                            </span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              NPR{" "}
                              {(() => {
                                let amount = 0;
                                if (selectedBooking.type === "TICKET") {
                                  amount = selectedBooking.totalAmount || 0;
                                } else if (modalAction === "deposit") {
                                  amount = selectedBooking.depositAmount || 0;
                                } else if (modalAction === "all") {
                                  amount = selectedBooking.totalAmount || 0;
                                } else {
                                  amount = selectedBooking.remainingAmount || 0;
                                }
                                return amount.toLocaleString();
                              })()}
                            </span>
                          </div>

                          {/* Platform Fee */}
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                              Platform Fee (10%):
                            </span>
                            <span className="text-purple-600 dark:text-purple-400">
                              -NPR{" "}
                              {(() => {
                                let amount = 0;
                                if (selectedBooking.type === "TICKET") {
                                  amount = selectedBooking.totalAmount || 0;
                                } else if (modalAction === "deposit") {
                                  amount = selectedBooking.depositAmount || 0;
                                } else if (modalAction === "all") {
                                  amount = selectedBooking.totalAmount || 0;
                                } else {
                                  amount = selectedBooking.remainingAmount || 0;
                                }
                                return Math.round(
                                  amount * 0.1,
                                ).toLocaleString();
                              })()}
                            </span>
                          </div>

                          {/* Recipient Receives */}
                          <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {selectedBooking.type === "VENDOR"
                                ? "Vendor"
                                : "Organizer"}{" "}
                              Receives:
                            </span>
                            <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                              NPR{" "}
                              {(() => {
                                let amount = 0;
                                if (selectedBooking.type === "TICKET") {
                                  amount = selectedBooking.totalAmount || 0;
                                } else if (modalAction === "deposit") {
                                  amount = selectedBooking.depositAmount || 0;
                                } else if (modalAction === "all") {
                                  amount = selectedBooking.totalAmount || 0;
                                } else {
                                  amount = selectedBooking.remainingAmount || 0;
                                }
                                return Math.round(
                                  amount * 0.9,
                                ).toLocaleString();
                              })()}
                            </span>
                          </div>
                        </div>

                        {/* Manual Transfer Warning */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                          <div className="flex items-start">
                            <InformationCircleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                                Manual Transfer Required
                              </p>
                              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                                After confirming, you will need to manually
                                transfer the money to the{" "}
                                {selectedBooking.type === "VENDOR"
                                  ? "vendor"
                                  : "organizer"}{" "}
                                via bank transfer, then confirm the transfer
                                with proof.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-3 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      let amount = 0;
                      if (selectedBooking.type === "TICKET") {
                        amount = selectedBooking.totalAmount || 0;
                      } else if (modalAction === "deposit") {
                        amount = selectedBooking.depositAmount || 0;
                      } else if (modalAction === "all") {
                        amount = selectedBooking.totalAmount || 0;
                      } else {
                        amount = selectedBooking.remainingAmount || 0;
                      }
                      const releaseType =
                        selectedBooking.type === "TICKET"
                          ? "remaining"
                          : modalAction;
                      releaseFunds(selectedBooking.id, amount, releaseType);
                    }}
                    disabled={releasingId === selectedBooking.id}
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 transition-colors"
                  >
                    {releasingId === selectedBooking.id ? (
                      <>
                        <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Confirm Release"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReleaseModalOpen(false)}
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* BULK RELEASE CONFIRMATION MODAL */}
      {/* ============================================ */}
      <AnimatePresence>
        {bulkReleaseModalOpen && selectedEventGroup && (
          <div className="fixed inset-0 z-[150] overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-90 transition-opacity"
                onClick={() => setBulkReleaseModalOpen(false)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative inline-block transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle"
              >
                <div className="bg-white dark:bg-gray-800 px-6 pt-5 pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 sm:mx-0 sm:h-10 sm:w-10">
                      <BanknotesIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                        Bulk Release All Tickets
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Release all {selectedEventGroup.count} ticket(s) for
                        this event at once
                      </p>

                      <div className="mt-4 space-y-3">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Event
                          </p>
                          <p className="font-medium text-gray-900 dark:text-white text-lg">
                            {selectedEventGroup.eventTitle}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <CalendarIcon className="h-3 w-3 text-gray-400" />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(
                                selectedEventGroup.eventDate,
                              ).toLocaleDateString()}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Organizer: {selectedEventGroup.organizerName}
                          </p>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                              Number of Tickets:
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {selectedEventGroup.count}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                              Total Sales:
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              NPR{" "}
                              {selectedEventGroup.totalAmount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                              Platform Fee (10%):
                            </span>
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              -NPR{" "}
                              {selectedEventGroup.totalCommission.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              Organizer Receives:
                            </span>
                            <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                              NPR{" "}
                              {selectedEventGroup.organizerPayout.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg max-h-32 overflow-y-auto">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tickets being released:
                          </p>
                          <div className="space-y-1">
                            {selectedEventGroup.bookings.map((booking) => (
                              <div
                                key={booking.id}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-gray-600 dark:text-gray-400">
                                  {booking.customerName}
                                </span>
                                <span className="text-gray-900 dark:text-white">
                                  NPR {booking.totalAmount.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                          <div className="flex items-start">
                            <InformationCircleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                                One Manual Transfer Required
                              </p>
                              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                                After confirming, you only need to make{" "}
                                <strong>ONE</strong> manual transfer to the
                                organizer for the total amount, then verify once
                                with proof.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-3 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="button"
                    onClick={handleBulkRelease}
                    disabled={bulkReleasing}
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 transition-colors"
                  >
                    {bulkReleasing ? (
                      <>
                        <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                        Releasing...
                      </>
                    ) : (
                      `Confirm Bulk Release (${selectedEventGroup.count} tickets)`
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkReleaseModalOpen(false);
                      setSelectedEventGroup(null);
                    }}
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* CONFIRM BANK TRANSFER MODAL */}
      {/* ============================================ */}
      <AnimatePresence>
        {showVerifyModal && selectedPayout && (
          <div className="fixed inset-0 z-[200] overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-90 transition-opacity"
                onClick={() => setShowVerifyModal(false)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative inline-block transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle"
              >
                <div className="bg-white dark:bg-gray-800 px-6 pt-5 pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 sm:mx-0 sm:h-10 sm:w-10">
                      <BanknotesIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                        Confirm Bank Transfer
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Confirm that you have transferred the money to the
                        vendor/organizer
                      </p>

                      <div className="mt-4 space-y-4">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {selectedPayout.isBulk
                              ? "Bulk Payout Details"
                              : "Payout Details"}
                          </p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            NPR {selectedPayout.vendorPayout?.toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Type: {selectedPayout.type}
                            {selectedPayout.ticketCount && (
                              <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
                                {selectedPayout.ticketCount} tickets
                              </span>
                            )}
                          </p>
                          {selectedPayout.individualPayouts &&
                            selectedPayout.isBulk && (
                              <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-2">
                                <p className="font-medium text-gray-600 dark:text-gray-300">
                                  Individual payouts:
                                </p>
                                {selectedPayout.individualPayouts.map(
                                  (p, i: number) => (
                                    <p key={i} className="flex justify-between">
                                      <span>
                                        {p.customerName || `Ticket ${i + 1}`}
                                      </span>
                                      <span>
                                        NPR {p.payout?.toLocaleString()}
                                      </span>
                                    </p>
                                  ),
                                )}
                                <div className="flex justify-between font-medium text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                                  <span>Total</span>
                                  <span>
                                    NPR{" "}
                                    {selectedPayout.vendorPayout?.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Transfer Method *
                          </label>
                          <select
                            value={verificationData.transferMethod}
                            onChange={(e) =>
                              setVerificationData({
                                ...verificationData,
                                transferMethod: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="BANK_TRANSFER">
                              🏦 Bank Transfer
                            </option>
                            <option value="CASH">💵 Cash (Office Visit)</option>
                            <option value="CHEQUE">📝 Cheque</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Transaction Reference Number *
                          </label>
                          <input
                            type="text"
                            value={verificationData.transactionReference}
                            onChange={(e) =>
                              setVerificationData({
                                ...verificationData,
                                transactionReference: e.target.value,
                              })
                            }
                            placeholder="e.g., BANK-20241215-001, CHQ-001"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Enter bank receipt number, cheque number, or
                            reference
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Upload Proof (Bank Transfer Receipt/Screenshot) *
                          </label>
                          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center relative hover:border-indigo-500 transition-colors">
                            {verificationData.proofImage ? (
                              <div className="space-y-2">
                                <PhotoIcon className="h-10 w-10 mx-auto text-green-500" />
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {verificationData.proofImage.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {(
                                    verificationData.proofImage.size / 1024
                                  ).toFixed(2)}{" "}
                                  KB
                                </p>
                                <button
                                  onClick={() =>
                                    setVerificationData({
                                      ...verificationData,
                                      proofImage: null,
                                    })
                                  }
                                  className="text-xs text-red-500 hover:text-red-600"
                                >
                                  Remove File
                                </button>
                              </div>
                            ) : (
                              <>
                                <PhotoIcon className="h-10 w-10 mx-auto text-gray-400" />
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                  Click or drag to upload
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                  JPEG, PNG, PDF (Max 5MB)
                                </p>
                                <input
                                  type="file"
                                  onChange={(e) =>
                                    setVerificationData({
                                      ...verificationData,
                                      proofImage: e.target.files?.[0] || null,
                                    })
                                  }
                                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                              </>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Admin Notes (Optional)
                          </label>
                          <textarea
                            rows={2}
                            value={verificationData.notes}
                            onChange={(e) =>
                              setVerificationData({
                                ...verificationData,
                                notes: e.target.value,
                              })
                            }
                            placeholder="Add internal notes about this transfer..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                          <div className="flex items-start gap-2">
                            <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                                Confirmation Required
                              </p>
                              <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                                I confirm that I have successfully transferred
                                the money to the vendor/organizer.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-3 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="button"
                    onClick={verifyPayout}
                    disabled={
                      !verificationData.transactionReference ||
                      !verificationData.proofImage ||
                      uploading
                    }
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "✅ Confirm Transfer"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowVerifyModal(false);
                      setVerificationData({
                        transactionReference: "",
                        transferMethod: "BANK_TRANSFER",
                        proofImage: null,
                        notes: "",
                      });
                    }}
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
