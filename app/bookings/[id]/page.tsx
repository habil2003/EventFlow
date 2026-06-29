"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BuildingOfficeIcon,
  CalendarIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon as PendingIcon,
  ArrowLeftIcon,
  CurrencyRupeeIcon,
  CreditCardIcon,
  DocumentTextIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import PaymentButton from "@/components/PaymentButton";

interface AddOn {
  name: string;
  price: number;
}

interface BookingDetail {
  id: string;
  vendorName: string;
  serviceType: string;
  packageName: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  vendorPaymentStatus: string;
  paymentStatus: string;
  bookingStatus: string;
  eventDate: string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  dailyRate?: number;
  discountPercent?: number;
  eventTitle: string;
  location: string;
  addOns: AddOn[];
  createdAt: string;
  depositPaidAt?: string;
  remainingPaidAt?: string;
  amountReleasedAt?: string;
  // ✅ Cancellation & refund fields
  cancelledBy?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  refundStatus?: string | null;
  refundAmount?: number | null;
  refundPercentage?: number | null;
}

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [mounted, setMounted] = useState(false);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const returnTo = searchParams.get("returnTo") || "upcoming";
  const eventId = searchParams.get("eventId");

  let backUrl = "/my-bookings";
  let backText = "Back to My Bookings";

  if (returnTo === "events" && eventId) {
    backUrl = `/dashboard/events/${eventId}`;
    backText = "Back to Event";
  } else if (returnTo === "events") {
    backUrl = "/my-bookings?tab=events";
    backText = "Back to My Events";
  } else if (returnTo === "upcoming") {
    backUrl = "/my-bookings?tab=upcoming";
    backText = "Back to Upcoming Bookings";
  } else if (returnTo === "past") {
    backUrl = "/my-bookings?tab=past";
    backText = "Back to Past Bookings";
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const getId = async () => {
      const resolvedParams = await params;
      setBookingId(resolvedParams.id as string);
    };
    getId();
  }, [params]);

  useEffect(() => {
    if (!bookingId) return;
    const fetchBooking = async () => {
      try {
        const response = await fetch(`/api/user/vendor-bookings/${bookingId}`);
        const data = await response.json();
        setBooking(data);
      } catch (error) {
        console.error("Error fetching booking:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [bookingId]);

  const getBookingStatusBadge = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return { text: "Confirmed", icon: CheckCircleIcon, color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" };
      case "PENDING":
        return { text: "Pending", icon: PendingIcon, color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" };
      case "DECLINED":
        return { text: "Declined", icon: XCircleIcon, color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" };
      case "COMPLETED":
        return { text: "Completed", icon: CheckCircleIcon, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" };
      default:
        return { text: status, icon: PendingIcon, color: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400" };
    }
  };

  const getVendorPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "DEPOSIT_PAID":
        return { text: "Deposit Paid", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" };
      case "FULLY_PAID":
        return { text: "Fully Paid", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" };
      case "PENDING":
        return { text: "Payment Pending", color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" };
      default:
        return { text: status || "Pending", color: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400" };
    }
  };

  const getEscrowStatusBadge = (status: string) => {
    switch (status) {
      case "HELD_IN_ESCROW":
        return { text: "Funds in Escrow", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" };
      case "COMPLETED":
        return { text: "Released to Vendor", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" };
      case "PENDING":
        return { text: "Pending", color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" };
      case "REFUNDED":
        return { text: "Refunded", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" };
      default:
        return { text: status, color: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400" };
    }
  };

  const isEventCompleted = () => {
    if (!booking) return false;
    const eventDate = booking.endDate
      ? new Date(booking.endDate)
      : new Date(booking.eventDate);
    return eventDate < new Date();
  };

  const canPayRemaining = () => {
    return (
      booking?.vendorPaymentStatus === "DEPOSIT_PAID" &&
      !booking?.remainingPaidAt &&
      isEventCompleted()
    );
  };

  const canPayDeposit = () => {
    return (
      booking?.vendorPaymentStatus === "PENDING" &&
      !booking?.depositPaidAt &&
      booking?.bookingStatus !== "DECLINED"
    );
  };

  const canCancelWithRefund = () => {
    return (
      booking?.bookingStatus === "ACCEPTED" &&
      booking?.vendorPaymentStatus === "DEPOSIT_PAID" &&
      !!booking?.depositPaidAt
    );
  };

  const canCancelWithoutRefund = () => {
    return (
      booking?.bookingStatus === "PENDING" &&
      booking?.vendorPaymentStatus === "PENDING"
    );
  };

  const handleCancelWithRefund = async () => {
    const reason = prompt(
      "Reason for cancellation (optional):\n\nRefund policy:\n≥7 days before event: 100% refund\n3–6 days before event: 50% refund\n<3 days before event: No refund"
    );
    if (reason === null) return; // user dismissed prompt

    if (
      !confirm(
        "Are you sure you want to cancel this booking? This cannot be undone."
      )
    )
      return;

    setCancelling(true);
    try {
      const response = await fetch("/api/user/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking!.id,
          bookingType: "VENDOR",
          reason: reason || "Customer cancelled booking",
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
      alert("An error occurred. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const handleCancelWithoutRefund = async () => {
    if (
      !confirm(
        "Are you sure you want to cancel this booking? This action cannot be undone."
      )
    )
      return;

    setCancelling(true);
    try {
      const response = await fetch(
        `/api/user/vendor-bookings/${booking!.id}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (response.ok) {
        alert("Booking cancelled successfully");
        router.push("/my-bookings");
      } else {
        alert(data.error || "Failed to cancel booking");
      }
    } catch (error) {
      alert("An error occurred. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const calculateMultiDayDiscountAmount = () => {
    if (
      !booking ||
      !booking.totalDays ||
      !booking.dailyRate ||
      !booking.discountPercent
    )
      return 0;
    return (
      (booking.dailyRate * booking.totalDays * booking.discountPercent) / 100
    );
  };

  if (status === "loading" || !mounted || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Booking not found
          </h1>
          <Link
            href="/my-bookings"
            className="mt-4 inline-block text-indigo-600 dark:text-indigo-400"
          >
            Back to My Bookings
          </Link>
        </div>
      </div>
    );
  }

  const bookingStatus = getBookingStatusBadge(booking.bookingStatus);
  const vendorPaymentStatus = getVendorPaymentStatusBadge(
    booking.vendorPaymentStatus
  );
  const escrowStatus = getEscrowStatusBadge(booking.paymentStatus);
  const StatusIcon = bookingStatus.icon;
  const eventPassed = isEventCompleted();
  const depositAmount =
    booking.depositAmount || booking.totalAmount * 0.2 || 0;
  const remainingAmount =
    booking.remainingAmount || booking.totalAmount * 0.8 || 0;
  const isMultiDay =
    booking.startDate &&
    booking.endDate &&
    booking.startDate !== booking.endDate;
  const multiDayDiscount = calculateMultiDayDiscountAmount();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-6">

          {/* Back Button */}
          <Link
            href={backUrl}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            {backText}
          </Link>

          {/* Booking Header */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {booking.vendorName}
                  </h1>
                  <p className="text-white/80 mt-1">{booking.serviceType}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${bookingStatus.color}`}
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {bookingStatus.text}
                  </span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${vendorPaymentStatus.color}`}
                  >
                    {vendorPaymentStatus.text}
                  </span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${escrowStatus.color}`}
                  >
                    {escrowStatus.text}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">

              {/* Event Info */}
              <div>
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Event
                </h2>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {booking.eventTitle}
                </p>
              </div>

              {/* Date & Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Event Dates
                  </h2>
                  <div className="flex items-center mt-1">
                    <CalendarIcon className="h-5 w-5 text-indigo-500 mr-2" />
                    <div>
                      {isMultiDay ? (
                        <>
                          <span className="text-gray-900 dark:text-white">
                            {new Date(booking.startDate!).toLocaleDateString()}{" "}
                            -{" "}
                            {new Date(booking.endDate!).toLocaleDateString()}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {booking.totalDays} days total
                          </p>
                        </>
                      ) : (
                        <span className="text-gray-900 dark:text-white">
                          {new Date(booking.eventDate).toLocaleDateString()}
                        </span>
                      )}
                      {eventPassed && (
                        <span className="ml-2 text-xs text-green-600">
                          (Event Completed)
                        </span>
                      )}
                      {!eventPassed && (
                        <span className="ml-2 text-xs text-amber-600">
                          (Upcoming)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Location
                  </h2>
                  <div className="flex items-center mt-1">
                    <MapPinIcon className="h-5 w-5 text-indigo-500 mr-2" />
                    <span className="text-gray-900 dark:text-white">
                      {booking.location}
                    </span>
                  </div>
                </div>
              </div>

              {/* Package Details */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Package
                </h2>
                <p className="font-medium text-gray-900 dark:text-white">
                  {booking.packageName}
                </p>
                {booking.addOns && booking.addOns.length > 0 && (
                  <div className="mt-3">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Add-ons
                    </h3>
                    <ul className="space-y-1">
                      {booking.addOns.map((addon, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-gray-600 dark:text-gray-300"
                        >
                          {addon.name} -{" "}
                          <span className="font-medium">
                            NPR {addon.price?.toLocaleString() || "0"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Payment Summary */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                  Payment Summary
                </h2>
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 space-y-2">
                  {isMultiDay && booking.dailyRate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">
                        Daily Rate
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        NPR {booking.dailyRate.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {isMultiDay && booking.totalDays && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">
                        Number of Days
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {booking.totalDays} days
                      </span>
                    </div>
                  )}
                  {isMultiDay && booking.dailyRate && booking.totalDays && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">
                        Subtotal
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        NPR{" "}
                        {(
                          booking.dailyRate * booking.totalDays
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {isMultiDay &&
                    booking.discountPercent &&
                    booking.discountPercent > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>
                          Multi-day Discount ({booking.discountPercent}%)
                        </span>
                        <span>- NPR {multiDayDiscount.toLocaleString()}</span>
                      </div>
                    )}
                  <div className="flex justify-between pt-2">
                    <span className="text-gray-600 dark:text-gray-300">
                      Total Amount
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      NPR {booking.totalAmount?.toLocaleString() || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">
                      Deposit (20%)
                    </span>
                    <div className="text-right">
                      <span className="font-medium text-gray-900 dark:text-white">
                        NPR {depositAmount?.toLocaleString() || "0"}
                      </span>
                      {booking.depositPaidAt && (
                        <p className="text-xs text-green-600">
                          Paid on{" "}
                          {new Date(
                            booking.depositPaidAt
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {booking.vendorPaymentStatus !== "FULLY_PAID" && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">
                        Remaining Balance (80%)
                      </span>
                      <div className="text-right">
                        <span className="font-medium text-amber-600">
                          NPR {remainingAmount?.toLocaleString() || "0"}
                        </span>
                        {booking.remainingPaidAt && (
                          <p className="text-xs text-green-600">
                            Paid on{" "}
                            {new Date(
                              booking.remainingPaidAt
                            ).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {booking.vendorPaymentStatus === "FULLY_PAID" && (
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                      <span className="text-gray-600 dark:text-gray-300">
                        Total Paid
                      </span>
                      <span className="font-medium text-green-600">
                        NPR {booking.totalAmount?.toLocaleString() || "0"}
                      </span>
                    </div>
                  )}
                  {booking.paymentStatus === "HELD_IN_ESCROW" && (
                    <div className="flex justify-between pt-2 text-sm">
                      <span className="text-gray-500">Funds Status</span>
                      <span className="text-purple-600">Held in Escrow</span>
                    </div>
                  )}
                  {booking.amountReleasedAt && (
                    <div className="flex justify-between pt-2 text-sm">
                      <span className="text-gray-500">Released to Vendor</span>
                      <span className="text-green-600">
                        {new Date(
                          booking.amountReleasedAt
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  {booking.vendorPaymentStatus === "PENDING" && (
                    <>💳 20% deposit required to confirm your booking.</>
                  )}
                  {booking.vendorPaymentStatus === "DEPOSIT_PAID" &&
                    !eventPassed && (
                      <>
                        💰 Deposit paid. Remaining balance will be due after
                        the event.
                      </>
                    )}
                  {booking.vendorPaymentStatus === "DEPOSIT_PAID" &&
                    eventPassed &&
                    !booking.remainingPaidAt && (
                      <>
                        ⏰ Event completed! Please pay the remaining balance to
                        release funds to the vendor.
                      </>
                    )}
                  {booking.vendorPaymentStatus === "FULLY_PAID" && (
                    <>✅ Fully paid. Thank you for your payment!</>
                  )}
                </p>
              </div>

              {/* Payment Buttons */}
              {canPayDeposit() && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  <PaymentButton
                    amount={depositAmount}
                    bookingId={booking.id}
                    paymentType="VENDOR_DEPOSIT"
                    gateway="khalti"
                    returnUrl={backUrl}
                    buttonText={`Pay Deposit (20% - NPR ${depositAmount?.toLocaleString() || "0"})`}
                    onSuccess={() => window.location.reload()}
                  />
                </div>
              )}

              {canPayRemaining() && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  <PaymentButton
                    amount={remainingAmount}
                    bookingId={booking.id}
                    paymentType="VENDOR_REMAINING"
                    gateway="khalti"
                    buttonText={`Pay Remaining Balance (NPR ${remainingAmount?.toLocaleString() || "0"})`}
                    onSuccess={() => window.location.reload()}
                  />
                </div>
              )}

              {/* ✅ Cancel without refund — PENDING + no deposit */}
              {canCancelWithoutRefund() && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  <button
                    onClick={handleCancelWithoutRefund}
                    disabled={cancelling}
                    className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {cancelling ? "Cancelling..." : "Cancel Booking"}
                  </button>
                </div>
              )}

              {/* ✅ Cancel with refund — ACCEPTED + deposit paid */}
              {canCancelWithRefund() && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  <button
                    onClick={handleCancelWithRefund}
                    disabled={cancelling}
                    className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {cancelling
                      ? "Processing..."
                      : "Cancel Booking & Request Refund"}
                  </button>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                    Refund policy: ≥7 days notice → 100% · 3–6 days → 50% · &lt;3 days → 0%
                  </p>
                </div>
              )}

              {/* ✅ Cancellation & Refund Status Section */}
              {(booking.bookingStatus === "DECLINED" ||
                booking.refundStatus) && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                    Cancellation &amp; Refund
                  </h2>
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 space-y-3">

                    {/* Who cancelled */}
                    {booking.cancelledBy === "CUSTOMER" && (
                      <div className="flex items-center gap-2">
                        <XCircleIcon className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-medium">Cancelled by you</span>
                          {booking.cancelledAt && (
                            <span className="text-gray-500 dark:text-gray-400 ml-1">
                              on{" "}
                              {new Date(
                                booking.cancelledAt
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                    {booking.cancelledBy === "VENDOR" && (
                      <div className="flex items-center gap-2">
                        <XCircleIcon className="h-4 w-4 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-medium">
                            Declined by vendor
                          </span>
                        </p>
                      </div>
                    )}
                    {!booking.cancelledBy &&
                      booking.bookingStatus === "DECLINED" && (
                        <div className="flex items-center gap-2">
                          <XCircleIcon className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">
                              Booking declined
                            </span>
                          </p>
                        </div>
                      )}

                    {booking.cancellationReason && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 ml-6">
                        Reason: {booking.cancellationReason}
                      </p>
                    )}

                    {/* Refund amount breakdown */}
                    {booking.refundStatus &&
                      booking.refundAmount != null && (
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">
                              Refund Amount
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              NPR {booking.refundAmount.toLocaleString()}
                            </span>
                          </div>
                          {booking.refundPercentage != null && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500 dark:text-gray-400">
                                Policy Applied
                              </span>
                              <span className="text-gray-700 dark:text-gray-300">
                                {booking.refundPercentage}% of deposit
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Refund status badge */}
                    {booking.refundStatus === "PENDING_ADMIN" && (
                      <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                        <ClockIcon className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                            Refund In Progress
                          </p>
                          <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                            Your refund is being processed. This typically
                            takes 3–7 business days.
                          </p>
                        </div>
                      </div>
                    )}
                    {booking.refundStatus === "PROCESSED" && (
                      <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                        <CheckCircleIcon className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-green-700 dark:text-green-400">
                            Refund Completed ✓
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                            Your refund has been sent. Check your Khalti
                            wallet or bank account.
                          </p>
                        </div>
                      </div>
                    )}
                    {booking.refundStatus === "FAILED" && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                        <XCircleIcon className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-700 dark:text-red-400">
                            Refund Failed
                          </p>
                          <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                            We couldn't process your refund automatically.
                            Please contact support.
                          </p>
                        </div>
                      </div>
                    )}
                    {!booking.refundStatus &&
                      booking.bookingStatus === "DECLINED" &&
                      booking.cancelledBy === "CUSTOMER" && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No refund applicable for this cancellation.
                        </p>
                      )}
                  </div>
                </div>
              )}

              {/* Booking Information */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Booking Information
                </h2>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-900 dark:text-white">
                    Booking ID:{" "}
                    <span className="font-mono text-xs">{booking.id}</span>
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    Created:{" "}
                    {new Date(booking.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}