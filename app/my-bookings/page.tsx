"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BuildingOfficeIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon as PendingIcon,
  ArrowRightIcon,
  PlusIcon,
  EyeIcon,
  CurrencyRupeeIcon,
  HomeIcon,
  CalendarDaysIcon,
  FunnelIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import PaymentButton from "@/components/PaymentButton";

interface VendorBooking {
  id: string;
  vendorName: string;
  serviceType: string;
  packageName: string;
  totalAmount: number;
  depositAmount?: number;
  remainingAmount?: number;
  vendorPaymentStatus?: string;
  bookingStatus: string;
  paymentStatus: string;
  eventDate: string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  eventTitle: string;
  location: string;
  createdAt: string;
  declineReason?: string;
  // ✅ Refund & cancellation fields
  refundStatus?: string | null;
  refundAmount?: number | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  depositPaidAt?: string;
  remainingPaidAt?: string;
}

interface UmbrellaEvent {
  id: string;
  title: string;
  eventDate: string;
  guestCount: number;
  status: string;
  vendorCount: number;
  totalSpent: number;
  createdAt: string;
}

interface FilterState {
  search: string;
  vendorName: string;
  serviceType: string[];
  bookingStatus: string[];
  paymentStatus: string[];
  dateRange: "all" | "upcoming" | "past" | "thisMonth" | "nextMonth";
  minAmount: number | null;
  maxAmount: number | null;
}

const SERVICE_TYPES = [
  "catering", "venue", "photography", "decoration",
  "music", "florist", "transport", "other",
];
const BOOKING_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "COMPLETED"];
const PAYMENT_STATUSES = ["PENDING", "DEPOSIT_PAID", "FULLY_PAID"];

