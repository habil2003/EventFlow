'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    EyeIcon,
    DocumentTextIcon,
    ArrowLeftIcon,
    MagnifyingGlassIcon,
    UserIcon,
    BuildingOfficeIcon,
    CalendarIcon,
    BanknotesIcon,
    ShieldCheckIcon,
    PhotoIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface Refund {
    id: string;
    originalTransactionId: string;
    refundAmount: number;
    refundReason: string;
    refundStatus: string;
    gatewayRefundId: string | null;
    gatewayResponse: any;
    createdAt: string;
    processedAt: string | null;
    cancelledBy?: string;
    cancellationReason?: string;
    booking: {
        id: string;
        type: 'VENDOR' | 'TICKET';
        eventTitle: string;
        eventDate: string;
        totalAmount: number;
        vendorName: string;
        customerName: string;
        customerEmail: string;
        packageName: string;
    };
    paymentTransaction: {
        id: string;
        transactionId: string;
        gatewayTransactionId: string;
        amount: number;
        khaltiFee?: number;
    };
}

export default function AdminRefundsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [refunds, setRefunds] = useState<Refund[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [adminNotes, setAdminNotes] = useState('');
    const [updating, setUpdating] = useState(false);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [verificationData, setVerificationData] = useState({
        transactionReference: '',
        proofImage: null as File | null,
        transferMethod: 'BANK_TRANSFER',
        notes: '',
    });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    useEffect(() => {
        const fetchRefunds = async () => {
            try {
                const response = await fetch('/api/admin/refunds');
                const data = await response.json();
                setRefunds(data.refunds);
            } catch (error) {
                console.error('Error fetching refunds:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRefunds();
    }, []);

    // Auto-refund via Khalti API
    const processAutoRefund = async (refundId: string) => {
        if (!confirm('Process refund automatically via Khalti API? This will immediately refund the customer\'s original payment method.')) {
            return;
        }

        setUpdating(true);
        try {
            const response = await fetch(`/api/admin/refunds/${refundId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'PROCESSED',
                    notes: adminNotes,
                    useKhaltiApi: true
                }),
            });

            const data = await response.json();

            if (response.ok) {
                const refreshResponse = await fetch('/api/admin/refunds');
                const refreshData = await refreshResponse.json();
                setRefunds(refreshData.refunds);
                setModalOpen(false);
                setAdminNotes('');
                alert('✅ Refund processed successfully via Khalti API');
            } else {
                alert(data.error || '❌ Auto-refund failed. Try manual method.');
            }
        } catch (error) {
            console.error('Error processing auto refund:', error);
            alert('❌ Failed to process auto refund');
        } finally {
            setUpdating(false);
        }
    };

    const updateRefundStatus = async (refundId: string, newStatus: string, isManual = false) => {
        if (newStatus === 'PROCESSED' && isManual) {
            setShowVerificationModal(true);
            return;
        }

        setUpdating(true);
        try {
            const response = await fetch(`/api/admin/refunds/${refundId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, notes: adminNotes }),
            });

            if (response.ok) {
                const refreshResponse = await fetch('/api/admin/refunds');
                const refreshData = await refreshResponse.json();
                setRefunds(refreshData.refunds);
                setModalOpen(false);
                setAdminNotes('');
            }
        } catch (error) {
            console.error('Error updating refund:', error);
        } finally {
            setUpdating(false);
        }
    };

    const submitManualRefund = async () => {
        if (!selectedRefund) return;

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

            const response = await fetch(`/api/admin/refunds/${selectedRefund.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'PROCESSED',
                    notes: `Manual refund processed via ${verificationData.transferMethod}. Reference: ${verificationData.transactionReference}. Proof: ${proofImageUrl}. ${verificationData.notes}`
                }),
            });

            if (response.ok) {
                const refreshResponse = await fetch('/api/admin/refunds');
                const refreshData = await refreshResponse.json();
                setRefunds(refreshData.refunds);
                setShowVerificationModal(false);
                setModalOpen(false);
                setVerificationData({
                    transactionReference: '',
                    proofImage: null,
                    transferMethod: 'BANK_TRANSFER',
                    notes: '',
                });
                setAdminNotes('');
                alert('✅ Manual refund recorded successfully');
            }
        } catch (error) {
            console.error('Error processing manual refund:', error);
            alert('Failed to process manual refund');
        } finally {
            setUploading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PROCESSED':
                return { text: 'Processed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircleIcon, description: 'Refund completed successfully' };
            case 'PENDING_ADMIN':
                return { text: 'Pending Admin', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: ClockIcon, description: 'Awaiting admin action' };
            case 'FAILED':
                return { text: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircleIcon, description: 'Refund processing failed' };
            case 'PENDING':
                return { text: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: ArrowPathIcon, description: 'Refund in progress' };
            default:
                return { text: status, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: ExclamationTriangleIcon, description: 'Unknown status' };
        }
    };

    const getCancelledByBadge = (cancelledBy?: string) => {
        if (cancelledBy === 'CUSTOMER') {
            return { text: 'Customer Cancelled', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: UserIcon };
        }
        if (cancelledBy === 'VENDOR') {
            return { text: 'Vendor Declined', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: BuildingOfficeIcon };
        }
        return null;
    };

    // Helper function to format refund details for modal display
    const formatRefundDetailsForModal = (refund: Refund) => {
        const gatewayResponse = refund.gatewayResponse;
        const refundStatus = refund.refundStatus;
        
        if (!gatewayResponse) {
            return {
                title: "No Additional Data",
                details: [{ label: "Status", value: refundStatus }],
                color: "gray"
            };
        }

        // For PROCESSED refunds
        if (refundStatus === "PROCESSED") {
            // Khalti API Auto-Refund
            if (gatewayResponse.method === "KHALTI_API") {
                return {
                    title: "Auto-Refund via Khalti API",
                    icon: BanknotesIcon,
                    color: "purple",
                    details: [
                        { label: "Processed by", value: gatewayResponse.processedBy || "System" },
                        { label: "Processed at", value: gatewayResponse.processedAt ? new Date(gatewayResponse.processedAt).toLocaleString() : refund.processedAt ? new Date(refund.processedAt).toLocaleString() : "N/A" },
                        { label: "Refund Percentage", value: gatewayResponse.refundPercentage ? `${gatewayResponse.refundPercentage}%` : "N/A" },
                        { label: "Days Until Event", value: gatewayResponse.daysUntilEvent ? `${gatewayResponse.daysUntilEvent} days` : "N/A" },
                        { label: "Khalti Fee", value: gatewayResponse.khaltiFee ? `NPR ${gatewayResponse.khaltiFee.toLocaleString()}` : "N/A" },
                        { label: "Platform Kept", value: gatewayResponse.platformKeeps ? `NPR ${gatewayResponse.platformKeeps.toLocaleString()}` : "N/A" },
                        { label: "Transaction ID", value: gatewayResponse.originalTxId || refund.gatewayRefundId || "N/A" },
                        { label: "API Response", value: gatewayResponse.khaltiResponse?.detail || gatewayResponse.message || "Success" },
                        { label: "Admin Notes", value: gatewayResponse.adminNotes || "None" },
                    ].filter(d => d.value && d.value !== "N/A")
                };
            }
            
            // Manual Refund (Bank, Cash, Cheque, etc.)
            if (gatewayResponse.method === "MANUAL" || ["BANK_TRANSFER", "CASH", "CHEQUE", "KHALTI_MANUAL"].includes(gatewayResponse.transferMethod)) {
                const methodNames: Record<string, string> = {
                    "BANK_TRANSFER": "Bank Transfer",
                    "CASH": "Cash",
                    "CHEQUE": "Cheque",
                    "KHALTI_MANUAL": "Khalti Dashboard",
                    "MANUAL": "Manual"
                };
                
                return {
                    title: `Manual Refund: ${methodNames[gatewayResponse.transferMethod] || "Manual"}`,
                    icon: BuildingOfficeIcon,
                    color: "blue",
                    details: [
                        { label: "Reference Number", value: gatewayResponse.transactionReference },
                        { label: "Processed by", value: gatewayResponse.processedBy || "Admin" },
                        { label: "Processed at", value: gatewayResponse.processedAt ? new Date(gatewayResponse.processedAt).toLocaleString() : refund.processedAt ? new Date(refund.processedAt).toLocaleString() : "N/A" },
                        { label: "Refund Percentage", value: gatewayResponse.refundPercentage ? `${gatewayResponse.refundPercentage}%` : "N/A" },
                        { label: "Proof of Transfer", value: gatewayResponse.proofImageUrl ? "Uploaded" : "Not provided" },
                        { label: "Admin Notes", value: gatewayResponse.adminNotes || "None" },
                    ].filter(d => d.value)
                };
            }
            
            // Customer cancellation (fallback)
            if (gatewayResponse.refundPercentage) {
                return {
                    title: "Customer Cancellation Refund",
                    icon: UserIcon,
                    color: "green",
                    details: [
                        { label: "Refund Percentage", value: `${gatewayResponse.refundPercentage}%` },
                        { label: "Refund Amount", value: `NPR ${refund.refundAmount.toLocaleString()}` },
                        { label: "Days Until Event", value: gatewayResponse.daysUntilEvent ? `${gatewayResponse.daysUntilEvent} days` : "N/A" },
                        { label: "Deposit Amount", value: gatewayResponse.depositAmount ? `NPR ${gatewayResponse.depositAmount.toLocaleString()}` : "N/A" },
                        { label: "Khalti Fee", value: gatewayResponse.khaltiFee ? `NPR ${gatewayResponse.khaltiFee.toLocaleString()}` : "N/A" },
                        { label: "Platform Kept", value: gatewayResponse.platformKeeps ? `NPR ${gatewayResponse.platformKeeps.toLocaleString()}` : "N/A" },
                        { label: "Cancelled by", value: gatewayResponse.cancelledBy },
                        { label: "Reason", value: gatewayResponse.reason || refund.refundReason },
                        { label: "Cancelled At", value: gatewayResponse.cancelledAt ? new Date(gatewayResponse.cancelledAt).toLocaleString() : "N/A" },
                    ].filter(d => d.value)
                };
            }
        }

        // For PENDING_ADMIN refunds
        if (refundStatus === "PENDING_ADMIN") {
            return {
                title: "Pending Admin Review",
                icon: ClockIcon,
                color: "yellow",
                details: [
                    { label: "Refund Amount", value: `NPR ${refund.refundAmount.toLocaleString()}` },
                    { label: "Refund Percentage", value: gatewayResponse.refundPercentage ? `${gatewayResponse.refundPercentage}%` : "To be determined" },
                    { label: "Days Until Event", value: gatewayResponse.daysUntilEvent ? `${gatewayResponse.daysUntilEvent} days` : "N/A" },
                    { label: "Cancelled by", value: gatewayResponse.cancelledBy || refund.cancelledBy || "Customer" },
                    { label: "Reason", value: gatewayResponse.reason || refund.refundReason },
                    { label: "Status", value: "Waiting for admin action" },
                    { label: "Expected Timeline", value: "Process within 3-7 business days" },
                ].filter(d => d.value)
            };
        }

        // For FAILED refunds
        if (refundStatus === "FAILED") {
            return {
                title: "Refund Failed",
                icon: XCircleIcon,
                color: "red",
                details: [
                    { label: "Refund Amount", value: `NPR ${refund.refundAmount.toLocaleString()}` },
                    { label: "Error", value: gatewayResponse.error || gatewayResponse.message || "Unknown error" },
                    { label: "Attempted at", value: gatewayResponse.attemptedAt ? new Date(gatewayResponse.attemptedAt).toLocaleString() : refund.processedAt ? new Date(refund.processedAt).toLocaleString() : "N/A" },
                    { label: "Processed by", value: gatewayResponse.processedBy || "System" },
                    { label: "Admin Notes", value: gatewayResponse.adminNotes || "None" },
                    { label: "Recommended Action", value: "Try Auto-Refund again or process manually" },
                ].filter(d => d.value)
            };
        }

        // Fallback - show formatted JSON
        return {
            title: "Refund Details",
            icon: DocumentTextIcon,
            color: "gray",
            details: Object.entries(gatewayResponse)
                .filter(([key]) => !key.includes('response') || typeof key === 'string')
                .map(([key, value]) => ({
                    label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                    value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
                }))
                .slice(0, 10)
        };
    };

    const getRefundSummary = (gatewayResponse: any, refundStatus: string) => {
        if (!gatewayResponse) {
            if (refundStatus === "PENDING_ADMIN") return "Pending admin review";
            return "No additional data";
        }
        
        if (refundStatus === "PROCESSED") {
            if (gatewayResponse.method === "KHALTI_API") {
                return `Auto-refund via API - ${gatewayResponse.khaltiResponse?.detail || gatewayResponse.message || "Success"}`;
            }
            if (gatewayResponse.method === "MANUAL" || gatewayResponse.transferMethod) {
                const methods: Record<string, string> = {
                    "BANK_TRANSFER": "Bank Transfer",
                    "CASH": "Cash", 
                    "CHEQUE": "Cheque",
                    "KHALTI_MANUAL": "Khalti Manual",
                };
                const methodName = methods[gatewayResponse.transferMethod] || "Manual";
                const reference = gatewayResponse.transactionReference || "N/A";
                return `${methodName} - Ref: ${reference}`;
            }
            if (gatewayResponse.refundPercentage) {
                return `${gatewayResponse.refundPercentage}% refund - ${gatewayResponse.daysUntilEvent || 0} days before event`;
            }
        }
        
        if (refundStatus === "PENDING_ADMIN") {
            if (gatewayResponse.refundPercentage) {
                return `${gatewayResponse.refundPercentage}% eligible - awaiting admin action`;
            }
            return "Awaiting admin processing";
        }
        
        if (refundStatus === "FAILED") {
            return `Failed: ${gatewayResponse.error || gatewayResponse.message || "Contact support"}`;
        }
        
        try {
            const jsonStr = JSON.stringify(gatewayResponse);
            return jsonStr.length > 80 ? jsonStr.substring(0, 80) + "..." : jsonStr;
        } catch {
            return "Invalid response data";
        }
    };

    // Filter refunds
    const filteredRefunds = refunds.filter(refund => {
        const matchesSearch = searchTerm === '' ||
            refund.booking?.eventTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            refund.booking?.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            refund.booking?.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            refund.booking?.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesFilter = filter === 'all' || refund.refundStatus === filter;
        
        return matchesSearch && matchesFilter;
    });

    const stats = {
        total: refunds.length,
        pending: refunds.filter(r => r.refundStatus === 'PENDING_ADMIN').length,
        processed: refunds.filter(r => r.refundStatus === 'PROCESSED').length,
        failed: refunds.filter(r => r.refundStatus === 'FAILED').length,
    };

    if (status === 'loading' || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
                    <p className="mt-2 text-sm text-gray-500">Loading refunds...</p>
                </div>
            </div>
        );
    }

    if (session?.user?.role !== 'ADMIN') {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Access Denied</h1>
                    <p className="mt-2 text-gray-500">You don't have permission to view this page.</p>
                    <Link href="/" className="mt-4 inline-block text-indigo-600 hover:underline">
                        Go back home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
            <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Refund Management</h1>
                            <p className="mt-2 text-gray-500 dark:text-gray-400">
                                Process and track customer refunds from declined vendor bookings or cancelled tickets
                            </p>
                        </div>
                        <Link
                            href="/admin"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            <span className="text-sm">Back to Dashboard</span>
                        </Link>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
                                <p className="text-sm text-gray-500 dark:text-gray-400">Pending Admin</p>
                                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">{stats.pending}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Awaiting action</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Processed</p>
                                <p className="text-2xl font-bold text-green-600 dark:text-green-500">{stats.processed}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Completed successfully</p>
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
                        <p className="text-xs text-gray-400 mt-1">Requires attention</p>
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by event, customer, vendor, or email..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                filter === 'all'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            All ({stats.total})
                        </button>
                        <button
                            onClick={() => setFilter('PENDING_ADMIN')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                filter === 'PENDING_ADMIN'
                                    ? 'bg-yellow-600 text-white'
                                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            Pending ({stats.pending})
                        </button>
                        <button
                            onClick={() => setFilter('PROCESSED')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                filter === 'PROCESSED'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            Processed ({stats.processed})
                        </button>
                        <button
                            onClick={() => setFilter('FAILED')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                filter === 'FAILED'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            Failed ({stats.failed})
                        </button>
                    </div>
                </div>

                {/* Refunds Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Booking / Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cancelled By</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredRefunds.map((refund) => {
                                    const StatusBadge = getStatusBadge(refund.refundStatus);
                                    const StatusIcon = StatusBadge.icon;
                                    const CancelledBadge = getCancelledByBadge(refund.cancelledBy);
                                    
                                    return (
                                        <tr key={refund.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">
                                                        {refund.booking?.eventTitle || 'N/A'}
                                                    </p>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <UserIcon className="h-3 w-3 text-gray-400" />
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            {refund.booking?.customerName}
                                                        </p>
                                                    </div>
                                                    <p className="text-xs text-gray-400">
                                                        {refund.booking?.customerEmail}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1">
                                                    <BuildingOfficeIcon className="h-3 w-3 text-gray-400" />
                                                    <p className="text-sm text-gray-900 dark:text-white">
                                                        {refund.booking?.vendorName || 'N/A'}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    {refund.booking?.packageName}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-gray-900 dark:text-white">
                                                    NPR {refund.refundAmount.toLocaleString()}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Total: NPR {refund.booking?.totalAmount?.toLocaleString()}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p 
                                                    className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" 
                                                    title={JSON.stringify(refund.gatewayResponse, null, 2)}
                                                >
                                                    {getRefundSummary(refund.gatewayResponse, refund.refundStatus)}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                {CancelledBadge ? (
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${CancelledBadge.color}`}>
                                                        <CancelledBadge.icon className="h-3 w-3 mr-1" />
                                                        {CancelledBadge.text}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${StatusBadge.color}`}>
                                                    <StatusIcon className="h-3 w-3 mr-1" />
                                                    {StatusBadge.text}
                                                </span>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {StatusBadge.description}
                                                </p>
                                                {refund.processedAt && (
                                                    <p className="text-xs text-green-600 mt-1">
                                                        {new Date(refund.processedAt).toLocaleDateString()}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-gray-500">
                                                    {new Date(refund.createdAt).toLocaleDateString()}
                                                </p>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <CalendarIcon className="h-3 w-3 text-gray-400" />
                                                    <p className="text-xs text-gray-400">
                                                        {new Date(refund.createdAt).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedRefund(refund);
                                                            setModalOpen(true);
                                                        }}
                                                        className="p-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <EyeIcon className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {filteredRefunds.length === 0 && (
                        <div className="text-center py-12">
                            <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                            <p className="text-gray-500">No refunds found</p>
                            {searchTerm && (
                                <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Refund Details Modal */}
            <AnimatePresence>
                {modalOpen && selectedRefund && (() => {
                    const formattedDetails = formatRefundDetailsForModal(selectedRefund);
                    const DetailIcon = formattedDetails.icon || DocumentTextIcon;
                    const color = formattedDetails.color;
                    
                    return (
                        <div className="fixed inset-0 z-[100] overflow-y-auto">
                            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                                <div
                                    className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-90 transition-opacity"
                                    onClick={() => setModalOpen(false)}
                                />

                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="relative inline-block transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:align-middle"
                                >
                                    <div className="bg-white dark:bg-gray-800">
                                        {/* Modal Header */}
                                        <div className={`bg-gradient-to-r from-${color}-600 to-${color}-700 px-6 py-4`}>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                                                    <DetailIcon className="h-5 w-5 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-white">{formattedDetails.title}</h3>
                                                    <p className="text-xs text-white/80">Refund ID: {selectedRefund.id.slice(0, 8)}...</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Modal Body */}
                                        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
                                            {/* Booking Summary Card */}
                                            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 mb-4">
                                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                    <InformationCircleIcon className="h-4 w-4" />
                                                    Booking Information
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <p className="text-xs text-gray-500">Event</p>
                                                        <p className="font-medium text-gray-900 dark:text-white">{selectedRefund.booking?.eventTitle}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Event Date</p>
                                                        <p className="text-gray-700 dark:text-gray-300">{selectedRefund.booking?.eventDate ? new Date(selectedRefund.booking.eventDate).toLocaleDateString() : 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Vendor</p>
                                                        <p className="text-gray-700 dark:text-gray-300">{selectedRefund.booking?.vendorName || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Package</p>
                                                        <p className="text-gray-700 dark:text-gray-300">{selectedRefund.booking?.packageName || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Customer</p>
                                                        <p className="text-gray-700 dark:text-gray-300">{selectedRefund.booking?.customerName}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Customer Email</p>
                                                        <p className="text-gray-700 dark:text-gray-300">{selectedRefund.booking?.customerEmail}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Total Amount</p>
                                                        <p className="font-semibold text-indigo-600">NPR {selectedRefund.booking?.totalAmount?.toLocaleString()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Refund Amount</p>
                                                        <p className="font-semibold text-green-600">NPR {selectedRefund.refundAmount.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Cancellation Info (if any) */}
                                            {(selectedRefund.cancelledBy || selectedRefund.cancellationReason) && (
                                                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 mb-4 border border-orange-200 dark:border-orange-800">
                                                    <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-2 flex items-center gap-2">
                                                        <XCircleIcon className="h-4 w-4" />
                                                        Cancellation Details
                                                    </h4>
                                                    <div className="space-y-1 text-sm">
                                                        {selectedRefund.cancelledBy && (
                                                            <p><span className="text-gray-500">Cancelled by:</span> {selectedRefund.cancelledBy === 'CUSTOMER' ? 'Customer' : 'Vendor'}</p>
                                                        )}
                                                        {selectedRefund.cancellationReason && (
                                                            <p><span className="text-gray-500">Reason:</span> {selectedRefund.cancellationReason}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Refund Method Details */}
                                            <div className={`bg-${color}-50 dark:bg-${color}-900/20 rounded-lg p-4 border border-${color}-200 dark:border-${color}-800`}>
                                                <h4 className={`text-sm font-semibold text-${color}-700 dark:text-${color}-300 mb-3 flex items-center gap-2`}>
                                                    <BanknotesIcon className={`h-4 w-4 text-${color}-600`} />
                                                    Refund Details
                                                </h4>
                                                <div className="space-y-2 text-sm">
                                                    {formattedDetails.details.map((detail, idx) => (
                                                        <div key={idx} className="grid grid-cols-3 gap-2 py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                                            <span className="text-gray-500 font-medium">{detail.label}:</span>
                                                            <span className="col-span-2 text-gray-700 dark:text-gray-300 break-words">
                                                                {typeof detail.value === 'string' && detail.value.length > 100 ? (
                                                                    <details>
                                                                        <summary className="cursor-pointer text-indigo-600 text-xs">Click to expand</summary>
                                                                        <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                                                                            {detail.value}
                                                                        </pre>
                                                                    </details>
                                                                ) : (
                                                                    detail.value
                                                                )}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Raw JSON for debugging (collapsible) */}
                                            {selectedRefund.gatewayResponse && (
                                                <details className="mt-4">
                                                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">View Raw Response Data</summary>
                                                    <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto max-h-48">
                                                        {JSON.stringify(selectedRefund.gatewayResponse, null, 2)}
                                                    </pre>
                                                </details>
                                            )}
                                        </div>

                                        {/* Modal Footer */}
                                        <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex flex-wrap justify-end gap-3">
                                            {selectedRefund.refundStatus === 'PENDING_ADMIN' && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => processAutoRefund(selectedRefund.id)}
                                                        disabled={updating}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 transition-colors"
                                                    >
                                                        {updating ? (
                                                            <><ArrowPathIcon className="h-4 w-4 animate-spin" />Processing...</>
                                                        ) : (
                                                            <><BanknotesIcon className="h-4 w-4" />Auto-Refund via Khalti API</>
                                                        )}
                                                    </button>
                                                    
                                                    <button
                                                        type="button"
                                                        onClick={() => updateRefundStatus(selectedRefund.id, 'PROCESSED', true)}
                                                        disabled={updating}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 transition-colors"
                                                    >
                                                        <ShieldCheckIcon className="h-4 w-4" />
                                                        Mark as Processed (Manual)
                                                    </button>
                                                    
                                                    <button
                                                        type="button"
                                                        onClick={() => updateRefundStatus(selectedRefund.id, 'FAILED', false)}
                                                        disabled={updating}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 transition-colors"
                                                    >
                                                        <XCircleIcon className="h-4 w-4" />
                                                        Mark as Failed
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setModalOpen(false)}
                                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    );
                })()}
            </AnimatePresence>

            {/* Manual Refund Verification Modal */}
            <AnimatePresence>
                {showVerificationModal && selectedRefund && (
                    <div className="fixed inset-0 z-[200] overflow-y-auto">
                        <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div
                                className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-90 transition-opacity"
                                onClick={() => setShowVerificationModal(false)}
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
                                                Verify Manual Refund
                                            </h3>

                                            <div className="mt-4 space-y-4">
                                                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Refund Details</p>
                                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                                        NPR {selectedRefund.refundAmount.toLocaleString()}
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                        Customer: {selectedRefund.booking?.customerName}
                                                    </p>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Transfer Method *
                                                    </label>
                                                    <select
                                                        value={verificationData.transferMethod}
                                                        onChange={(e) => setVerificationData({ ...verificationData, transferMethod: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                    >
                                                        <option value="BANK_TRANSFER">Bank Transfer</option>
                                                        <option value="KHALTI_MANUAL">Khalti Dashboard Refund</option>
                                                        <option value="CASH">Cash (Office Visit)</option>
                                                        <option value="CHEQUE">Cheque</option>
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
                                                        placeholder="Bank receipt #, Khalti refund ID, Cheque #"
                                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                    />
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
                                                        placeholder="Add internal notes about this refund..."
                                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                    />
                                                </div>

                                                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                                                    <div className="flex items-start gap-2">
                                                        <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-sm font-medium text-red-700 dark:text-red-400">
                                                                Confirmation Required
                                                            </p>
                                                            <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                                                                I confirm that I have already refunded the money to the customer.
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
                                        onClick={submitManualRefund}
                                        disabled={!verificationData.transactionReference || !verificationData.proofImage || uploading}
                                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 transition-colors"
                                    >
                                        {uploading ? (
                                            <>
                                                <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            '✓ Verify & Complete Refund'
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowVerificationModal(false);
                                            setVerificationData({
                                                transactionReference: '',
                                                proofImage: null,
                                                transferMethod: 'BANK_TRANSFER',
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