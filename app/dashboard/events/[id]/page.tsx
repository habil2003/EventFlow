"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  CurrencyRupeeIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlusIcon,
  EyeIcon,
  CreditCardIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  BanknotesIcon,
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
  location: string;
  createdAt: string;
  eventDate?: string;
  depositPaidAt?: string;
  remainingPaidAt?: string;
  refundStatus?: string;
  cancelledBy?: string;
  declineReason?: string;
}

interface UmbrellaEvent {
  id: string;
  title: string;
  eventDate: string;
  guestCount: number;
  status: string;
  derivedStatus?: string;
  derivedStatusLabel?: string;
  totalSpent: number;
  vendorCount: number;
  createdAt: string;
  bookingSummary?: {
    total: number;
    completed: number;
    pending: number;
    accepted: number;
    declined: number;
  };
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [event, setEvent] = useState<UmbrellaEvent | null>(null);
  const [bookings, setBookings] = useState<VendorBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        const { id } = await params;

        const eventRes = await fetch(`/api/user/social-events/${id}`);
        if (eventRes.ok) {
          const eventData = await eventRes.json();
          setEvent(eventData);
        }

        const bookingsRes = await fetch(
          `/api/user/social-events/${id}/bookings`,
        );
        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          setBookings(bookingsData);
        }
      } catch (error) {
        console.error("Error fetching event details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEventDetails();
  }, [params]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return {
          text: "Confirmed",
          color:
            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          icon: CheckCircleIcon,
        };
      case "PENDING":
        return {
          text: "Pending Approval",
          color:
            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
          icon: ClockIcon,
        };
      case "DECLINED":
        return {
          text: "Declined",
          color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          icon: XCircleIcon,
        };
      case "COMPLETED":
        return {
          text: "Completed",
          color:
            "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
          icon: CheckCircleIcon,
        };
      default:
        return {
          text: status,
          color:
            "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
          icon: ClockIcon,
        };
    }
  };

  const getEventStatusBadge = (eventStatus: string | undefined) => {
    switch (eventStatus) {
      case "PLANNING":
        return {
          text: "Planning",
          color:
            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        };
      case "IN_PROGRESS":
        return {
          text: "In Progress",
          color:
            "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        };
      case "AWAITING_COMPLETION":
        return {
          text: "Awaiting Completion",
          color:
            "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        };
      case "CONFIRMED":
        return {
          text: "Confirmed",
          color:
            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        };
      case "COMPLETED":
        return {
          text: "Completed",
          color:
            "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
        };
      default:
        return {
          text: eventStatus || "Planning",
          color:
            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        };
    }
  };

  const getPaymentStatusBadge = (status: string | undefined) => {
    switch (status) {
      case "DEPOSIT_PAID":
        return {
          text: "Deposit Paid",
          color:
            "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
          description: "20% deposit received - held in escrow",
        };
      case "FULLY_PAID":
        return {
          text: "Fully Paid",
          color:
            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          description: "100% payment received - held in escrow",
        };
      case "COMPLETED":
        return {
          text: "Fully Paid",
          color:
            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          description: "Payment fully completed and released to vendor",
        };
      case "PENDING":
        return {
          text: "Awaiting Payment",
          color:
            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
          description: "Deposit not yet paid",
        };
      default:
        return {
          text: status || "Pending",
          color:
            "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
          description: "",
        };
    }
  };

  const getRefundStatusText = (status: string | undefined) => {
    switch (status) {
      case "PENDING":
        return "Processing (3-7 business days)";
      case "PROCESSED":
        return "Refunded ✓";
      case "FAILED":
        return "Failed - Contact Support";
      default:
        return status || "Processing";
    }
  };

  const isEventPassed = () => {
    if (!event) return false;
    return new Date(event.eventDate) < new Date();
  };

  const isEventUpcoming = () => {
    if (!event) return false;
    return new Date(event.eventDate) > new Date();
  };

  const calculatePaymentPercentage = (booking: VendorBooking): number => {
    if (
      booking.vendorPaymentStatus === "FULLY_PAID" ||
      booking.vendorPaymentStatus === "COMPLETED"
    )
      return 100;
    if (booking.vendorPaymentStatus === "DEPOSIT_PAID") return 20;
    return 0;
  };

  const totalDepositsPaid = bookings.reduce((sum, booking) => {
    if (booking.bookingStatus === "DECLINED") return sum;
    if (booking.vendorPaymentStatus === "DEPOSIT_PAID") {
      const depositAmount = booking.depositAmount || booking.totalAmount * 0.2;
      return sum + depositAmount;
    }
    return sum;
  }, 0);

  const totalRemaining = bookings.reduce((sum, booking) => {
    if (booking.bookingStatus === "DECLINED") return sum;
    if (booking.vendorPaymentStatus === "DEPOSIT_PAID") {
      const remainingAmount =
        booking.remainingAmount || booking.totalAmount * 0.8;
      return sum + remainingAmount;
    }
    return sum;
  }, 0);

  const totalFullyPaid = bookings.reduce((sum, booking) => {
    if (booking.bookingStatus === "DECLINED") return sum;
    if (
      booking.vendorPaymentStatus === "FULLY_PAID" ||
      booking.vendorPaymentStatus === "COMPLETED"
    ) {
      return sum + booking.totalAmount;
    }
    return sum;
  }, 0);

  // Calculate total active bookings (non-declined)
  const totalActiveBookings = bookings
    .filter((b) => b.bookingStatus !== "DECLINED")
    .reduce((sum, b) => sum + b.totalAmount, 0);

  // ✅ Calculate refunded amount from declined bookings
  const totalRefunded = bookings
    .filter((b) => b.bookingStatus === "DECLINED")
    .reduce((sum, b) => sum + b.totalAmount, 0);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Event not found</h2>
          <Link
            href="/my-bookings?tab=events"
            className="mt-4 inline-block text-indigo-600"
          >
            Back to My Events
          </Link>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(event.eventDate).toISOString().split("T")[0];
  const eventPassed = isEventPassed();
  const eventUpcoming = isEventUpcoming();

  const eventStatusBadge = getEventStatusBadge(
    event.derivedStatus || event.status,
  );
  const displayStatus = event.derivedStatusLabel || event.status;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href="/my-bookings?tab=events"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-6 group"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
          Back to My Events
        </Link>

        {/* Event Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {event.title}
                </h1>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${eventStatusBadge.color}`}
                >
                  {eventStatusBadge.text}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-1 text-indigo-500" />
                  {new Date(event.eventDate).toLocaleDateString()}
                  {eventPassed && (
                    <span className="ml-2 text-xs text-green-600">
                      (Event Passed)
                    </span>
                  )}
                  {eventUpcoming && (
                    <span className="ml-2 text-xs text-amber-600">
                      (Upcoming)
                    </span>
                  )}
                </div>
                <div className="flex items-center">
                  <UserGroupIcon className="h-4 w-4 mr-1 text-indigo-500" />
                  {event.guestCount} guests
                </div>
                <div className="flex items-center">
                  <BuildingOfficeIcon className="h-4 w-4 mr-1 text-indigo-500" />
                  {event.vendorCount} vendors
                </div>
                {event.bookingSummary && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-600">
                      {event.bookingSummary.completed} completed
                    </span>
                    <span className="text-yellow-600">
                      {event.bookingSummary.pending} pending
                    </span>
                    <span className="text-blue-600">
                      {event.bookingSummary.accepted} confirmed
                    </span>
                    {event.bookingSummary.declined > 0 && (
                      <span className="text-red-600">
                        {event.bookingSummary.declined} declined
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ✅ FIXED: Budget Breakdown Section */}
            <div className="text-right min-w-[200px]">
              <p className="text-sm text-gray-500">Total Budget</p>
              <p className="text-2xl font-bold text-indigo-600">
                NPR {event.totalSpent.toLocaleString()}
              </p>

              {/* ✅ Budget Breakdown */}
              <div className="mt-3 text-xs text-gray-500 text-left border-t border-gray-200 dark:border-gray-700 pt-2">
                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Budget Breakdown
                </p>
                {bookings.map((booking) => {
                  const isDeclined = booking.bookingStatus === "DECLINED";
                  const isRefunded = booking.refundStatus === "PROCESSED";
                  return (
                    <div
                      key={booking.id}
                      className="flex justify-between items-center py-0.5"
                    >
                      <span className="flex items-center gap-1">
                        {isDeclined ? (
                          <XCircleIcon className="h-3 w-3 text-red-500" />
                        ) : (
                          <CheckCircleIcon className="h-3 w-3 text-green-500" />
                        )}
                        <span className="truncate max-w-[120px]">
                          {booking.vendorName}
                        </span>
                        {isDeclined && (
                          <span className="text-red-500 text-[10px]">
                            {isRefunded ? "(Refunded ✓)" : "(Declined)"}
                          </span>
                        )}
                      </span>
                      <span
                        className={
                          isDeclined
                            ? "text-gray-400 line-through"
                            : "font-medium"
                        }
                      >
                        {isDeclined
                          ? "NPR 0"
                          : `NPR ${booking.totalAmount.toLocaleString()}`}
                      </span>
                    </div>
                  );
                })}
                <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1 flex justify-between font-medium">
                  <span className="text-gray-600 dark:text-gray-400">
                    Active Bookings
                  </span>
                  <span>NPR {totalActiveBookings.toLocaleString()}</span>
                </div>
                {totalRefunded > 0 && (
                  <div className="flex justify-between text-red-500 text-[10px]">
                    <span>Refunded (Declined)</span>
                    <span>- NPR {totalRefunded.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* ✅ Payment Summary */}
              <div className="mt-2 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-2">
                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payments
                </p>
                {totalDepositsPaid > 0 && (
                  <div className="flex justify-between">
                    <span>Deposits Paid</span>
                    <span className="text-green-600 font-medium">
                      NPR {totalDepositsPaid.toLocaleString()}
                    </span>
                  </div>
                )}
                {totalRemaining > 0 && (
                  <div className="flex justify-between">
                    <span>Remaining Due</span>
                    <span className="text-amber-600 font-medium">
                      NPR {totalRemaining.toLocaleString()}
                    </span>
                  </div>
                )}
                {totalFullyPaid > 0 && (
                  <div className="flex justify-between">
                    <span>Fully Paid</span>
                    <span className="text-green-600 font-medium">
                      NPR {totalFullyPaid.toLocaleString()}
                    </span>
                  </div>
                )}
                {totalDepositsPaid === 0 &&
                  totalRemaining === 0 &&
                  totalFullyPaid === 0 && (
                    <div className="text-gray-400 text-center py-1">
                      No payments made yet
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Escrow Info Banner */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Secure Escrow Protection
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-500">
                  Your payments are held in secure escrow and will be released
                  to vendors only after service delivery. You&apos;re protected
                  against fraud and non-delivery.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Add Vendor Button */}
        {eventUpcoming && (
          <div className="mb-6">
            <Link
              href={`/marketplace?eventId=${event.id}&eventTitle=${encodeURIComponent(event.title)}&eventDate=${formattedDate}&guestCount=${event.guestCount}`}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Another Vendor
            </Link>
          </div>
        )}

        {/* Bookings List */}
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Vendor Bookings
        </h2>

        {bookings.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
            <BuildingOfficeIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No vendors booked yet</p>
            <Link
              href="/marketplace"
              className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Browse Vendors
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const status = getStatusBadge(booking.bookingStatus);
              const StatusIcon = status.icon;
              const paymentStatus = getPaymentStatusBadge(
                booking.vendorPaymentStatus,
              );
              const depositAmount =
                booking.depositAmount || booking.totalAmount * 0.2;
              const remainingAmount =
                booking.remainingAmount || booking.totalAmount * 0.8;
              const paymentPercentage = calculatePaymentPercentage(booking);

              const canPayRemaining =
                booking.vendorPaymentStatus === "DEPOSIT_PAID" &&
                booking.bookingStatus === "ACCEPTED" &&
                eventUpcoming &&
                !booking.remainingPaidAt;

              const isDeclined = booking.bookingStatus === "DECLINED";
              const isPendingApproval =
                booking.bookingStatus === "PENDING" &&
                booking.vendorPaymentStatus === "DEPOSIT_PAID";

              return (
                <div
                  key={booking.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {booking.vendorName}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.text}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentStatus.color}`}
                        >
                          <BanknotesIcon className="h-3 w-3 mr-1" />
                          {paymentStatus.text}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {booking.serviceType} • {booking.packageName}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <MapPinIcon className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {booking.location}
                        </span>
                      </div>

                      {/* Payment Summary */}
                      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Total:</span>
                            <span className="ml-1 font-semibold text-gray-900 dark:text-white">
                              NPR {booking.totalAmount.toLocaleString()}
                            </span>
                          </div>

                          {booking.vendorPaymentStatus === "DEPOSIT_PAID" && (
                            <>
                              <div>
                                <span className="text-gray-500">
                                  Deposit Paid:
                                </span>
                                <span className="ml-1 font-medium text-green-600">
                                  NPR {depositAmount.toLocaleString()}
                                </span>
                                {booking.depositPaidAt && (
                                  <span className="text-xs text-gray-400 ml-1">
                                    (
                                    {new Date(
                                      booking.depositPaidAt,
                                    ).toLocaleDateString()}
                                    )
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="text-gray-500">
                                  Remaining Due:
                                </span>
                                <span className="ml-1 font-medium text-amber-600">
                                  NPR {remainingAmount.toLocaleString()}
                                </span>
                              </div>
                            </>
                          )}

                          {booking.vendorPaymentStatus === "FULLY_PAID" && (
                            <div>
                              <span className="text-gray-500">Fully Paid:</span>
                              <span className="ml-1 font-medium text-green-600">
                                NPR {booking.totalAmount.toLocaleString()}
                              </span>
                              {booking.remainingPaidAt && (
                                <span className="text-xs text-gray-400 ml-1">
                                  (Paid{" "}
                                  {new Date(
                                    booking.remainingPaidAt,
                                  ).toLocaleDateString()}
                                  )
                                </span>
                              )}
                            </div>
                          )}

                          {isDeclined && (
                            <div>
                              <span className="text-gray-500">Refunded:</span>
                              <span className="ml-1 font-medium text-red-600">
                                NPR {booking.totalAmount.toLocaleString()}
                              </span>
                              {booking.refundStatus === "PROCESSED" && (
                                <span className="text-xs text-green-500 ml-1">
                                  ✓ Processed
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Payment Progress Bar */}
                        {!isDeclined && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  paymentPercentage === 100
                                    ? "bg-green-600"
                                    : "bg-blue-600"
                                }`}
                                style={{ width: `${paymentPercentage}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {paymentPercentage === 100
                                ? "✓ Fully paid"
                                : paymentPercentage === 20
                                  ? "20% deposit paid • 80% remaining"
                                  : "Payment pending"}
                            </p>
                          </div>
                        )}

                        {/* Escrow Note */}
                        {(booking.vendorPaymentStatus === "DEPOSIT_PAID" ||
                          booking.vendorPaymentStatus === "FULLY_PAID") &&
                          !isDeclined && (
                            <div className="mt-2">
                              <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <ShieldCheckIcon className="h-3 w-3" />
                                Your payment is securely held in escrow
                              </p>
                            </div>
                          )}

                        {/* Decline/Cancellation Info */}
                        {isDeclined && (
                          <div className="mt-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                            {booking.cancelledBy === "CUSTOMER" ? (
                              <p className="text-xs text-orange-600 dark:text-orange-400">
                                <XCircleIcon className="h-3 w-3 inline mr-1" />
                                You cancelled this booking
                              </p>
                            ) : (
                              <p className="text-xs text-red-600 dark:text-red-400">
                                <XCircleIcon className="h-3 w-3 inline mr-1" />
                                Vendor declined this booking
                                {booking.declineReason &&
                                  `: ${booking.declineReason}`}
                              </p>
                            )}
                            {booking.refundStatus && (
                              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                {booking.refundStatus === "PROCESSED" ? (
                                  <>
                                    <CheckCircleIcon className="h-3 w-3 text-green-500" />
                                    Refund:{" "}
                                    {getRefundStatusText(booking.refundStatus)}
                                  </>
                                ) : (
                                  <>
                                    <ClockIcon className="h-3 w-3" />
                                    Refund:{" "}
                                    {getRefundStatusText(booking.refundStatus)}
                                  </>
                                )}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Pending Approval Message */}
                        {isPendingApproval && (
                          <div className="mt-3 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                              <ClockIcon className="h-3 w-3" />
                              Waiting for vendor to accept your booking
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[160px]">
                      {/* View Details Link */}
                      <Link
                        href={`/bookings/${booking.id}?returnTo=events&eventId=${event.id}`}
                        className="flex items-center justify-center px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View Details
                      </Link>

                      {/* Pay Deposit Button */}
                      {booking.vendorPaymentStatus === "PENDING" &&
                        booking.bookingStatus !== "DECLINED" &&
                        eventUpcoming && (
                          <PaymentButton
                            amount={depositAmount}
                            bookingId={booking.id}
                            paymentType="VENDOR_DEPOSIT"
                            gateway="khalti"
                            returnUrl={`/dashboard/events/${event.id}`}
                            buttonText={`Pay Deposit (20% - NPR ${depositAmount.toLocaleString()})`}
                            onSuccess={() => window.location.reload()}
                          />
                        )}

                      {/* Pay Remaining Button */}
                      {canPayRemaining && (
                        <PaymentButton
                          amount={remainingAmount}
                          bookingId={booking.id}
                          paymentType="VENDOR_REMAINING"
                          gateway="khalti"
                          returnUrl={`/dashboard/events/${event.id}`}
                          buttonText={`Pay Remaining (NPR ${remainingAmount.toLocaleString()})`}
                          onSuccess={() => window.location.reload()}
                        />
                      )}

                      {/* Disabled message if event passed */}
                      {booking.vendorPaymentStatus === "DEPOSIT_PAID" &&
                        booking.bookingStatus === "ACCEPTED" &&
                        eventPassed &&
                        !booking.remainingPaidAt && (
                          <div className="text-center text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 p-2 rounded-lg">
                            <InformationCircleIcon className="h-3 w-3 inline mr-1" />
                            Event completed. Contact support for payment.
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Payment Summary Footer */}
        {bookings.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <p className="text-sm text-gray-500">Payment Summary</p>
                <p className="text-xs text-gray-400">All amounts in NPR</p>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Total Budget:</span>
                  <span className="ml-1 font-semibold text-gray-900 dark:text-white">
                    NPR {event.totalSpent.toLocaleString()}
                  </span>
                </div>
                {totalDepositsPaid > 0 && (
                  <div>
                    <span className="text-gray-500">Deposits Paid:</span>
                    <span className="ml-1 font-semibold text-green-600">
                      NPR {totalDepositsPaid.toLocaleString()}
                    </span>
                  </div>
                )}
                {totalRemaining > 0 && (
                  <div>
                    <span className="text-gray-500">Remaining Due:</span>
                    <span className="ml-1 font-semibold text-amber-600">
                      NPR {totalRemaining.toLocaleString()}
                    </span>
                  </div>
                )}
                {totalFullyPaid > 0 && (
                  <div>
                    <span className="text-gray-500">Fully Paid:</span>
                    <span className="ml-1 font-semibold text-green-600">
                      NPR {totalFullyPaid.toLocaleString()}
                    </span>
                  </div>
                )}
                {totalRefunded > 0 && (
                  <div>
                    <span className="text-gray-500">Refunded:</span>
                    <span className="ml-1 font-semibold text-red-500">
                      NPR {totalRefunded.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Event Completion Warning */}
        {eventPassed && totalRemaining > 0 && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-2">
              <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Event has passed with pending payments
                </p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                  You have unpaid remaining amounts for vendors. Since the event
                  is completed, please contact support to arrange payment.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
