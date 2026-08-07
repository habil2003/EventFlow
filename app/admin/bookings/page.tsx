"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  TicketIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserCircleIcon,
  CalendarIcon,
  BanknotesIcon,
  EyeIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  ExclamationTriangleIcon,

  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

interface BookingPayout {
  type?: string;
  amount?: number;
}

interface Booking {
  id: string;
  type: "TICKET" | "VENDOR";
  reference: string;
  event: string;
  customer: string;
  customerEmail?: string;
  amount: number;
  status: string;
  date: string;
  payouts: BookingPayout[];
  vendorName?: string;
  organizerName?: string;
  ticketNumber?: string;
  bookingReference?: string;
  quantity?: number;
  eventDate?: string;
  location?: string;
}

interface BookingStats {
  total: number;
  pending: number;
  completed: number;
  heldInEscrow: number;
  processingPayout: number;
  refunded: number;
  disputed: number;
  totalRevenue: number;
  totalTicketBookings: number;
  totalVendorBookings: number;
}

export default function BookingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Auth check
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

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // Fetch bookings
  const fetchBookings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/admin/bookings?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      showMessage("Failed to load bookings", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when filters change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchBookings();
    }, 500);

    return () => clearTimeout(debounceTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, typeFilter, statusFilter]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
      PENDING: {
        color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        icon: ClockIcon,
        label: "Pending",
      },
      HELD_IN_ESCROW: {
        color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        icon: ShieldCheckIcon,
        label: "In Escrow",
      },
      PROCESSING_PAYOUT: {
        color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
        icon: ArrowPathIcon,
        label: "Processing",
      },
      COMPLETED: {
        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        icon: CheckCircleIcon,
        label: "Completed",
      },
      DISPUTED: {
        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        icon: ExclamationTriangleIcon,
        label: "Disputed",
      },
      FAILED: {
        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        icon: XCircleIcon,
        label: "Failed",
      },
      REFUNDED: {
        color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
        icon: BanknotesIcon,
        label: "Refunded",
      },
    };

    const statusInfo = statusMap[status] || statusMap.PENDING;
    const Icon = statusInfo.icon;

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}
      >
        <Icon className="h-3 w-3 mr-1" />
        {statusInfo.label}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    if (type === "TICKET") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <TicketIcon className="h-3 w-3 mr-1" />
          Ticket
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
          <BuildingOfficeIcon className="h-3 w-3 mr-1" />
          Vendor
        </span>
      );
    }
  };

  const formatCurrency = (amount: number) => {
    return `NPR ${amount.toLocaleString()}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate stats from bookings if not provided by API
  const calculatedStats: BookingStats = stats || {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "PENDING").length,
    completed: bookings.filter((b) => b.status === "COMPLETED").length,
    heldInEscrow: bookings.filter((b) => b.status === "HELD_IN_ESCROW").length,
    processingPayout: bookings.filter((b) => b.status === "PROCESSING_PAYOUT").length,
    refunded: bookings.filter((b) => b.status === "REFUNDED").length,
    disputed: bookings.filter((b) => b.status === "DISPUTED").length,
    totalRevenue: bookings.reduce((sum, b) => sum + b.amount, 0),
    totalTicketBookings: bookings.filter((b) => b.type === "TICKET").length,
    totalVendorBookings: bookings.filter((b) => b.type === "VENDOR").length,
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading bookings...
          </p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <DocumentTextIcon className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Booking Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage all ticket and vendor bookings on the platform
            </p>
          </div>
        </div>
        <button
          onClick={fetchBookings}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Refresh</span>
        </button>
      </div>

      {/* Message Alert */}
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
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
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Bookings</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {calculatedStats.total}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <DocumentTextIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div className="flex gap-2 mt-2 text-xs">
            <span className="text-blue-600 dark:text-blue-400">
              {calculatedStats.totalTicketBookings} Tickets
            </span>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className="text-purple-600 dark:text-purple-400">
              {calculatedStats.totalVendorBookings} Vendors
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">In Escrow</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-500">
                {calculatedStats.heldInEscrow}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <ShieldCheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {calculatedStats.processingPayout} processing
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                {calculatedStats.completed}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
                {formatCurrency(calculatedStats.totalRevenue)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <BanknotesIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {calculatedStats.pending} pending • {calculatedStats.refunded} refunded
          </p>
        </div>
      </div>

      {/* Status Summary Badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Status:</span>
        {calculatedStats.pending > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            {calculatedStats.pending} Pending
          </span>
        )}
        {calculatedStats.heldInEscrow > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {calculatedStats.heldInEscrow} In Escrow
          </span>
        )}
        {calculatedStats.processingPayout > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            {calculatedStats.processingPayout} Processing
          </span>
        )}
        {calculatedStats.completed > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {calculatedStats.completed} Completed
          </span>
        )}
        {calculatedStats.disputed > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {calculatedStats.disputed} Disputed
          </span>
        )}
        {calculatedStats.refunded > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {calculatedStats.refunded} Refunded
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by booking reference, event, customer..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          <option value="all">All Types</option>
          <option value="TICKET">Ticket Bookings</option>
          <option value="VENDOR">Vendor Bookings</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          <option value="all">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="HELD_IN_ESCROW">In Escrow</option>
          <option value="PROCESSING_PAYOUT">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="DISPUTED">Disputed</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </div>

      {/* Bookings Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Booking
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {bookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-mono text-sm text-gray-900 dark:text-white">
                        #{booking.reference?.slice(0, 12) || booking.id.slice(0, 12)}
                      </p>
                      {booking.type === "TICKET" && booking.ticketNumber && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Ticket: {booking.ticketNumber}
                        </p>
                      )}
                      {booking.type === "VENDOR" && booking.bookingReference && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Ref: {booking.bookingReference}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getTypeBadge(booking.type)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <UserCircleIcon className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {booking.customer}
                        </p>
                        {booking.customerEmail && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {booking.customerEmail}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {booking.event}
                      </p>
                      {booking.eventDate && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDate(booking.eventDate)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(booking.amount)}
                    </p>
                    {booking.quantity && booking.quantity > 1 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {booking.quantity} tickets
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(booking.status)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(booking.date)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedBooking(booking);
                          setDetailsModalOpen(true);
                        }}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
                        title="View Details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      {booking.status === "HELD_IN_ESCROW" && (
                        <Link
                          href={`/admin/escrow`}
                          className="p-1.5 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="View in Escrow"
                        >
                          <ShieldCheckIcon className="h-4 w-4" />
                        </Link>
                      )}
                      {booking.payouts && booking.payouts.length > 0 && (
                        <Link
                          href={`/admin/payouts`}
                          className="p-1.5 text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                          title="View Payouts"
                        >
                          <BanknotesIcon className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {bookings.length === 0 && (
          <div className="text-center py-12">
            <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              No bookings found
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Try adjusting your filters
            </p>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* DETAILS MODAL */}
      {/* ============================================ */}
      {detailsModalOpen && selectedBooking && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-90 transition-opacity"
              onClick={() => setDetailsModalOpen(false)}
            />

            <div className="relative inline-block transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
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
                      {/* Type & Status */}
                      <div className="flex items-center gap-4">
                        {getTypeBadge(selectedBooking.type)}
                        {getStatusBadge(selectedBooking.status)}
                      </div>

                      {/* Reference */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Reference
                        </p>
                        <p className="font-mono text-gray-900 dark:text-white">
                          #{selectedBooking.reference}
                        </p>
                      </div>

                      {/* Customer */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Customer
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedBooking.customer}
                        </p>
                        {selectedBooking.customerEmail && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {selectedBooking.customerEmail}
                          </p>
                        )}
                      </div>

                      {/* Event */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Event
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedBooking.event}
                        </p>
                        {selectedBooking.eventDate && (
                          <div className="flex items-center gap-2 mt-1">
                            <CalendarIcon className="h-3 w-3 text-gray-400" />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(selectedBooking.eventDate)}
                            </p>
                          </div>
                        )}
                        {selectedBooking.location && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            📍 {selectedBooking.location}
                          </p>
                        )}
                      </div>

                      {/* Payment Details */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">
                            Amount
                          </span>
                          <span className="font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(selectedBooking.amount)}
                          </span>
                        </div>
                        {selectedBooking.quantity && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                              Quantity
                            </span>
                            <span className="text-gray-900 dark:text-white">
                              {selectedBooking.quantity}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">
                            Date
                          </span>
                          <span className="text-gray-900 dark:text-white">
                            {formatDate(selectedBooking.date)}
                          </span>
                        </div>
                      </div>

                      {/* Vendor specific info */}
                      {selectedBooking.type === "VENDOR" && selectedBooking.vendorName && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Vendor
                          </p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedBooking.vendorName}
                          </p>
                        </div>
                      )}

                      {/* Ticket specific info */}
                      {selectedBooking.type === "TICKET" && selectedBooking.ticketNumber && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Ticket Number
                          </p>
                          <p className="font-mono text-gray-900 dark:text-white">
                            {selectedBooking.ticketNumber}
                          </p>
                        </div>
                      )}

                      {/* Payouts */}
                      {selectedBooking.payouts && selectedBooking.payouts.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Payouts ({selectedBooking.payouts.length})
                          </p>
                          <div className="mt-1 space-y-1">
                            {selectedBooking.payouts.map((payout, index: number) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">
                                  {payout.type || "Payout"}
                                </span>
                                <span className="text-green-600 dark:text-green-400">
                                  {formatCurrency(payout.amount || 0)}
                                </span>
                              </div>
                            ))}
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
                  onClick={() => setDetailsModalOpen(false)}
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                >
                  Close
                </button>
                {selectedBooking.status === "HELD_IN_ESCROW" && (
                  <Link
                    href={`/admin/escrow`}
                    onClick={() => setDetailsModalOpen(false)}
                    className="inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  >
                    <ShieldCheckIcon className="h-4 w-4 mr-2" />
                    View in Escrow
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
