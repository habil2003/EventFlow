"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarIcon,
  MapPinIcon,
  UserGroupIcon,
  CurrencyRupeeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  ArrowLeftIcon,
  SparklesIcon,
  BuildingOfficeIcon,
  CreditCardIcon,
  ChatBubbleLeftRightIcon,
  BanknotesIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface Booking {
  id: string;
  eventTitle: string;
  eventDate: string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  guestCount: number;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  bookingStatus: string;
  vendorPaymentStatus: string;
  customerName: string;
  customerEmail: string;
  packageName: string;
  depositPaidAt?: string;
  remainingPaidAt?: string;
  createdAt: string;
  declineReason?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  location?: string;
}

export default function VendorBookingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineBookingId, setDeclineBookingId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineSubmitting, setDeclineSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await fetch("/api/vendor/bookings");
        const data = await response.json();
        setBookings(data);
      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  const openDeclineModal = (bookingId: string) => {
    setDeclineBookingId(bookingId);
    setDeclineReason("");
    setDeclineModalOpen(true);
  };

  const submitDecline = async () => {
    if (!declineBookingId) return;

    setDeclineSubmitting(true);
    try {
      const response = await fetch(`/api/vendor/bookings/${declineBookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'DECLINED',
          declineReason: declineReason.trim() || "No specific reason provided"
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ text: `Booking declined successfully`, type: 'success' });
        const refreshResponse = await fetch("/api/vendor/bookings");
        const refreshedData = await refreshResponse.json();
        setBookings(refreshedData);
        setDeclineModalOpen(false);
      } else {
        setMessage({ text: data.error || 'Failed to decline booking', type: 'error' });
      }
    } catch (error) {
      console.error("Error declining booking:", error);
      setMessage({ text: 'An error occurred', type: 'error' });
    } finally {
      setDeclineSubmitting(false);
      setDeclineBookingId(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: 'ACCEPTED' | 'DECLINED') => {
    if (newStatus === 'DECLINED') {
      openDeclineModal(bookingId);
      return;
    }

    if (!confirm(`Are you sure you want to accept this booking?`)) return;

    setActionLoading(bookingId);
    try {
      const response = await fetch(`/api/vendor/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ text: `Booking accepted successfully`, type: 'success' });
        const refreshResponse = await fetch("/api/vendor/bookings");
        const refreshedData = await refreshResponse.json();
        setBookings(refreshedData);
      } else {
        setMessage({ text: data.error || 'Failed to update booking', type: 'error' });
      }
    } catch (error) {
      console.error("Error updating booking:", error);
      setMessage({ text: 'An error occurred', type: 'error' });
    } finally {
      setActionLoading(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const getStatusBadge = (status: string, cancelledBy?: string) => {
    switch (status) {
      case 'ACCEPTED':
        return { text: 'Accepted', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircleIcon };
      case 'DECLINED':
        if (cancelledBy === 'CUSTOMER') {
          return { text: 'Cancelled by Customer', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: XCircleIcon };
        }
        return { text: 'Declined', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircleIcon };
      case 'COMPLETED':
        return { text: 'Completed', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircleIcon };
      default:
        return { text: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: ClockIcon };
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'DEPOSIT_PAID':
        return { text: 'Deposit Paid', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: BanknotesIcon };
      case 'FULLY_PAID':
        return { text: 'Fully Paid', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircleIcon };
      case 'PROCESSING_PAYOUT':
        return { text: 'Processing Payout', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: ClockIcon };
      case 'PENDING':
        return { text: 'Awaiting Deposit', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: ClockIcon };
      default:
        return { text: status || 'Unknown', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: InformationCircleIcon };
    }
  };

  const formatEventDate = (booking: Booking): string => {
    if (booking.startDate && booking.endDate && booking.startDate !== booking.endDate) {
      return `${new Date(booking.startDate).toLocaleDateString()} - ${new Date(booking.endDate).toLocaleDateString()}`;
    }
    return new Date(booking.eventDate).toLocaleDateString();
  };

  const canAcceptBooking = (booking: Booking) => {
    return booking.bookingStatus === 'PENDING' &&
      booking.vendorPaymentStatus === 'DEPOSIT_PAID';
  };

  // Filter bookings based on search and status
  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = searchTerm === "" ||
      booking.eventTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.packageName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || booking.bookingStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const pendingBookings = filteredBookings.filter(b => b.bookingStatus === 'PENDING');
  const acceptedBookings = filteredBookings.filter(b => b.bookingStatus === 'ACCEPTED');
  const completedBookings = filteredBookings.filter(b => b.bookingStatus === 'COMPLETED');
  const declinedBookings = filteredBookings.filter(b => b.bookingStatus === 'DECLINED');

  const totalEarnings = acceptedBookings
    .filter(b => b.vendorPaymentStatus === 'FULLY_PAID')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  const pendingPayouts = acceptedBookings
    .filter(b => b.vendorPaymentStatus === 'PROCESSING_PAYOUT')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Booking Requests</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Manage incoming booking requests and track payment status
          </p>
        </div>

        {/* Message Alert */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-6 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                  : 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
              }`}
            >
              <div className="flex items-center gap-2">
                {message.type === 'success' ? (
                  <CheckCircleIcon className="h-5 w-5" />
                ) : (
                  <XCircleIcon className="h-5 w-5" />
                )}
                {message.text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">{pendingBookings.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Accepted</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-500">{acceptedBookings.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-500">{completedBookings.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Declined</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-500">{declinedBookings.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Earnings</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">NPR {totalEarnings.toLocaleString()}</p>
          </div>
        </div>

        {/* Pending Payout Alert */}
        {pendingPayouts > 0 && (
          <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-400">
                  Pending Payouts: NPR {pendingPayouts.toLocaleString()}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-500 mt-1">
                  Admin has initiated payouts for these bookings. Funds will be transferred to your account shortly.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by event, customer, or package..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                showFilters
                  ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-600"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600"
              }`}
            >
              <FunnelIcon className="h-4 w-4" />
              Filters
            </button>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="COMPLETED">Completed</option>
              <option value="DECLINED">Declined</option>
            </select>
          </div>
        </div>

        {/* Pending Bookings Section */}
        {pendingBookings.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-yellow-500" />
              Pending Requests ({pendingBookings.length})
            </h2>
            <div className="space-y-4">
              {pendingBookings.map((booking) => {
                const statusBadge = getStatusBadge(booking.bookingStatus, booking.cancelledBy);
                const paymentBadge = getPaymentBadge(booking.vendorPaymentStatus);
                const StatusIcon = statusBadge.icon;
                const PaymentIcon = paymentBadge.icon;
                const acceptEnabled = canAcceptBooking(booking);
                const dateDisplay = formatEventDate(booking);
                const isMultiDay = booking.startDate && booking.endDate && booking.startDate !== booking.endDate;

                return (
                  <div key={booking.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all">
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                              {booking.eventTitle}
                            </h3>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusBadge.text}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${paymentBadge.color}`}>
                              <PaymentIcon className="h-3 w-3 mr-1" />
                              {paymentBadge.text}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center">
                              <CalendarIcon className="h-4 w-4 mr-1 text-indigo-500" />
                              <span>
                                {dateDisplay}
                                {isMultiDay && booking.totalDays && (
                                  <span className="ml-1 text-xs text-gray-400">({booking.totalDays} days)</span>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <UserGroupIcon className="h-4 w-4 mr-1 text-indigo-500" />
                              {booking.guestCount} guests
                            </div>
                            <div className="flex items-center">
                              <CurrencyRupeeIcon className="h-4 w-4 mr-1 text-indigo-500" />
                              NPR {booking.totalAmount.toLocaleString()}
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-gray-500">Package</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{booking.packageName}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Customer</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{booking.customerName}</p>
                                <p className="text-xs text-gray-500">{booking.customerEmail}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Payment</p>
                                <p className="text-sm text-gray-900 dark:text-white">
                                  Deposit: NPR {booking.depositAmount.toLocaleString()}
                                  {booking.depositPaidAt && ` ✓ Paid`}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Remaining: NPR {booking.remainingAmount.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>

                          {!acceptEnabled && booking.vendorPaymentStatus !== 'DEPOSIT_PAID' && (
                            <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                              <p className="text-xs text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
                                <ClockIcon className="h-3 w-3" />
                                Waiting for customer to pay 20% deposit before you can accept this booking
                              </p>
                            </div>
                          )}

                          {acceptEnabled && (
                            <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                                <CheckCircleIcon className="h-3 w-3" />
                                Deposit received! You can now accept this booking.
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 min-w-[140px]">
                          <button
                            onClick={() => handleStatusUpdate(booking.id, 'ACCEPTED')}
                            disabled={actionLoading === booking.id || !acceptEnabled}
                            className={`px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                              acceptEnabled
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-400 text-white cursor-not-allowed'
                            }`}
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            {actionLoading === booking.id ? 'Processing...' : 'Accept Booking'}
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(booking.id, 'DECLINED')}
                            disabled={actionLoading === booking.id}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <XCircleIcon className="h-4 w-4" />
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Accepted Bookings Section */}
        {acceptedBookings.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
              Accepted Bookings ({acceptedBookings.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {acceptedBookings.map((booking) => {
                const paymentBadge = getPaymentBadge(booking.vendorPaymentStatus);
                const PaymentIcon = paymentBadge.icon;
                const dateDisplay = formatEventDate(booking);
                const isMultiDay = booking.startDate && booking.endDate && booking.startDate !== booking.endDate;
                const isProcessingPayout = booking.vendorPaymentStatus === 'PROCESSING_PAYOUT';

                return (
                  <div key={booking.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{booking.eventTitle}</h3>
                        <p className="text-sm text-gray-500 mt-1">{booking.packageName}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${paymentBadge.color}`}>
                        <PaymentIcon className="h-3 w-3 mr-1" />
                        {paymentBadge.text}
                      </span>
                    </div>
                    
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center text-sm text-gray-500">
                        <CalendarIcon className="h-4 w-4 mr-2 text-indigo-500" />
                        {dateDisplay}
                        {isMultiDay && booking.totalDays && (
                          <span className="ml-1 text-xs text-gray-400">({booking.totalDays} days)</span>
                        )}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <UserGroupIcon className="h-4 w-4 mr-2 text-indigo-500" />
                        {booking.guestCount} guests
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total Amount:</span>
                        <span className="font-semibold text-indigo-600">NPR {booking.totalAmount.toLocaleString()}</span>
                      </div>
                      {booking.vendorPaymentStatus === 'DEPOSIT_PAID' && (
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-gray-500">Remaining Due:</span>
                          <span className="font-medium text-amber-600">NPR {booking.remainingAmount.toLocaleString()}</span>
                        </div>
                      )}
                      {booking.vendorPaymentStatus === 'PROCESSING_PAYOUT' && (
                        <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <p className="text-xs text-purple-700 dark:text-purple-400 flex items-center gap-1">
                            <ClockIcon className="h-3 w-3 animate-spin" />
                            Payout is being processed by admin
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Bookings Section */}
        {completedBookings.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-blue-500" />
              Completed Bookings ({completedBookings.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {completedBookings.map((booking) => {
                const dateDisplay = formatEventDate(booking);
                const isMultiDay = booking.startDate && booking.endDate && booking.startDate !== booking.endDate;

                return (
                  <div key={booking.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{booking.eventTitle}</h3>
                    <p className="text-sm text-gray-500 mt-1">{booking.packageName}</p>
                    <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                      <CalendarIcon className="h-4 w-4 text-indigo-500" />
                      {dateDisplay}
                      {isMultiDay && booking.totalDays && (
                        <span className="text-xs text-gray-400">({booking.totalDays} days)</span>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Total Received:</span>
                        <span className="font-semibold text-green-600">NPR {booking.totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Declined Bookings Section */}
        {declinedBookings.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <XCircleIcon className="h-5 w-5 text-red-500" />
              Declined Bookings ({declinedBookings.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {declinedBookings.map((booking) => {
                const isCustomerCancellation = booking.cancelledBy === 'CUSTOMER';
                const dateDisplay = formatEventDate(booking);
                const isMultiDay = booking.startDate && booking.endDate && booking.startDate !== booking.endDate;

                return (
                  <div key={booking.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{booking.eventTitle}</h3>
                        <p className="text-sm text-gray-500 mt-1">{booking.packageName}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        isCustomerCancellation
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {isCustomerCancellation ? 'Customer Cancelled' : 'Vendor Declined'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                      <CalendarIcon className="h-4 w-4 text-indigo-500" />
                      {dateDisplay}
                      {isMultiDay && booking.totalDays && (
                        <span className="text-xs text-gray-400">({booking.totalDays} days)</span>
                      )}
                    </div>

                    {(booking.cancellationReason || booking.declineReason) && (
                      <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1">
                          <ChatBubbleLeftRightIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>{booking.cancellationReason || booking.declineReason}</span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredBookings.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
            <BuildingOfficeIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No bookings found</p>
            {searchTerm && (
              <p className="text-sm text-gray-400 mt-2">Try adjusting your search or filters</p>
            )}
          </div>
        )}
      </main>

      {/* Decline Reason Modal */}
      <AnimatePresence>
        {declineModalOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-90 transition-opacity"
                onClick={() => setDeclineModalOpen(false)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative inline-block transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle"
              >
                <div className="bg-white dark:bg-gray-800 px-6 pt-5 pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                      <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                        Decline Booking
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Please provide a reason for declining this booking. This will be shared with the customer.
                        </p>
                      </div>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Reason for declining
                        </label>
                        <textarea
                          rows={4}
                          value={declineReason}
                          onChange={(e) => setDeclineReason(e.target.value)}
                          placeholder="e.g., Venue not available on requested date, Package already booked, etc."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                          autoFocus
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          {declineReason.length > 0 ? `${declineReason.length} characters` : "Optional but recommended"}
                        </p>
                      </div>
                      <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <p className="text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
                          <InformationCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span>The customer will receive a full refund of their deposit. Refund may take 3-7 business days.</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-3 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="button"
                    onClick={submitDecline}
                    disabled={declineSubmitting}
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {declineSubmitting ? 'Processing...' : 'Decline Booking'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeclineModalOpen(false)}
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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