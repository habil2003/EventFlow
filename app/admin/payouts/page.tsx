"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CurrencyRupeeIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  UserIcon,
  MoonIcon,
  SunIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";

interface Payout {
  id: string;
  amount: number;
  platformCommission: number;
  vendorPayout: number;
  type: string;
  status: string;
  createdAt: string;
  processedAt: string;
  notes: string;
  recipientName: string;
  recipientType: string;
  eventTitle: string;
  adminName: string;
  transactionId: string;
  khaltiPayoutId: string;
}

interface Summary {
  totalCompleted: number;
  totalCommission: number;
  totalPaid: number;
  totalPending: number;
  totalProcessing: number;
  countCompleted: number;
  countPending: number;
  countProcessing: number;
}

export default function AdminPayoutsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalCompleted: 0,
    totalCommission: 0,
    totalPaid: 0,
    totalPending: 0,
    totalProcessing: 0,
    countCompleted: 0,
    countPending: 0,
    countProcessing: 0,
  });
  const [filters, setFilters] = useState({
    status: 'ALL',
    type: 'ALL',
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

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

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: filters.status,
        type: filters.type,
        search: filters.search,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      const response = await fetch(`/api/admin/payouts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPayouts(data.data || []);
        setSummary(data.summary || {
          totalCompleted: 0,
          totalCommission: 0,
          totalPaid: 0,
          totalPending: 0,
          totalProcessing: 0,
          countCompleted: 0,
          countPending: 0,
          countProcessing: 0,
        });
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
      }
    } catch (error) {
      console.error("Error fetching payouts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [filters, pagination.page]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-NP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `NPR ${amount.toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return { text: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircleIcon };
      case "PENDING":
        return { text: "Pending", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: ClockIcon };
      case "PROCESSING":
        return { text: "Processing", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: ArrowPathIcon };
      case "FAILED":
        return { text: "Failed", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: ArrowPathIcon };
      default:
        return { text: status, color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300", icon: ClockIcon };
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "DEPOSIT":
        return { text: "Deposit", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" };
      case "REMAINING":
        return { text: "Remaining", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
      case "TICKET_SALES":
        return { text: "Ticket Sales", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" };
      default:
        return { text: type, color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" };
    }
  };

  if (!mounted || status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading payouts...</p>
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Payout History</h1>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                View and manage all completed and pending payouts
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchPayouts}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Refresh</span>
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                <DocumentTextIcon className="h-4 w-4" />
                <span className="text-sm">Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Completed</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(summary.totalCompleted)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{summary.countCompleted} payouts completed</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Paid Out</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(summary.totalPaid)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <CurrencyRupeeIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Platform commission: {formatCurrency(summary.totalCommission)}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{formatCurrency(summary.totalPending)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{summary.countPending} payouts pending</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Processing</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(summary.totalProcessing)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <ArrowPathIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{summary.countProcessing} payouts in progress</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search by vendor, event, or notes..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>

            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="ALL">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="FAILED">Failed</option>
            </select>

            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="ALL">All Types</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="REMAINING">Remaining</option>
              <option value="TICKET_SALES">Ticket Sales</option>
            </select>

            <button
              onClick={() => {
                setFilters({ status: 'ALL', type: 'ALL', search: '' });
                setPagination({ ...pagination, page: 1 });
              }}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Payout Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recipient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Event</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Commission</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Net Payout</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <div className="text-center">
                        <CurrencyRupeeIcon className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-600 mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">No payouts found</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  payouts.map((payout) => {
                    const StatusBadge = getStatusBadge(payout.status);
                    const StatusIcon = StatusBadge.icon;
                    const TypeBadge = getTypeBadge(payout.type);

                    return (
                      <tr key={payout.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-900 dark:text-white">{formatDate(payout.processedAt || payout.createdAt)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900 dark:text-white">{payout.recipientName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{payout.recipientType}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900 dark:text-white">{payout.eventTitle}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${TypeBadge.color}`}>
                            {TypeBadge.text}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(payout.amount)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-red-600 dark:text-red-400">{formatCurrency(payout.platformCommission)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(payout.vendorPayout)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${StatusBadge.color}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {StatusBadge.text}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/admin/payouts/${payout.id}`}
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <EyeIcon className="h-4 w-4 inline mr-1" />
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {payouts.length} of {pagination.total} payouts
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Payout Summary</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                This page shows all payouts processed through the system. 
                <strong> Completed</strong> payouts have been verified with proof documents.
                <strong> Pending</strong> payouts are waiting for admin approval.
                <strong> Processing</strong> payouts are being manually processed.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}