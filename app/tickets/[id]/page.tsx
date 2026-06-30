"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { 
  TicketIcon, 
  CalendarIcon, 
  MapPinIcon, 
  ClockIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentIcon,
  CurrencyRupeeIcon,
  IdentificationIcon,
  CreditCardIcon,
  SparklesIcon,
  ShieldCheckIcon,
  BanknotesIcon
} from "@heroicons/react/24/outline";

interface Ticket {
  id: string;
  ticketNumber: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  ticketName: string;
  quantity: number;
  totalAmount: number;
  qrCodeHash: string;
  checkedIn: boolean;
  transactionId: string;
  eventId: string;
  userId: string;
  createdAt: string;
  paymentStatus: string;
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const response = await fetch(`/api/user/tickets/${params.id}`);
        const data = await response.json();
        console.log("📋 Ticket data:", data);
        setTicket(data);
        
        if (data.qrCodeHash && data.id) {
          try {
            const qrPayload = {
              ticketId: data.id,
              eventId: data.eventId,
              hash: data.qrCodeHash,
              userId: data.userId,
              timestamp: data.createdAt || new Date().toISOString(),
              signature: generateSignature(data.id, data.qrCodeHash, data.eventId)
            };
            
            console.log("📱 Generating QR with payload:", qrPayload);
            
            const qrData = JSON.stringify(qrPayload);
            
            const qrUrl = await QRCode.toDataURL(qrData, {
              width: 300,
              margin: 2,
              errorCorrectionLevel: 'H',
              color: {
                dark: '#1a1a1a',
                light: '#ffffff'
              }
            });
            
            setQrCodeUrl(qrUrl);
            setQrError(null);
          } catch (qrErr) {
            console.error("❌ QR generation error:", qrErr);
            setQrError("Failed to generate QR code");
            try {
              const fallbackUrl = await QRCode.toDataURL(data.qrCodeHash, {
                width: 300,
                margin: 2,
                errorCorrectionLevel: 'H'
              });
              setQrCodeUrl(fallbackUrl);
              setQrError("Using fallback QR format");
            } catch (fallbackErr) {
              console.error("❌ Fallback QR generation also failed:", fallbackErr);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching ticket:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTicket();
  }, [params.id]);

  const generateSignature = (ticketId: string, hash: string, eventId: string) => {
    const data = `${ticketId}-${hash}-${eventId}`;
    let signature = 0;
    for (let i = 0; i < data.length; i++) {
      signature = ((signature << 5) - signature) + data.charCodeAt(i);
      signature = signature & signature;
    }
    return signature.toString(36);
  };

  const copyTicketNumber = () => {
    if (ticket?.ticketNumber) {
      navigator.clipboard.writeText(ticket.ticketNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyTicketId = () => {
    if (ticket?.id) {
      navigator.clipboard.writeText(ticket.id);
      const notification = document.createElement('div');
      notification.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm z-50';
      notification.textContent = 'Ticket ID copied for manual check-in';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading ticket...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <p className="text-gray-500">Ticket not found</p>
          <Link href="/my-tickets" className="mt-4 inline-block text-indigo-600">
            Back to My Tickets
          </Link>
        </div>
      </div>
    );
  }

  const isCheckedIn = ticket.checkedIn;
  const eventDate = new Date(ticket.eventDate);
  const isUpcoming = eventDate > new Date();
  
  // ✅ Updated payment status logic
  const isPaid = ticket.paymentStatus === "COMPLETED" || ticket.paymentStatus === "HELD_IN_ESCROW";
  const isPaymentPending = ticket.paymentStatus === "PENDING";
  const isPaymentFailed = ticket.paymentStatus === "FAILED";

  // ✅ Helper to get payment status display
  const getPaymentStatusDisplay = () => {
    switch (ticket.paymentStatus) {
      case "COMPLETED":
        return { text: "Paid", color: "text-green-600 dark:text-green-400", bg: "bg-green-500" };
      case "HELD_IN_ESCROW":
        return { text: "Payment Confirmed (Escrow)", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500" };
      case "PENDING":
        return { text: "Awaiting Payment", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500" };
      case "FAILED":
        return { text: "Payment Failed", color: "text-red-600 dark:text-red-400", bg: "bg-red-500" };
      default:
        return { text: ticket.paymentStatus || "Unknown", color: "text-gray-500", bg: "bg-gray-500" };
    }
  };

  // ✅ Helper to get ticket status badge
  const getTicketStatusBadge = () => {
    if (isCheckedIn) {
      return {
        text: "Checked In",
        icon: CheckCircleIcon,
        color: "bg-green-500"
      };
    }
    if (isUpcoming && isPaid) {
      return {
        text: "Active",
        icon: ClockIcon,
        color: "bg-blue-500"
      };
    }
    if (isPaymentPending) {
      return {
        text: "Payment Pending",
        icon: ClockIcon,
        color: "bg-yellow-500"
      };
    }
    if (isPaymentFailed) {
      return {
        text: "Payment Failed",
        icon: XCircleIcon,
        color: "bg-red-500"
      };
    }
    return {
      text: "Expired",
      icon: XCircleIcon,
      color: "bg-gray-500"
    };
  };

  const statusBadge = getTicketStatusBadge();
  const paymentDisplay = getPaymentStatusDisplay();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <Link
          href="/my-tickets"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mb-6 group"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
          Back to My Tickets
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="bg-white/20 p-2 rounded-xl">
                  <TicketIcon className="h-5 w-5 text-white" />
                </div>
                <span className="text-white font-semibold">Event Ticket</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex items-center space-x-1 ${statusBadge.color} px-3 py-1.5 rounded-full`}>
                  <statusBadge.icon className="h-3.5 w-3.5 text-white" />
                  <span className="text-xs text-white font-medium">{statusBadge.text}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Event Info */}
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {ticket.eventTitle}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {ticket.ticketName} • {ticket.quantity} ticket(s)
            </p>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mr-3">
                  <CalendarIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Date</p>
                  <p className="text-sm font-medium">{eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
              
              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mr-3">
                  <ClockIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Time</p>
                  <p className="text-sm font-medium">{ticket.eventTime}</p>
                </div>
              </div>
              
              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mr-3">
                  <MapPinIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Venue</p>
                  <p className="text-sm font-medium">{ticket.eventLocation}</p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dashed border-gray-200 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center">
                <div className="bg-white dark:bg-gray-800 px-2">
                  <SparklesIcon className="h-4 w-4 text-indigo-400" />
                </div>
              </div>
            </div>

            {/* Ticket Details */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center">
                  <IdentificationIcon className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Ticket Number</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-xs font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {ticket.ticketNumber || 'N/A'}
                  </code>
                  {ticket.ticketNumber && (
                    <button
                      onClick={copyTicketNumber}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      title="Copy ticket number"
                    >
                      <ClipboardDocumentIcon className="h-4 w-4" />
                    </button>
                  )}
                  {copied && (
                    <span className="text-xs text-green-500">Copied!</span>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center">
                  <ShieldCheckIcon className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Ticket ID</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {ticket.id.substring(0, 8)}...
                  </code>
                  <button
                    onClick={copyTicketId}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Copy ticket ID for manual check-in"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center">
                  <TicketIcon className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Ticket Type</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white text-sm">{ticket.ticketName}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center">
                  <CurrencyRupeeIcon className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Total Amount</span>
                </div>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-sm">
                  NPR {ticket.totalAmount.toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center">
                  <CreditCardIcon className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Transaction ID</span>
                </div>
                <code className="font-mono text-xs text-gray-500 dark:text-gray-400">
                  {ticket.transactionId?.slice(0, 16)}...
                </code>
              </div>

              {/* ✅ Updated Payment Status */}
              <div className="flex justify-between py-2">
                <div className="flex items-center">
                  <BanknotesIcon className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Payment Status</span>
                </div>
                <span className={`text-sm font-medium ${paymentDisplay.color}`}>
                  {paymentDisplay.text}
                </span>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                  <SparklesIcon className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                    Scan for Entry
                  </span>
                </div>
              </div>
              <div className="flex justify-center">
                {qrCodeUrl ? (
                  <div className="p-3 bg-white rounded-2xl shadow-md relative">
                    <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                    {qrError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
                        <span className="text-white text-xs text-center p-2">{qrError}</span>
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[8px] px-1.5 py-0.5 rounded-full">
                      v2
                    </div>
                  </div>
                ) : (
                  <div className="w-48 h-48 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                    <span className="text-gray-400 text-sm">QR Code</span>
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-gray-400 mt-4">
                Please present this QR code at the venue entrance for check-in
              </p>
              {process.env.NODE_ENV === 'development' && ticket && (
                <details className="mt-2 text-xs text-gray-400">
                  <summary className="cursor-pointer">Debug Info</summary>
                  <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-[10px] break-all">
                    Ticket ID: {ticket.id}
                    <br />
                    Event ID: {ticket.eventId}
                    <br />
                    Hash: {ticket.qrCodeHash?.substring(0, 32)}...
                  </div>
                </details>
              )}
            </div>

            {/* ✅ Updated Footer Notes */}
            {!isCheckedIn && isUpcoming && isPaid && (
              <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
                  📌 Keep this ticket handy. You'll need the QR code or ticket number for entry.
                </p>
              </div>
            )}
            
            {isPaymentPending && (
              <div className="mt-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center">
                  ⏳ Payment pending. Please complete payment to access the event.
                </p>
              </div>
            )}

            {isPaymentFailed && (
              <div className="mt-6 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-xs text-red-600 dark:text-red-400 text-center">
                  ❌ Payment failed. Please contact support for assistance.
                </p>
              </div>
            )}
            
            {isCheckedIn && (
              <div className="mt-6 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-xs text-green-600 dark:text-green-400 text-center flex items-center justify-center gap-1">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  ✓ You have been checked in for this event
                </p>
              </div>
            )}

            {isPaid && !isCheckedIn && !isUpcoming && (
              <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  This event has passed. Check-in is no longer available.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}