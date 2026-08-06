"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  DocumentTextIcon,
  CurrencyRupeeIcon,
  ArrowPathIcon,
  ScaleIcon,
  BanknotesIcon,
  CreditCardIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalBookings: number;
    totalUsers: number;
    revenueGrowth: number;
    bookingGrowth: number;
    userGrowth: number;
  };
  revenueTrend: Array<{ date: string; revenue: number; bookings: number }>;
  monthlyStats: Array<{ month: string; revenue: number; bookings: number; users: number }>;
  topVendors: Array<{ name: string; revenue: number; bookings: number }>;
  topOrganizers: Array<{ name: string; revenue: number; events: number }>;
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

export default function RevenuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [txnStats, setTxnStats] = useState<TransactionStats | null>(null);
  const [totalCommission, setTotalCommission] = useState(0);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">("30d");
  const [loading, setLoading] = useState(true);

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

  const fetchData = async (range = timeRange) => {
    setLoading(true);
    try {
      const [analyticsRes, txnRes, commissionRes] = await Promise.all([
        fetch(`/api/admin/analytics?range=${range}`),
        fetch("/api/admin/transactions?limit=1"),
        fetch("/api/admin/commission/stats"),
      ]);

      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (txnRes.ok) {
        const json = await txnRes.json();
        setTxnStats(json.stats);
      }
      if (commissionRes.ok) {
        const json = await commissionRes.json();
        setTotalCommission(json.summary?.totalCommission || 0);
      }
    } catch (error) {
      console.error("Error fetching revenue data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeRange = (range: "7d" | "30d" | "90d" | "1y") => {
    setTimeRange(range);
    fetchData(range);
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading revenue reports...
          </p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }

  const summary = analytics?.summary;
  const revenueGrowthPositive = (summary?.revenueGrowth || 0) >= 0;
  const bookingGrowthPositive = (summary?.bookingGrowth || 0) >= 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <DocumentTextIcon className="h-8 w-8 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Revenue Reports
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Platform revenue, fees and growth trends
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchData()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Refresh
          </span>
        </button>
      </div>

      {/* Range Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(["7d", "30d", "90d", "1y"] as const).map((range) => (
          <button
            key={range}
            onClick={() => changeRange(range)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              timeRange === range
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {range === "7d"
              ? "7 Days"
              : range === "30d"
              ? "30 Days"
              : range === "90d"
              ? "90 Days"
              : "1 Year"}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Revenue
              </p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                NPR {Number(summary?.totalRevenue || 0).toLocaleString()}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <CurrencyRupeeIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div
            className={`flex items-center gap-1 text-xs mt-2 ${
              revenueGrowthPositive
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {revenueGrowthPositive ? (
              <ArrowTrendingUpIcon className="h-3 w-3" />
            ) : (
              <ArrowTrendingDownIcon className="h-3 w-3" />
            )}
            {summary?.revenueGrowth || 0}% vs previous period
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Bookings
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary?.totalBookings || 0}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <CreditCardIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
          <div
            className={`flex items-center gap-1 text-xs mt-2 ${
              bookingGrowthPositive
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {bookingGrowthPositive ? (
              <ArrowTrendingUpIcon className="h-3 w-3" />
            ) : (
              <ArrowTrendingDownIcon className="h-3 w-3" />
            )}
            {summary?.bookingGrowth || 0}% vs previous period
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Platform Commission
              </p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                NPR {totalCommission.toLocaleString()}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <ScaleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">All-time from payouts</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Gateway Fees
              </p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                NPR {Number(txnStats?.totalKhaltiFees || 0).toLocaleString()}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <BanknotesIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {txnStats?.ticketTransactions || 0} ticket •{" "}
            {txnStats?.vendorTransactions || 0} vendor transactions
          </p>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Revenue Trend
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics?.revenueTrend || []}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`NPR ${Number(value).toLocaleString()}`, "Revenue"]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366F1"
                fill="url(#revenueGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Stats + Top Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Monthly Performance
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.monthlyStats || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, name) => [
                    name === "revenue"
                      ? `NPR ${Number(value).toLocaleString()}`
                      : value,
                    name === "revenue" ? "Revenue" : String(name),
                  ]}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#6366F1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="bookings" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="users" fill="#EC4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Vendors
          </h3>
          <div className="space-y-3">
            {analytics?.topVendors.map((vendor, idx) => (
              <div
                key={vendor.name}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                      idx === 0
                        ? "bg-yellow-500"
                        : idx === 1
                        ? "bg-gray-400"
                        : idx === 2
                        ? "bg-amber-600"
                        : "bg-indigo-500"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {vendor.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {vendor.bookings} bookings
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  NPR {vendor.revenue.toLocaleString()}
                </span>
              </div>
            ))}
            {(!analytics?.topVendors || analytics.topVendors.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-8">
                No vendor revenue data in this period
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Stats Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Monthly Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Month
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Bookings
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Unique Customers
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {analytics?.monthlyStats.map((m) => (
                <tr
                  key={m.month}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    {m.month}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-indigo-600 dark:text-indigo-400">
                    NPR {m.revenue.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                    {m.bookings}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400">
                    {m.users}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!analytics?.monthlyStats || analytics.monthlyStats.length === 0) && (
          <div className="text-center py-12">
            <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              No monthly data in this period
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
