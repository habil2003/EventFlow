"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    CurrencyRupeeIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    BanknotesIcon,
    BuildingOfficeIcon,
    ArrowPathIcon,
    ShieldCheckIcon,
    InformationCircleIcon,
    EyeIcon,
    PhotoIcon,
    UserIcon,
    MapPinIcon,
    MagnifyingGlassIcon,
    DocumentTextIcon,
    CalendarIcon,
    TagIcon,
} from "@heroicons/react/24/outline";

interface EscrowBooking {
    id: string;
    type: 'VENDOR' | 'TICKET';
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
    pendingPayouts?: any[];
    customerPaidDeposit?: boolean;
    customerPaidFull?: boolean;
    amountReleasedAt?: string | null;
    availableActions?: string[];
    vendorPaymentStatus?: string;
    depositReleasedAt?: string | null;
    // ✅ NEW FIELDS
    bookingStatus?: string;
    vendorAccepted?: boolean;
    vendorPending?: boolean;
    vendorDeclined?: boolean;
    vendorStatusDisplay?: string;
    vendorStatusColor?: string;
    depositReleaseDisabledReason?: string | null;
}

export default function AdminEscrowPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [bookings, setBookings] = useState<EscrowBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [releasingId, setReleasingId] = useState<string | null>(null);
    const [releaseType, setReleaseType] = useState<string | null>(null);
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
    const [selectedBooking, setSelectedBooking] = useState<EscrowBooking | null>(null);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [releaseModalOpen, setReleaseModalOpen] = useState(false);
    const [modalAction, setModalAction] = useState<'deposit' | 'remaining' | null>(null);
    const [escrowType, setEscrowType] = useState<"all" | "VENDOR" | "TICKET">("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "HELD_IN_ESCROW" | "PROCESSING_PAYOUT">("all");

    // Payout verification modal state
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [selectedPayout, setSelectedPayout] = useState<any>(null);
    const [verificationData, setVerificationData] = useState({
        transactionReference: '',
        transferMethod: 'BANK_TRANSFER',
        proofImage: null as File | null,
        notes: '',
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
        fetchEscrowData();
    }, []);

    const releaseFunds = async (bookingId: string, amount: number, type: string) => {
        const amountNPR = amount.toLocaleString();
        const commission = Math.round(amount * 0.1).toLocaleString();
        const payout = Math.round(amount * 0.9).toLocaleString();

        const confirmMessage = type === "deposit"
            ? `Release DEPOSIT of NPR ${amountNPR}?\n\n• Platform Commission (10%): NPR ${commission}\n• Vendor will receive: NPR ${payout}\n\nAfter this, you will need to manually transfer the money to the vendor and verify.`
            : `Release REMAINING amount of NPR ${amountNPR}?\n\n• Platform Commission (10%): NPR ${commission}\n• Vendor will receive: NPR ${payout}\n\nAfter this, you will need to manually transfer the money to the vendor and verify.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        setReleasingId(bookingId);
        setReleaseType(type);

        try {
            const response = await fetch("/api/admin/release-funds", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId, amount, type }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({ text: data.message || "Release initiated! Please manually transfer funds and verify.", type: "success" });
                setReleaseModalOpen(false);
                await fetchEscrowData();
                setTimeout(() => setMessage(null), 5000);
            } else {
                setMessage({ text: data.error || "Failed to release funds", type: "error" });
                setTimeout(() => setMessage(null), 5000);
            }
        } catch (error) {
            console.error("Error releasing funds:", error);
            setMessage({ text: "Error releasing funds. Please try again.", type: "error" });
            setTimeout(() => setMessage(null), 5000);
        } finally {
            setReleasingId(null);
            setReleaseType(null);
        }
    };

    const verifyPayout = async () => {
        if (!verificationData.transactionReference || !verificationData.proofImage) {
            alert('Please provide transaction reference and proof image');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', verificationData.proofImage);

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const uploadData = await uploadRes.json();
            const proofImageUrl = uploadData.url;

            const response = await fetch('/api/admin/verify-payout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payoutId: selectedPayout.id,
                    transactionReference: verificationData.transactionReference,
                    proofImageUrl: proofImageUrl,
                    transferMethod: verificationData.transferMethod,
                    notes: verificationData.notes,
                }),
            });

            if (response.ok) {
                setMessage({ text: 'Payout verified successfully!', type: "success" });
                setShowVerifyModal(false);
                setVerificationData({
                    transactionReference: '',
                    transferMethod: 'BANK_TRANSFER',
                    proofImage: null,
                    notes: '',
                });
                fetchEscrowData();
                setTimeout(() => setMessage(null), 3000);
            } else {
                const error = await response.json();
                setMessage({ text: error.error || 'Failed to verify payout', type: "error" });
                setTimeout(() => setMessage(null), 5000);
            }
        } catch (error) {
            console.error('Error verifying payout:', error);
            setMessage({ text: 'Error verifying payout', type: "error" });
            setTimeout(() => setMessage(null), 5000);
        } finally {
            setUploading(false);
        }
    };

    const openViewModal = (booking: EscrowBooking) => {
        setSelectedBooking(booking);
        setViewModalOpen(true);
    };

    const openReleaseModal = (booking: EscrowBooking, action: 'deposit' | 'remaining') => {
        setSelectedBooking(booking);
        setModalAction(action);
        setReleaseModalOpen(true);
    };

    const openVerifyModal = (payout: any) => {
        setSelectedPayout(payout);
        setShowVerifyModal(true);
    };

    const getReleaseStatusBadge = (booking: EscrowBooking) => {
        if (booking.paymentStatus === "PROCESSING_PAYOUT") {
            return {
                text: 'Pending Verification',
                color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                icon: ArrowPathIcon
            };
        }

        if (booking.type === 'VENDOR') {
            const fullyReleased = booking.hasRemainingPayout || booking.paymentStatus === 'COMPLETED';

            if (fullyReleased) {
                return { text: 'Fully Released', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircleIcon };
            }

            const depositReleasedByAdmin = booking.hasDepositPayout || !!booking.depositReleasedAt;

            if (depositReleasedByAdmin) {
                if (!booking.customerPaidFull) {
                    return { text: 'Deposit Released - Awaiting Customer Payment', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: ClockIcon };
                }
                if (booking.customerPaidFull && !booking.hasRemainingPayout) {
                    return { text: 'Ready to Release Remaining', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', icon: CurrencyRupeeIcon };
                }
            }

            if (booking.customerPaidDeposit && !depositReleasedByAdmin) {
                return { text: 'Deposit Paid - Ready to Release', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: ClockIcon };
            }

            if (booking.customerPaidFull && !depositReleasedByAdmin) {
                return { text: 'Fully Paid - Ready to Release', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircleIcon };
            }

            return { text: 'Pending Payment', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', icon: ClockIcon };
        }

        if (booking.type === 'TICKET') {
            if (booking.isCompleted) {
                return { text: 'Event Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircleIcon };
            }
            return { text: 'Awaiting Event', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: ClockIcon };
        }

        return { text: 'Unknown', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: ClockIcon };
    };

    const getVendorStatusBadge = (booking: EscrowBooking) => {
        if (booking.vendorAccepted) {
            return {
                text: '✓ Vendor Accepted',
                color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                icon: CheckCircleIcon
            };
        }
        if (booking.vendorPending) {
            return {
                text: '⏳ Waiting for Vendor',
                color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                icon: ClockIcon
            };
        }
        if (booking.vendorDeclined) {
            return {
                text: '✗ Vendor Declined',
                color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                icon: XCircleIcon
            };
        }
        return null;
    };

    const heldBookings = bookings.filter(b =>
        b.paymentStatus === "HELD_IN_ESCROW" || b.paymentStatus === "PROCESSING_PAYOUT"
    );

    let filteredBookings = heldBookings.filter(b => {
        if (escrowType === "all") return true;
        return b.type === escrowType;
    });

    if (searchTerm) {
        filteredBookings = filteredBookings.filter(b =>
            b.eventTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.vendorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.organizerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    if (statusFilter !== "all") {
        filteredBookings = filteredBookings.filter(b => b.paymentStatus === statusFilter);
    }

    const totalHeldAmount = heldBookings.reduce((sum, b) => {
        if (b.type === 'VENDOR') {
            if (b.hasDepositPayout && !b.hasRemainingPayout) {
                return sum + (b.remainingAmount || 0);
            }
            return sum + (b.depositAmount || 0);
        }
        return sum + b.totalAmount;
    }, 0);

    const pendingVendorApproval = bookings.filter(b =>
        b.type === 'VENDOR' &&
        b.vendorPending &&
        b.customerPaidDeposit &&
        !b.hasDepositPayout
    ).length;

    const totalPendingVerification = heldBookings.filter(b => b.paymentStatus === "PROCESSING_PAYOUT").length;

    if (status === "loading" || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
                <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading escrow data...</p>
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
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Escrow Management</h1>
                            <p className="mt-2 text-gray-500 dark:text-gray-400">
                                Manage funds held in escrow for vendor bookings and ticket sales
                            </p>
                        </div>
                        <button
                            onClick={fetchEscrowData}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <ArrowPathIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">Refresh</span>
                        </button>
                    </div>
                </div>

                {/* Message Alert */}
                <AnimatePresence>
                    {message && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={`mb-6 p-4 rounded-lg ${message.type === "success"
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

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Total in Escrow</p>
                                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">NPR {totalHeldAmount.toLocaleString()}</p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                <BanknotesIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{heldBookings.length} items in escrow</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Vendor Bookings</p>
                                <p className="text-2xl font-bold text-purple-600 dark:text-purple-500">{heldBookings.filter(b => b.type === 'VENDOR').length}</p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <BuildingOfficeIcon className="h-6 w-6 text-purple-600 dark:text-purple-500" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Ticket Sales</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-500">{heldBookings.filter(b => b.type === 'TICKET').length}</p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <CurrencyRupeeIcon className="h-6 w-6 text-blue-600 dark:text-blue-500" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Pending Verification</p>
                                <p className="text-2xl font-bold text-purple-600 dark:text-purple-500">{totalPendingVerification}</p>
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
                            {totalPendingVerification > 0 ? 'Awaiting manual verification' : 'All payouts verified'}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Awaiting Vendor Approval</p>
                            <p className="text-2xl font-bold text-orange-600 dark:text-orange-500">{pendingVendorApproval}</p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            <ClockIcon className="h-6 w-6 text-orange-600 dark:text-orange-500" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Deposit paid, waiting for vendor</p>
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
                            className={`px-3 py-2 text-sm rounded-lg font-medium ${escrowType === "all"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                }`}
                        >
                            All ({heldBookings.length})
                        </button>
                        <button
                            onClick={() => setEscrowType("VENDOR")}
                            className={`px-3 py-2 text-sm rounded-lg font-medium ${escrowType === "VENDOR"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                }`}
                        >
                            Vendors ({heldBookings.filter(b => b.type === 'VENDOR').length})
                        </button>
                        <button
                            onClick={() => setEscrowType("TICKET")}
                            className={`px-3 py-2 text-sm rounded-lg font-medium ${escrowType === "TICKET"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                }`}
                        >
                            Tickets ({heldBookings.filter(b => b.type === 'TICKET').length})
                        </button>
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    >
                        <option value="all">All Status</option>
                        <option value="HELD_IN_ESCROW">Held in Escrow</option>
                        <option value="PROCESSING_PAYOUT">Pending Verification</option>
                    </select>
                </div>

                {/* Escrow Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Funds Held in Escrow</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Bookings waiting for fund release to vendors/organizers</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Event / Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendor/Organizer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Commission</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendor Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredBookings.map((booking) => {
                                    const statusBadge = getReleaseStatusBadge(booking);
                                    const StatusIcon = statusBadge.icon;
                                    const isProcessingPayout = booking.paymentStatus === "PROCESSING_PAYOUT";
                                    const vendorStatusBadge = booking.type === 'VENDOR' ? getVendorStatusBadge(booking) : null;
                                    const canReleaseDeposit = booking.availableActions?.includes('RELEASE_DEPOSIT');
                                    const canReleaseRemaining = booking.availableActions?.includes('RELEASE_REMAINING');
                                    const depositDisabled = !canReleaseDeposit && booking.customerPaidDeposit && !booking.hasDepositPayout && !isProcessingPayout;
                                    const depositDisabledReason = booking.depositReleaseDisabledReason;

                                    return (
                                        <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            {/* Type column */}
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${booking.type === 'VENDOR'
                                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                    }`}>
                                                    {booking.type === 'VENDOR' ? 'Vendor' : 'Ticket'}
                                                </span>
                                            </td>

                                            {/* Event / Customer column */}
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-gray-900 dark:text-white">{booking.eventTitle}</p>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <UserIcon className="h-3 w-3 text-gray-400" />
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">{booking.customerName}</p>
                                                </div>
                                                <p className="text-xs text-gray-400 dark:text-gray-500">{booking.customerEmail}</p>
                                            </td>

                                            {/* Vendor/Organizer column */}
                                            <td className="px-6 py-4">
                                                <p className="text-gray-900 dark:text-white font-medium">
                                                    {booking.type === 'VENDOR' ? booking.vendorName : booking.organizerName}
                                                </p>
                                                {booking.type === 'VENDOR' && booking.location && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <MapPinIcon className="h-3 w-3 text-gray-400" />
                                                        <p className="text-xs text-gray-500">{booking.location}</p>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Amount column */}
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-green-600 dark:text-green-400">
                                                    NPR {(booking.type === 'VENDOR' ? booking.depositAmount : booking.totalAmount)?.toLocaleString()}
                                                </p>
                                                {booking.type === 'VENDOR' && booking.remainingAmount && !booking.hasRemainingPayout && (
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                        Remaining: NPR {booking.remainingAmount.toLocaleString()}
                                                    </p>
                                                )}
                                            </td>

                                            {/* Commission column */}
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-purple-600 dark:text-purple-400">
                                                    NPR {(booking.type === 'VENDOR'
                                                        ? (booking.depositAmount || 0) * 0.1
                                                        : booking.platformCommission
                                                    )?.toLocaleString()}
                                                </p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500">10% platform fee</p>
                                            </td>

                                            {/* Payment Status column */}
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                                                    <StatusIcon className={`h-3 w-3 mr-1 ${isProcessingPayout ? 'animate-spin' : ''}`} />
                                                    {statusBadge.text}
                                                </span>
                                            </td>

                                            {/* ✅ NEW: Vendor Status column */}
                                            <td className="px-6 py-4">
                                                {booking.type === 'VENDOR' && vendorStatusBadge ? (
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${vendorStatusBadge.color}`}>
                                                        <vendorStatusBadge.icon className="h-3 w-3 mr-1" />
                                                        {vendorStatusBadge.text}
                                                    </span>
                                                ) : booking.type === 'TICKET' ? (
                                                    <span className="text-xs text-gray-400">N/A</span>
                                                ) : null}
                                            </td>

                                            {/* Actions column */}
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2 flex-wrap">
                                                    <button
                                                        onClick={() => openViewModal(booking)}
                                                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        <EyeIcon className="h-4 w-4 inline mr-1" />
                                                        Details
                                                    </button>

                                                    {/* Release Deposit Button with disabled state and tooltip */}
                                                    {canReleaseDeposit && (
                                                        <button
                                                            onClick={() => openReleaseModal(booking, 'deposit')}
                                                            disabled={releasingId === booking.id}
                                                            className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                                                            title={depositDisabledReason || ''}
                                                        >
                                                            Release Deposit
                                                        </button>
                                                    )}

                                                    {/* Show disabled deposit button with reason */}
                                                    {depositDisabled && !canReleaseDeposit && !isProcessingPayout && (
                                                        <div className="relative group">
                                                            <button
                                                                disabled
                                                                className="px-3 py-1.5 text-sm rounded-lg bg-gray-400 text-white cursor-not-allowed"
                                                            >
                                                                Release Deposit
                                                            </button>
                                                            {depositDisabledReason && (
                                                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                                    {depositDisabledReason}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Release Remaining Button */}
                                                    {canReleaseRemaining && (
                                                        <button
                                                            onClick={() => openReleaseModal(booking, 'remaining')}
                                                            disabled={releasingId === booking.id}
                                                            className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                                        >
                                                            Release Remaining
                                                        </button>
                                                    )}

                                                    {/* Verify Payout Button */}
                                                    {isProcessingPayout && booking.hasPendingPayout && booking.pendingPayouts?.[0] && (
                                                        <button
                                                            onClick={() => {
  if (booking.pendingPayouts && booking.pendingPayouts.length > 0) {
    openVerifyModal(booking.pendingPayouts[0]);
  }
}}
                                                            className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                                                        >
                                                            <CheckCircleIcon className="h-4 w-4 inline mr-1" />
                                                            Verify Payout
                                                        </button>
                                                    )}

                                                    {/* Ticket Release Button */}
                                                    {booking.type === 'TICKET' && (
                                                        <button
                                                            onClick={() => openReleaseModal(booking, 'remaining')}
                                                            disabled={!booking.canRelease}
                                                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${!booking.canRelease
                                                                ? 'bg-gray-400 dark:bg-gray-600 text-white cursor-not-allowed'
                                                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                                }`}
                                                        >
                                                            Release Funds
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
                            <p className="text-gray-500 dark:text-gray-400 font-medium">No funds held in escrow</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">All bookings have been processed</p>
                        </div>
                    )}
                </div>
            </main>

            {/* ============================================ */}
            {/* VIEW DETAILS MODAL (Read-only) */}
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
                                                {/* Status Badge - FIXED */}
                                                {(() => {
                                                    const statusBadge = getReleaseStatusBadge(selectedBooking);
                                                    const StatusIcon = statusBadge.icon;
                                                    return (
                                                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                                            <p className="text-sm text-gray-500 dark:text-gray-400">Current Status</p>
                                                            <div className="mt-1">
                                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                                                                    <StatusIcon className="h-3 w-3 mr-1" />
                                                                    {statusBadge.text}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Event Info */}
                                                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Event</p>
                                                    <p className="font-medium text-gray-900 dark:text-white">{selectedBooking.eventTitle}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <CalendarIcon className="h-3 w-3 text-gray-400" />
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            {new Date(selectedBooking.eventDate).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Vendor/Organizer */}
                                                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        {selectedBooking.type === 'VENDOR' ? 'Vendor' : 'Organizer'}
                                                    </p>
                                                    <p className="font-medium text-gray-900 dark:text-white">
                                                        {selectedBooking.type === 'VENDOR' ? selectedBooking.vendorName : selectedBooking.organizerName}
                                                    </p>
                                                    {selectedBooking.type === 'VENDOR' && selectedBooking.location && (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <MapPinIcon className="h-3 w-3 text-gray-400" />
                                                            <p className="text-xs text-gray-500">{selectedBooking.location}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Customer Info */}
                                                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                                                    <p className="font-medium text-gray-900 dark:text-white">{selectedBooking.customerName}</p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500">{selectedBooking.customerEmail}</p>
                                                </div>

                                                {/* Payment Breakdown */}
                                                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                                                        <span className="font-semibold text-gray-900 dark:text-white">
                                                            NPR {selectedBooking.totalAmount.toLocaleString()}
                                                        </span>
                                                    </div>

                                                    {selectedBooking.type === 'VENDOR' && (
                                                        <>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600 dark:text-gray-400">Deposit Amount:</span>
                                                                <span className="text-green-600 dark:text-green-400 font-medium">
                                                                    NPR {selectedBooking.depositAmount?.toLocaleString()}
                                                                </span>
                                                            </div>

                                                            {/* Deposit Release Status */}
                                                            {selectedBooking.hasDepositPayout && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600 dark:text-gray-400">Deposit Released to Vendor:</span>
                                                                    <span className="text-blue-600 dark:text-blue-400">
                                                                        NPR {Math.round((selectedBooking.depositAmount || 0) * 0.9).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            )}

                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600 dark:text-gray-400">Remaining Amount:</span>
                                                                <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                                                                    NPR {selectedBooking.remainingAmount?.toLocaleString()}
                                                                </span>
                                                            </div>

                                                            {/* Remaining Payment Status */}
                                                            {!selectedBooking.customerPaidFull && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-600 dark:text-gray-400">Remaining Payment Status:</span>
                                                                    <span className="text-red-600 dark:text-red-400">
                                                                        Not Paid Yet
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}

                                                    {/* Commission */}
                                                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                                                        <span className="text-gray-600 dark:text-gray-400">Platform Fee (10%):</span>
                                                        <span className="text-purple-600 dark:text-purple-400">
                                                            -NPR {(selectedBooking.type === 'VENDOR'
                                                                ? (selectedBooking.depositAmount || 0) * 0.1
                                                                : selectedBooking.platformCommission
                                                            )?.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Warning Messages based on state */}
                                                {selectedBooking.type === 'VENDOR' && selectedBooking.hasDepositPayout && !selectedBooking.customerPaidFull && (
                                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                                                        <div className="flex items-start">
                                                            <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                                                                    Awaiting Customer Payment
                                                                </p>
                                                                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                                                                    Deposit has been released to vendor. Customer has not paid the remaining amount yet.
                                                                    Once customer pays, you can release the remaining funds.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {selectedBooking.type === 'VENDOR' && !selectedBooking.hasDepositPayout && selectedBooking.customerPaidDeposit && (
                                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                                                        <div className="flex items-start">
                                                            <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                                                    Deposit Ready for Release
                                                                </p>
                                                                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                                                                    Customer has paid the deposit. You can now release the deposit to the vendor.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {selectedBooking.type === 'VENDOR' && selectedBooking.customerPaidFull && !selectedBooking.hasRemainingPayout && (
                                                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                                                        <div className="flex items-start">
                                                            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                                                    Fully Paid - Ready to Release
                                                                </p>
                                                                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                                                                    Customer has paid the full amount. You can now release the remaining funds to the vendor.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {selectedBooking.type === 'TICKET' && selectedBooking.isCompleted && (
                                                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                                                        <div className="flex items-start">
                                                            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                                                    Event Completed
                                                                </p>
                                                                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                                                                    Event has been marked as completed. You can now release the ticket funds to the organizer.
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
            {/* RELEASE MODAL (For releasing funds) */}
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
                                                Release {modalAction === 'deposit' ? 'Deposit' : 'Remaining'} Funds
                                            </h3>

                                            <div className="mt-4 space-y-3">
                                                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Event</p>
                                                    <p className="font-medium text-gray-900 dark:text-white">{selectedBooking.eventTitle}</p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                        {new Date(selectedBooking.eventDate).toLocaleDateString()}
                                                    </p>
                                                </div>

                                                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        {selectedBooking.type === 'VENDOR' ? 'Vendor' : 'Organizer'}
                                                    </p>
                                                    <p className="font-medium text-gray-900 dark:text-white">
                                                        {selectedBooking.type === 'VENDOR' ? selectedBooking.vendorName : selectedBooking.organizerName}
                                                    </p>
                                                </div>

                                                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                                                    <p className="font-medium text-gray-900 dark:text-white">{selectedBooking.customerName}</p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500">{selectedBooking.customerEmail}</p>
                                                </div>

                                                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                                                        <span className="font-semibold text-gray-900 dark:text-white">
                                                            NPR {selectedBooking.totalAmount.toLocaleString()}
                                                        </span>
                                                    </div>

                                                    {selectedBooking.type === 'VENDOR' && (
                                                        <>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600 dark:text-gray-400">Deposit Amount:</span>
                                                                <span className="text-green-600 dark:text-green-400 font-medium">
                                                                    NPR {selectedBooking.depositAmount?.toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600 dark:text-gray-400">Remaining Amount:</span>
                                                                <span className="text-gray-900 dark:text-white font-medium">
                                                                    NPR {selectedBooking.remainingAmount?.toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}

                                                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                                                        <span className="font-semibold text-gray-900 dark:text-white">Amount to Release:</span>
                                                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                            NPR {(modalAction === 'deposit' ? selectedBooking.depositAmount : selectedBooking.remainingAmount)?.toLocaleString()}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">Platform Fee (10%):</span>
                                                        <span className="text-purple-600 dark:text-purple-400">
                                                            -NPR {Math.round((modalAction === 'deposit' ? (selectedBooking.depositAmount || 0) : (selectedBooking.remainingAmount || 0)) * 0.1).toLocaleString()}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                                                        <span className="font-semibold text-gray-900 dark:text-white">
                                                            {selectedBooking.type === 'VENDOR' ? 'Vendor' : 'Organizer'} Receives:
                                                        </span>
                                                        <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                                                            NPR {Math.round((modalAction === 'deposit' ? (selectedBooking.depositAmount || 0) : (selectedBooking.remainingAmount || 0)) * 0.9).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                                                    <div className="flex items-start">
                                                        <InformationCircleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                                                                Manual Transfer Required
                                                            </p>
                                                            <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                                                                After confirming, you will need to manually transfer the money to the {selectedBooking.type === 'VENDOR' ? 'vendor' : 'organizer'} via bank transfer or Khalti dashboard, then verify the payout with proof.
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
                                        onClick={() => releaseFunds(
                                            selectedBooking.id,
                                            modalAction === 'deposit'
                                                ? (selectedBooking.depositAmount || 0)
                                                : (selectedBooking.remainingAmount || selectedBooking.totalAmount),
                                            modalAction === 'deposit' ? 'deposit' : 'remaining'
                                        )}
                                        disabled={releasingId === selectedBooking.id}
                                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 transition-colors"
                                    >
                                        {releasingId === selectedBooking.id ? (
                                            <>
                                                <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            'Confirm Release'
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
            {/* VERIFY PAYOUT MODAL */}
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
                                        <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 sm:mx-0 sm:h-10 sm:w-10">
                                            <ShieldCheckIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                                                Verify Manual Payout
                                            </h3>

                                            <div className="mt-4 space-y-4">
                                                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Payout Details</p>
                                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                                        NPR {selectedPayout.vendorPayout?.toLocaleString()}
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                        Type: {selectedPayout.type === 'DEPOSIT' ? 'Deposit Payout' : 'Remaining Payout'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Transfer Method *
                                                    </label>
                                                    <select
                                                        value={verificationData.transferMethod}
                                                        onChange={(e) => setVerificationData({ ...verificationData, transferMethod: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                                    >
                                                        <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
                                                        <option value="KHALTI_MANUAL">📱 Khalti Dashboard Transfer</option>
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
                                                        onChange={(e) => setVerificationData({ ...verificationData, transactionReference: e.target.value })}
                                                        placeholder="e.g., BANK-20241215-001, KHALTI-REF-12345, CHQ-001"
                                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Enter bank receipt number, Khalti transaction ID, or cheque number
                                                    </p>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Upload Proof (Receipt/Screenshot) *
                                                    </label>
                                                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center relative hover:border-indigo-500 transition-colors">
                                                        {verificationData.proofImage ? (
                                                            <div className="space-y-2">
                                                                <PhotoIcon className="h-10 w-10 mx-auto text-green-500" />
                                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                                    {verificationData.proofImage.name}
                                                                </p>
                                                                <p className="text-xs text-gray-500">
                                                                    {(verificationData.proofImage.size / 1024).toFixed(2)} KB
                                                                </p>
                                                                <button
                                                                    onClick={() => setVerificationData({ ...verificationData, proofImage: null })}
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
                                                                    onChange={(e) => setVerificationData({ ...verificationData, proofImage: e.target.files?.[0] || null })}
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
                                                        onChange={(e) => setVerificationData({ ...verificationData, notes: e.target.value })}
                                                        placeholder="Add internal notes about this payout..."
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
                                                                I confirm that I have already transferred the money to the vendor/organizer.
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
                                        disabled={!verificationData.transactionReference || !verificationData.proofImage || uploading}
                                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                                    >
                                        {uploading ? (
                                            <>
                                                <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            '✓ Verify & Complete'
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowVerifyModal(false);
                                            setVerificationData({
                                                transactionReference: '',
                                                transferMethod: 'BANK_TRANSFER',
                                                proofImage: null,
                                                notes: '',
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