export default function MyBookingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [bookings, setBookings] = useState<VendorBooking[]>([]);
  const [umbrellaEvents, setUmbrellaEvents] = useState<UmbrellaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"upcoming" | "past" | "events">("upcoming");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [filters, setFilters] = useState<FilterState>({
    search: "", vendorName: "", serviceType: [], bookingStatus: [],
    paymentStatus: [], dateRange: "all", minAmount: null, maxAmount: null,
  });
  const [tempFilters, setTempFilters] = useState<FilterState>(filters);

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const paymentSuccess = searchParams.get("payment");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (tabParam === "events") setActiveView("events");
    else if (tabParam === "past") setActiveView("past");
    else if (tabParam === "upcoming") setActiveView("upcoming");
  }, [tabParam]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bookingsRes = await fetch("/api/user/vendor-bookings");
        const bookingsData = await bookingsRes.json();
        setBookings(bookingsData);

        const eventsRes = await fetch("/api/user/social-events");
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          setUmbrellaEvents(eventsData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ✅ Cancel with refund — for PENDING+deposit or ACCEPTED+deposit
  const handleCancelBooking = async (bookingId: string) => {
    const reason = prompt(
      "Reason for cancellation (optional):\n\nRefund policy:\n≥7 days before event: 100%\n3–6 days: 50%\n<3 days: No refund"
    );
    if (reason === null) return;
    if (!confirm("Are you sure you want to cancel this booking? This cannot be undone.")) return;

    setCancellingId(bookingId);
    try {
      const response = await fetch("/api/user/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          bookingType: "VENDOR",
          reason: reason || "No reason provided",
        }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        window.location.reload();
      } else {
        alert(data.error || "Failed to cancel booking");
      }
    } catch (error) {
      alert("An error occurred");
    } finally {
      setCancellingId(null);
    }
  };

  // ✅ Cancel without refund — PENDING + no deposit paid
  const cancelBookingNoDeposit = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking? This action cannot be undone.")) return;
    try {
      const response = await fetch(`/api/user/vendor-bookings/${bookingId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.ok) {
        setBookings(bookings.filter((b) => b.id !== bookingId));
        alert("Booking cancelled successfully");
      } else {
        alert(data.error || "Failed to cancel booking");
      }
    } catch (error) {
      alert("An error occurred");
    }
  };

  const isEventPast = (date: string) => new Date(date) < new Date();
  const isEventUpcoming = (date: string) => new Date(date) > new Date();

  const isDateInRange = (date: string, range: string): boolean => {
    const eventDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    switch (range) {
      case "upcoming": return eventDate >= today;
      case "past": return eventDate < today;
      case "thisMonth": return eventDate >= thisMonthStart && eventDate <= thisMonthEnd;
      case "nextMonth": return eventDate >= nextMonthStart && eventDate <= nextMonthEnd;
      default: return true;
    }
  };

  const applyFilters = (bookingsList: VendorBooking[]): VendorBooking[] =>
    bookingsList.filter((booking) => {
      if (filters.search &&
        !booking.vendorName.toLowerCase().includes(filters.search.toLowerCase()) &&
        !booking.eventTitle.toLowerCase().includes(filters.search.toLowerCase()) &&
        !booking.packageName.toLowerCase().includes(filters.search.toLowerCase()))
        return false;
      if (filters.vendorName && !booking.vendorName.toLowerCase().includes(filters.vendorName.toLowerCase()))
        return false;
      if (filters.serviceType.length > 0 && !filters.serviceType.includes(booking.serviceType?.toLowerCase() || ""))
        return false;
      if (filters.bookingStatus.length > 0 && !filters.bookingStatus.includes(booking.bookingStatus))
        return false;
      if (filters.paymentStatus.length > 0 && !filters.paymentStatus.includes(booking.vendorPaymentStatus || ""))
        return false;
      if (filters.dateRange !== "all" && !isDateInRange(booking.eventDate, filters.dateRange))
        return false;
      if (filters.minAmount && booking.totalAmount < filters.minAmount) return false;
      if (filters.maxAmount && booking.totalAmount > filters.maxAmount) return false;
      return true;
    });

  const resetFilters = () => {
    const empty: FilterState = {
      search: "", vendorName: "", serviceType: [], bookingStatus: [],
      paymentStatus: [], dateRange: "all", minAmount: null, maxAmount: null,
    };
    setFilters(empty);
    setTempFilters(empty);
  };

  const applyTempFilters = () => { setFilters(tempFilters); setShowFilters(false); };

  const getActiveFilterCount = (): number => {
    let count = 0;
    if (filters.search) count++;
    if (filters.vendorName) count++;
    count += filters.serviceType.length;
    count += filters.bookingStatus.length;
    count += filters.paymentStatus.length;
    if (filters.dateRange !== "all") count++;
    if (filters.minAmount) count++;
    if (filters.maxAmount) count++;
    return count;
  };

  const getBookingStatusBadge = (status: string) => {
    switch (status) {
      case "ACCEPTED": return { text: "Confirmed", icon: CheckCircleIcon, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
      case "PENDING": return { text: "Pending Approval", icon: PendingIcon, color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
      case "DECLINED": return { text: "Declined", icon: XCircleIcon, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
      case "COMPLETED": return { text: "Completed", icon: CheckCircleIcon, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
      default: return { text: status, icon: PendingIcon, color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400" };
    }
  };

  const getPaymentStatusBadge = (status: string | undefined) => {
    switch (status) {
      case "DEPOSIT_PAID": return { text: "Deposit Paid", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: BanknotesIcon };
      case "FULLY_PAID": return { text: "Fully Paid", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircleIcon };
      case "PENDING": return { text: "Awaiting Payment", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: PendingIcon };
      default: return { text: "Pending", color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400", icon: PendingIcon };
    }
  };

  const getEventStatusBadge = (status: string) => {
    switch (status) {
      case "PLANNING": return { text: "Planning", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
      case "CONFIRMED": return { text: "Confirmed", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
      case "COMPLETED": return { text: "Completed", color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" };
      default: return { text: status, color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" };
    }
  };

  const getDateRangeDisplay = (booking: VendorBooking): { display: string; daysText?: string } => {
    if (booking.startDate && booking.endDate && booking.startDate !== booking.endDate) {
      return {
        display: `${new Date(booking.startDate).toLocaleDateString()} - ${new Date(booking.endDate).toLocaleDateString()}`,
        daysText: booking.totalDays ? `(${booking.totalDays} days)` : undefined,
      };
    }
    return { display: new Date(booking.eventDate).toLocaleDateString() };
  };

  const getPaymentPercentage = (booking: VendorBooking): number => {
    if (booking.vendorPaymentStatus === "FULLY_PAID") return 100;
    if (booking.vendorPaymentStatus === "DEPOSIT_PAID") return 20;
    return 0;
  };

  const upcomingBaseBookings = bookings.filter(
    (b) => !isEventPast(b.eventDate) && b.bookingStatus !== "DECLINED" && b.bookingStatus !== "COMPLETED"
  );
  const pastBaseBookings = bookings.filter(
    (b) => isEventPast(b.eventDate) || b.bookingStatus === "COMPLETED" || b.bookingStatus === "DECLINED"
  );
  const upcomingBookings = applyFilters(upcomingBaseBookings);
  const pastBookings = applyFilters(pastBaseBookings);

  if (!mounted || status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading your bookings...</p>
        </div>
      </div>
    );
  }

  const activeFilterCount = getActiveFilterCount();

  // ✅ SIMPLIFIED Refund status block - just shows status, links to refunds page for details
  const RefundStatusBlock = ({ booking }: { booking: VendorBooking }) => {
    if (!booking.refundStatus) {
      return null;
    }
    
    const getStatusColor = () => {
      switch (booking.refundStatus) {
        case "PROCESSED": return "text-green-600 dark:text-green-400";
        case "PENDING_ADMIN": return "text-yellow-600 dark:text-yellow-400";
        case "FAILED": return "text-red-600 dark:text-red-400";
        default: return "text-gray-500";
      }
    };

    const getStatusText = () => {
      switch (booking.refundStatus) {
        case "PROCESSED": return "Refund Completed";
        case "PENDING_ADMIN": return "Refund Processing";
        case "FAILED": return "Refund Failed";
        default: return booking.refundStatus;
      }
    };

    return (
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
        {booking.refundAmount != null && booking.refundAmount > 0 && (
          <span className="text-xs text-gray-500">
            • NPR {booking.refundAmount.toLocaleString()}
          </span>
        )}
        <Link 
          href="/my-refunds" 
          className="text-xs text-indigo-600 hover:underline flex items-center gap-1 ml-auto"
        >
          View Details →
        </Link>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Header with Refunds Link */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Bookings</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Track your vendor bookings and event payments
            </p>
          </div>
          <Link
            href="/my-refunds"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors border border-purple-200 dark:border-purple-800"
          >
            <BanknotesIcon className="h-5 w-5" />
            <span className="text-sm font-medium">My Refunds</span>
          </Link>
        </div>

        {/* Payment Success */}
        {paymentSuccess === "success" && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              <p className="text-green-700 dark:text-green-300">
                Payment successful! Your payment is securely held in escrow.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            {(["upcoming", "past", "events"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`px-6 py-3 text-sm font-medium transition-all rounded-t-lg flex items-center gap-2 ${
                  activeView === view
                    ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {view === "upcoming" && <><CalendarDaysIcon className="h-4 w-4" />Upcoming ({upcomingBookings.length})</>}
                {view === "past" && <><ClockIcon className="h-4 w-4" />Past ({pastBookings.length})</>}
                {view === "events" && <><HomeIcon className="h-4 w-4" />My Events ({umbrellaEvents.length})</>}
              </button>
            ))}
          </div>

          {activeView !== "events" && (
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <button onClick={() => setViewMode("list")} className={`p-2 rounded-l-lg transition-colors ${viewMode === "list" ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400"}`}>
                  <ListBulletIcon className="h-4 w-4" />
                </button>
                <button onClick={() => setViewMode("grid")} className={`p-2 rounded-r-lg transition-colors ${viewMode === "grid" ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400"}`}>
                  <Squares2X2Icon className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                <FunnelIcon className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-indigo-600 text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && activeView !== "events" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Filter Bookings</h3>
                  <button onClick={() => setShowFilters(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input type="text" value={tempFilters.search} onChange={(e) => setTempFilters({ ...tempFilters, search: e.target.value })} placeholder="Vendor, event, or package..." className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor Name</label>
                    <input type="text" value={tempFilters.vendorName} onChange={(e) => setTempFilters({ ...tempFilters, vendorName: e.target.value })} placeholder="Filter by vendor..." className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service Type</label>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {SERVICE_TYPES.map((type) => (
                        <button key={type} onClick={() => { const u = tempFilters.serviceType.includes(type) ? tempFilters.serviceType.filter(t => t !== type) : [...tempFilters.serviceType, type]; setTempFilters({ ...tempFilters, serviceType: u }); }} className={`px-2 py-1 text-xs rounded-full transition-colors ${tempFilters.serviceType.includes(type) ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>{type}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
                    <select value={tempFilters.dateRange} onChange={(e) => setTempFilters({ ...tempFilters, dateRange: e.target.value as any })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                      <option value="all">All Dates</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="past">Past</option>
                      <option value="thisMonth">This Month</option>
                      <option value="nextMonth">Next Month</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Booking Status</label>
                    <div className="flex flex-wrap gap-1">
                      {BOOKING_STATUSES.map((s) => (
                        <button key={s} onClick={() => { const u = tempFilters.bookingStatus.includes(s) ? tempFilters.bookingStatus.filter(x => x !== s) : [...tempFilters.bookingStatus, s]; setTempFilters({ ...tempFilters, bookingStatus: u }); }} className={`px-2 py-1 text-xs rounded-full transition-colors ${tempFilters.bookingStatus.includes(s) ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Status</label>
                    <div className="flex flex-wrap gap-1">
                      {PAYMENT_STATUSES.map((s) => (
                        <button key={s} onClick={() => { const u = tempFilters.paymentStatus.includes(s) ? tempFilters.paymentStatus.filter(x => x !== s) : [...tempFilters.paymentStatus, s]; setTempFilters({ ...tempFilters, paymentStatus: u }); }} className={`px-2 py-1 text-xs rounded-full transition-colors ${tempFilters.paymentStatus.includes(s) ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>{s.replace("_", " ")}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount Range (NPR)</label>
                    <div className="flex gap-2">
                      <input type="number" placeholder="Min" value={tempFilters.minAmount || ""} onChange={(e) => setTempFilters({ ...tempFilters, minAmount: e.target.value ? Number(e.target.value) : null })} className="w-1/2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                      <input type="number" placeholder="Max" value={tempFilters.maxAmount || ""} onChange={(e) => setTempFilters({ ...tempFilters, maxAmount: e.target.value ? Number(e.target.value) : null })} className="w-1/2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button onClick={resetFilters} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400">Reset All</button>
                  <button onClick={applyTempFilters} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Apply Filters</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Filter Tags */}
        {activeFilterCount > 0 && activeView !== "events" && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-gray-500 dark:text-gray-400">Active filters:</span>
            {filters.search && <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">Search: {filters.search}<button onClick={() => setFilters({ ...filters, search: "" })}><XMarkIcon className="h-3 w-3" /></button></span>}
            {filters.vendorName && <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">Vendor: {filters.vendorName}<button onClick={() => setFilters({ ...filters, vendorName: "" })}><XMarkIcon className="h-3 w-3" /></button></span>}
            {filters.serviceType.map(type => <span key={type} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{type}<button onClick={() => setFilters({ ...filters, serviceType: filters.serviceType.filter(t => t !== type) })}><XMarkIcon className="h-3 w-3" /></button></span>)}
            {filters.bookingStatus.map(s => <span key={s} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{s}<button onClick={() => setFilters({ ...filters, bookingStatus: filters.bookingStatus.filter(x => x !== s) })}><XMarkIcon className="h-3 w-3" /></button></span>)}
            {filters.paymentStatus.map(s => <span key={s} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{s.replace("_", " ")}<button onClick={() => setFilters({ ...filters, paymentStatus: filters.paymentStatus.filter(x => x !== s) })}><XMarkIcon className="h-3 w-3" /></button></span>)}
            {filters.dateRange !== "all" && <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{filters.dateRange.replace(/([A-Z])/g, " $1").trim()}<button onClick={() => setFilters({ ...filters, dateRange: "all" })}><XMarkIcon className="h-3 w-3" /></button></span>}
            <button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-600 dark:text-red-400">Clear all</button>
          </div>
        )}

        {/* ── UPCOMING VIEW ─────────────────────────────────────── */}
        {activeView === "upcoming" && (
          <>
            {upcomingBookings.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
                <div className="flex flex-col items-center">
                  <CalendarDaysIcon className="h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No upcoming bookings found</p>
                  {activeFilterCount > 0
                    ? <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try adjusting your filters</p>
                    : <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Book vendors for your events</p>}
                  <Link href="/marketplace" className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    <PlusIcon className="h-4 w-4 mr-2" />Browse Vendors
                  </Link>
                </div>
              </div>
            ) : viewMode === "list" ? (
              <div className="space-y-4">
                {upcomingBookings.map((booking) => {
                  const bookingStatus = getBookingStatusBadge(booking.bookingStatus);
                  const paymentStatus = getPaymentStatusBadge(booking.vendorPaymentStatus);
                  const depositAmount = booking.depositAmount || booking.totalAmount * 0.2;
                  const remainingAmount = booking.remainingAmount || booking.totalAmount * 0.8;
                  const paymentPercentage = getPaymentPercentage(booking);
                  const dateInfo = getDateRangeDisplay(booking);

                  const canCancelNoDeposit = booking.bookingStatus === "PENDING" && booking.vendorPaymentStatus === "PENDING";
                  const canCancelWithDeposit =
                    (booking.bookingStatus === "PENDING" || booking.bookingStatus === "ACCEPTED") &&
                    booking.vendorPaymentStatus === "DEPOSIT_PAID";
                  const canPayDeposit = booking.vendorPaymentStatus === "PENDING" && booking.bookingStatus !== "DECLINED";
                  const canPayRemaining = booking.vendorPaymentStatus === "DEPOSIT_PAID" &&
                    booking.bookingStatus === "ACCEPTED" &&
                    isEventUpcoming(booking.eventDate) &&
                    !booking.remainingPaidAt;

                  return (
                    <div key={booking.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all">
                      <div className="p-5">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-start justify-between flex-wrap gap-2">
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{booking.vendorName}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{booking.serviceType} • {booking.packageName}</p>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${bookingStatus.color}`}>
                                  <bookingStatus.icon className="h-3 w-3 mr-1" />{bookingStatus.text}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${paymentStatus.color}`}>
                                  <paymentStatus.icon className="h-3 w-3 mr-1" />{paymentStatus.text}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-4 mt-3">
                              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                <CalendarIcon className="h-4 w-4 mr-1 text-indigo-500" />
                                {dateInfo.display}
                                {dateInfo.daysText && <span className="ml-1 text-xs text-gray-400">{dateInfo.daysText}</span>}
                              </div>
                              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                <MapPinIcon className="h-4 w-4 mr-1 text-indigo-500" />{booking.location}
                              </div>
                            </div>

                            <div className="mt-2">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Event:</span>
                              <span className="ml-1 text-sm font-medium text-gray-900 dark:text-white">{booking.eventTitle}</span>
                            </div>

                            {/* Payment summary */}
                            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                              <div className="flex flex-wrap items-center gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">Total:</span>
                                  <span className="ml-1 font-semibold text-gray-900 dark:text-white">NPR {booking.totalAmount.toLocaleString()}</span>
                                </div>
                                {booking.vendorPaymentStatus === "DEPOSIT_PAID" && (
                                  <>
                                    <div><span className="text-gray-500 dark:text-gray-400">Paid:</span><span className="ml-1 font-medium text-green-600 dark:text-green-400">NPR {depositAmount.toLocaleString()}</span></div>
                                    <div><span className="text-gray-500 dark:text-gray-400">Due:</span><span className="ml-1 font-medium text-amber-600 dark:text-amber-400">NPR {remainingAmount.toLocaleString()}</span></div>
                                  </>
                                )}
                                {booking.vendorPaymentStatus === "FULLY_PAID" && (
                                  <span className="text-green-600 dark:text-green-400">✓ Fully Paid</span>
                                )}
                              </div>
                              {paymentPercentage > 0 && (
                                <div className="mt-2">
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full transition-all duration-500 ${paymentPercentage === 100 ? "bg-green-600" : "bg-blue-600"}`} style={{ width: `${paymentPercentage}%` }} />
                                  </div>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    {paymentPercentage === 100 ? "✓ Fully paid - money held in escrow" : `${paymentPercentage}% paid - remaining due before event`}
                                  </p>
                                </div>
                              )}
                              {booking.vendorPaymentStatus === "DEPOSIT_PAID" && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-2">
                                  <ShieldCheckIcon className="h-3 w-3" />Your deposit is securely held in escrow
                                </p>
                              )}
                            </div>

                            {canPayRemaining && (
                              <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                  <InformationCircleIcon className="h-3 w-3" />
                                  Remaining payment due before {new Date(booking.eventDate).toLocaleDateString()}
                                </p>
                              </div>
                            )}

                            {/* ✅ Declined / cancelled block with simplified refund status */}
                            {booking.bookingStatus === "DECLINED" && (
                              <div className="mt-3 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                                {booking.cancelledBy === "CUSTOMER" && (
                                  <p className="text-sm font-medium text-orange-700 dark:text-orange-300 flex items-center gap-2">
                                    <XCircleIcon className="h-4 w-4 flex-shrink-0" />You cancelled this booking.
                                  </p>
                                )}
                                {booking.cancelledBy === "VENDOR" && (
                                  <p className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
                                    <XCircleIcon className="h-4 w-4 flex-shrink-0" />Vendor declined this booking.
                                  </p>
                                )}
                                {!booking.cancelledBy && (
                                  <p className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
                                    <XCircleIcon className="h-4 w-4 flex-shrink-0" />Booking declined.
                                  </p>
                                )}
                                {booking.cancellationReason && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                                    Reason: {booking.cancellationReason}
                                  </p>
                                )}
                                <div className="ml-6">
                                  <RefundStatusBlock booking={booking} />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-col gap-2 min-w-[160px]">
                            <Link href={`/bookings/${booking.id}?returnTo=${activeView}`} className="flex items-center justify-center px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-sm font-medium transition-colors">
                              <EyeIcon className="h-4 w-4 mr-1" />View Details
                            </Link>

                            {canPayDeposit && (
                              <PaymentButton amount={depositAmount} bookingId={booking.id} paymentType="VENDOR_DEPOSIT" gateway="khalti" returnUrl={`/my-bookings?tab=${activeView}`} buttonText={`Pay Deposit (NPR ${depositAmount.toLocaleString()})`} onSuccess={() => window.location.reload()} />
                            )}
                            {canPayRemaining && (
                              <PaymentButton amount={remainingAmount} bookingId={booking.id} paymentType="VENDOR_REMAINING" gateway="khalti" returnUrl={`/my-bookings?tab=${activeView}`} buttonText={`Pay Remaining (NPR ${remainingAmount.toLocaleString()})`} onSuccess={() => window.location.reload()} />
                            )}

                            {/* ✅ Cancel without refund */}
                            {canCancelNoDeposit && (
                              <button onClick={() => cancelBookingNoDeposit(booking.id)} className="flex items-center justify-center px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 text-sm font-medium transition-colors">
                                <XCircleIcon className="h-4 w-4 mr-1" />Cancel Booking
                              </button>
                            )}

                            {/* ✅ Cancel with refund — PENDING+deposit or ACCEPTED+deposit */}
                            {canCancelWithDeposit && (
                              <button onClick={() => handleCancelBooking(booking.id)} disabled={cancellingId === booking.id} className="flex items-center justify-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 transition-colors">
                                {cancellingId === booking.id ? (
                                  <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-1" />Processing...</>
                                ) : (
                                  <><XCircleIcon className="h-4 w-4 mr-1" />Cancel & Refund</>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Grid view
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {upcomingBookings.map((booking) => {
                  const bookingStatus = getBookingStatusBadge(booking.bookingStatus);
                  const depositAmount = booking.depositAmount || booking.totalAmount * 0.2;
                  const dateInfo = getDateRangeDisplay(booking);
                  const canPayDeposit = booking.vendorPaymentStatus === "PENDING" && booking.bookingStatus !== "DECLINED";
                  const canPayRemaining = booking.vendorPaymentStatus === "DEPOSIT_PAID" && booking.bookingStatus === "ACCEPTED" && isEventUpcoming(booking.eventDate) && !booking.remainingPaidAt;
                  const canCancelWithDeposit = (booking.bookingStatus === "PENDING" || booking.bookingStatus === "ACCEPTED") && booking.vendorPaymentStatus === "DEPOSIT_PAID";
                  const canCancelNoDeposit = booking.bookingStatus === "PENDING" && booking.vendorPaymentStatus === "PENDING";

                  return (
                    <div key={booking.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all">
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{booking.vendorName}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{booking.serviceType}</p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bookingStatus.color}`}>{bookingStatus.text}</span>
                        </div>
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-center text-gray-500 dark:text-gray-400"><CalendarIcon className="h-4 w-4 mr-2 text-indigo-500" /><span className="text-xs">{dateInfo.display}</span></div>
                          <div className="flex items-center text-gray-500 dark:text-gray-400"><MapPinIcon className="h-4 w-4 mr-2 text-indigo-500" /><span className="text-xs truncate">{booking.location}</span></div>
                        </div>
                        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Total:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">NPR {booking.totalAmount.toLocaleString()}</span>
                          </div>
                          {booking.vendorPaymentStatus === "DEPOSIT_PAID" && (
                            <div className="flex justify-between text-xs mt-1">
                              <span className="text-gray-500 dark:text-gray-400">Paid:</span>
                              <span className="text-green-600 dark:text-green-400">NPR {depositAmount.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 mt-4">
                          <Link href={`/bookings/${booking.id}?returnTo=${activeView}`} className="text-center px-2 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors">View Details</Link>
                          {canPayDeposit && <PaymentButton amount={depositAmount} bookingId={booking.id} paymentType="VENDOR_DEPOSIT" gateway="khalti" returnUrl={`/my-bookings?tab=${activeView}`} buttonText="Pay Deposit" onSuccess={() => window.location.reload()} />}
                          {canPayRemaining && <PaymentButton amount={booking.remainingAmount || booking.totalAmount * 0.8} bookingId={booking.id} paymentType="VENDOR_REMAINING" gateway="khalti" returnUrl={`/my-bookings?tab=${activeView}`} buttonText="Pay Remaining" onSuccess={() => window.location.reload()} />}
                          {canCancelNoDeposit && <button onClick={() => cancelBookingNoDeposit(booking.id)} className="text-center px-2 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">Cancel</button>}
                          {canCancelWithDeposit && <button onClick={() => handleCancelBooking(booking.id)} disabled={cancellingId === booking.id} className="text-center px-2 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50">{cancellingId === booking.id ? "Processing..." : "Cancel & Refund"}</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── PAST VIEW ─────────────────────────────────────────── */}
        {activeView === "past" && (
          <>
            {pastBookings.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
                <div className="flex flex-col items-center">
                  <ClockIcon className="h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No past bookings found</p>
                  {activeFilterCount > 0
                    ? <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try adjusting your filters</p>
                    : <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Your completed bookings will appear here</p>}
                </div>
              </div>
            ) : viewMode === "list" ? (
              <div className="space-y-3">
                {pastBookings.map((booking) => {
                  const bookingStatus = getBookingStatusBadge(booking.bookingStatus);
                  const paymentStatus = getPaymentStatusBadge(booking.vendorPaymentStatus);
                  const isCancelled = booking.bookingStatus === "DECLINED";
                  const dateInfo = getDateRangeDisplay(booking);

                  return (
                    <div key={booking.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{booking.vendorName}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{booking.serviceType} • {booking.packageName}</p>
                          <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                            <span>{dateInfo.display}{dateInfo.daysText && <span className="ml-1 text-xs text-gray-400">{dateInfo.daysText}</span>}</span>
                            <span className="text-gray-400">|</span>
                            <span>{booking.location}</span>
                          </div>
                          <div className="mt-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentStatus.color}`}>
                              <paymentStatus.icon className="h-3 w-3 mr-1" />{paymentStatus.text}
                            </span>
                          </div>
                          {isCancelled && (
                            <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                              {booking.cancelledBy === "CUSTOMER" ? (
                                <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                  <XCircleIcon className="h-3 w-3" />You cancelled this booking.
                                  {booking.cancellationReason && ` Reason: ${booking.cancellationReason}`}
                                </p>
                              ) : (
                                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                  <XCircleIcon className="h-3 w-3" />
                                  {booking.cancelledBy === "VENDOR" ? "Vendor declined this booking." : "Booking declined."}
                                  {booking.declineReason && ` Reason: ${booking.declineReason}`}
                                </p>
                              )}
                              <RefundStatusBlock booking={booking} />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bookingStatus.color}`}>{bookingStatus.text}</span>
                          <Link href={`/bookings/${booking.id}?returnTo=${activeView}`} className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline">View Details →</Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pastBookings.map((booking) => {
                  const bookingStatus = getBookingStatusBadge(booking.bookingStatus);
                  const dateInfo = getDateRangeDisplay(booking);
                  return (
                    <div key={booking.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{booking.vendorName}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bookingStatus.color}`}>{bookingStatus.text}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{booking.serviceType}</p>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <CalendarIcon className="h-3 w-3" />{dateInfo.display}
                      </div>
                      <Link href={`/bookings/${booking.id}?returnTo=${activeView}`} className="mt-3 block text-center text-indigo-600 dark:text-indigo-400 text-sm">View Details →</Link>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── EVENTS VIEW ───────────────────────────────────────── */}
        {activeView === "events" && (
          <>
            {umbrellaEvents.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
                <div className="flex flex-col items-center">
                  <HomeIcon className="h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No events yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Events are created when you book vendors</p>
                  <Link href="/marketplace" className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    <PlusIcon className="h-4 w-4 mr-2" />Book Your First Vendor
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {umbrellaEvents.map((event) => {
                  const eventStatus = getEventStatusBadge(event.status);
                  const formattedDate = new Date(event.eventDate).toISOString().split("T")[0];
                  return (
                    <div key={event.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all">
                      <div className="p-5">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{event.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${eventStatus.color}`}>{eventStatus.text}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Spent</p>
                            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">NPR {event.totalSpent.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center"><CalendarIcon className="h-4 w-4 mr-1 text-indigo-500" />{new Date(event.eventDate).toLocaleDateString()}</div>
                          <div className="flex items-center"><BuildingOfficeIcon className="h-4 w-4 mr-1 text-indigo-500" />{event.vendorCount} vendor(s)</div>
                          <div className="flex items-center"><CurrencyRupeeIcon className="h-4 w-4 mr-1 text-indigo-500" />{event.guestCount} guests</div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                          <Link href={`/dashboard/events/${event.id}`} className="flex-1 text-center px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-sm font-medium transition-colors">
                            <EyeIcon className="h-4 w-4 inline mr-1" />View Event
                          </Link>
                          <Link href={`/marketplace?eventId=${event.id}&eventTitle=${encodeURIComponent(event.title)}&eventDate=${formattedDate}&guestCount=${event.guestCount}`} className="flex-1 text-center px-3 py-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 text-sm font-medium transition-colors">
                            <PlusIcon className="h-4 w-4 inline mr-1" />Add Vendor
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </main>
    </div>
  );
}