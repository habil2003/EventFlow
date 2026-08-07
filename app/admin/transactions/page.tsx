"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  CreditCardIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserCircleIcon,
  BanknotesIcon,
  EyeIcon,
  ArrowPathIcon,
  DocumentTextIcon,

  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface TransactionRefund {
  refundStatus?: string;
  refundAmount?: number;
}

interface Transaction {
  id: string;
  transactionId: string;
  gatewayTransactionId: string | null;
  amount: number;
  amountInPaisa: number;
  khaltiFee: number;
  gateway: string;
  paymentType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  ticketBookingId: string | null;
  vendorBookingId: string | null;
  user: {
    name: string;
    email: string;
  } | null;
  event: string | null;
  refunds: TransactionRefund[];
}

interface TransactionStats {
  total: number;
  pending: number;
  completed: number;
  failed: number;
  refunded: number;
  totalRevenue: number;
  totalKhaltiFees: number;
  ticketTransactions: number;
  vendorTransactions: number;
}

export default function TransactionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
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

  // Fetch transactions
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/admin/transactions?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      showMessage("Failed to load transactions", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when filters change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchTransactions();
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
      COMPLETED: {
        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        icon: CheckCircleIcon,
        label: "Completed",
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
    const typeMap: Record<string, { color: string; label: string }> = {
      TICKET_PURCHASE: {
        color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        label: "Ticket Purchase",
      },
      VENDOR_DEPOSIT: {
        color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
        label: "Vendor Deposit",
      },
      VENDOR_REMAINING: {
        color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
        label: "Vendor Remaining",
      },
    };

    const typeInfo = typeMap[type] || { color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300", label: type };
    
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}
      >
        {typeInfo.label}
      </span>
    );
  };

  const getGatewayBadge = (gateway: string) => {
    const gatewayMap: Record<string, { color: string; label: string }> = {
      KHALTI: {
        color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
        label: "Khalti",
      },
      ESEWA: {
        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        label: "eSewa",
      },
    };

    const gatewayInfo = gatewayMap[gateway] || { color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300", label: gateway };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${gatewayInfo.color}`}
      >
        {gatewayInfo.label}
      </span>
    );
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

  // Calculate stats from transactions if not provided by API
  const calculatedStats: TransactionStats = stats || {
    total: transactions.length,
    pending: transactions.filter((t) => t.status === "PENDING").length,
    completed: transactions.filter((t) => t.status === "COMPLETED").length,
    failed: transactions.filter((t) => t.status === "FAILED").length,
    refunded: transactions.filter((t) => t.status === "REFUNDED").length,
    totalRevenue: transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0),
    totalKhaltiFees: transactions.reduce((sum, t) => sum + Number(t.khaltiFee || 0), 0),
    ticketTransactions: transactions.filter((t) => t.paymentType === "TICKET_PURCHASE").length,
    vendorTransactions: transactions.filter((t) => t.paymentType === "VENDOR_DEPOSIT" || t.paymentType === "VENDOR_REMAINING").length,
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading transactions...
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
          <CreditCardIcon className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Transaction Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View and manage all payment transactions on the platform
            </p>
          </div>
        </div>
        <button
          onClick={fetchTransactions}
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Transactions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {calculatedStats.total}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <CreditCardIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div className="flex gap-2 mt-2 text-xs">
            <span className="text-blue-600 dark:text-blue-400">
              {calculatedStats.ticketTransactions} Tickets
            </span>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className="text-purple-600 dark:text-purple-400">
              {calculatedStats.vendorTransactions} Vendors
            </span>
          </div>
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
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {calculatedStats.pending} pending
          </p>
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
            Fees: {formatCurrency(calculatedStats.totalKhaltiFees)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Failed / Refunded</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-500">
                {calculatedStats.failed + calculatedStats.refunded}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {calculatedStats.failed} failed • {calculatedStats.refunded} refunded
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by transaction ID, user, or event..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          <option value="all">All Types</option>
          <option value="TICKET_PURCHASE">Ticket Purchase</option>
          <option value="VENDOR_DEPOSIT">Vendor Deposit</option>
          <option value="VENDOR_REMAINING">Vendor Remaining</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          <option value="all">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Transaction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Gateway
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
              {transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-mono text-sm text-gray-900 dark:text-white">
                        #{transaction.transactionId?.slice(0, 12) || transaction.id.slice(0, 12)}
                      </p>
                      {transaction.gatewayTransactionId && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Gateway: {transaction.gatewayTransactionId.slice(0, 12)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getTypeBadge(transaction.paymentType)}
                  </td>
                  <td className="px-6 py-4">
                    {transaction.user ? (
                      <div className="flex items-center gap-2">
                        <UserCircleIcon className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {transaction.user.name}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {transaction.user.email}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Unknown</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(transaction.amount)}
                    </p>
                    {transaction.khaltiFee > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Fee: {formatCurrency(transaction.khaltiFee)}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {getGatewayBadge(transaction.gateway)}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(transaction.status)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(transaction.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedTransaction(transaction);
                          setDetailsModalOpen(true);
                        }}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
                        title="View Details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      {transaction.refunds && transaction.refunds.length > 0 && (
                        <span className="p-1.5 text-orange-500" title="Has Refunds">
                          <ExclamationTriangleIcon className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {transactions.length === 0 && (
          <div className="text-center py-12">
            <CreditCardIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              No transactions found
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
      {detailsModalOpen && selectedTransaction && (
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
                    <CreditCardIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                      Transaction Details
                    </h3>

                    <div className="mt-4 space-y-3">
                      {/* Status & Type */}
                      <div className="flex items-center gap-4 flex-wrap">
                        {getStatusBadge(selectedTransaction.status)}
                        {getTypeBadge(selectedTransaction.paymentType)}
                        {getGatewayBadge(selectedTransaction.gateway)}
                      </div>

                      {/* Transaction ID */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Transaction ID
                        </p>
                        <p className="font-mono text-gray-900 dark:text-white">
                          {selectedTransaction.transactionId}
                        </p>
                      </div>

                      {/* Gateway Transaction ID */}
                      {selectedTransaction.gatewayTransactionId && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Gateway Transaction ID
                          </p>
                          <p className="font-mono text-gray-900 dark:text-white">
                            {selectedTransaction.gatewayTransactionId}
                          </p>
                        </div>
                      )}

                      {/* User */}
                      {selectedTransaction.user && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            User
                          </p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedTransaction.user.name}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {selectedTransaction.user.email}
                          </p>
                        </div>
                      )}

                      {/* Payment Details */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">
                            Amount
                          </span>
                          <span className="font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(selectedTransaction.amount)}
                          </span>
                        </div>
                        {selectedTransaction.khaltiFee > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                              Gateway Fee
                            </span>
                            <span className="text-red-600 dark:text-red-400">
                              {formatCurrency(selectedTransaction.khaltiFee)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">
                            Date
                          </span>
                          <span className="text-gray-900 dark:text-white">
                            {formatDate(selectedTransaction.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Refunds */}
                      {selectedTransaction.refunds && selectedTransaction.refunds.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                          <p className="text-sm font-medium text-red-700 dark:text-red-400">
                            Refunds ({selectedTransaction.refunds.length})
                          </p>
                          <div className="mt-1 space-y-1">
                            {selectedTransaction.refunds.map((refund, index: number) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span className="text-red-600 dark:text-red-400">
                                  {refund.refundStatus || "Pending"}
                                </span>
                                <span className="text-red-600 dark:text-red-400">
                                  {formatCurrency(refund.refundAmount || 0)}
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
                {selectedTransaction.ticketBookingId && (
                  <button
                    onClick={() => {
                      setDetailsModalOpen(false);
                      router.push(`/admin/bookings`);
                    }}
                    className="inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  >
                    <DocumentTextIcon className="h-4 w-4 mr-2" />
                    View Booking
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
