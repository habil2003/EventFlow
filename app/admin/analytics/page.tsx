"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ChartBarIcon,
  CurrencyRupeeIcon,
  UsersIcon,
  CalendarIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalBookings: number;
    totalUsers: number;
    totalVendors: number;
    totalOrganizers: number;
    totalEvents: number;
    revenueGrowth: number;
    bookingGrowth: number;
    userGrowth: number;
  };
  revenueTrend: Array<{
    date: string;
    revenue: number;
    bookings: number;
  }>;
  bookingTrend: Array<{
    date: string;
    ticketBookings: number;
    vendorBookings: number;
  }>;
  topVendors: Array<{
    name: string;
    revenue: number;
    bookings: number;
  }>;
  topOrganizers: Array<{
    name: string;
    revenue: number;
    events: number;
  }>;
  paymentStatusDistribution: Array<{
    name: string;
    value: number;
  }>;
  bookingTypeDistribution: Array<{
    name: string;
    value: number;
  }>;
  monthlyStats: Array<{
    month: string;
    revenue: number;
    bookings: number;
    users: number;
  }>;
}

const COLORS = ["#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#EF4444"];

type TimeRange = "7d" | "30d" | "90d" | "1y";

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
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

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics?range=${timeRange}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        showMessage("Failed to load analytics data", "error");
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      showMessage("Error loading analytics data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const formatCurrency = (amount: number) => {
    return `NPR ${amount.toLocaleString()}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return "text-green-600 dark:text-green-400";
    if (growth < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-500 dark:text-gray-400";
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return ArrowTrendingUpIcon;
    if (growth < 0) return ArrowTrendingDownIcon;
    return null;
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading analytics...
          </p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <ChartBarIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          No analytics data available
        </p>
      </div>
    );
  }

  const { summary, revenueTrend, bookingTrend, topVendors, topOrganizers, paymentStatusDistribution, bookingTypeDistribution, monthlyStats } = data;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <ChartBarIcon className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Analytics Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Platform performance and insights
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Refresh</span>
          </button>
        </div>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
                {formatCurrency(summary.totalRevenue)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CurrencyRupeeIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className={`flex items-center gap-1 mt-1 text-sm ${getGrowthColor(summary.revenueGrowth)}`}>
            {getGrowthIcon(summary.revenueGrowth) && (
              <span className="h-4 w-4">
                {summary.revenueGrowth > 0 ? (
                  <ArrowTrendingUpIcon className="h-4 w-4" />
                ) : (
                  <ArrowTrendingDownIcon className="h-4 w-4" />
                )}
              </span>
            )}
            <span>{Math.abs(summary.revenueGrowth)}%</span>
            <span className="text-gray-400">vs previous period</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Bookings</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-500">
                {formatNumber(summary.totalBookings)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <DocumentTextIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div className={`flex items-center gap-1 mt-1 text-sm ${getGrowthColor(summary.bookingGrowth)}`}>
            {getGrowthIcon(summary.bookingGrowth) && (
              <span className="h-4 w-4">
                {summary.bookingGrowth > 0 ? (
                  <ArrowTrendingUpIcon className="h-4 w-4" />
                ) : (
                  <ArrowTrendingDownIcon className="h-4 w-4" />
                )}
              </span>
            )}
            <span>{Math.abs(summary.bookingGrowth)}%</span>
            <span className="text-gray-400">vs previous period</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-500">
                {formatNumber(summary.totalUsers)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <UsersIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className={`flex items-center gap-1 mt-1 text-sm ${getGrowthColor(summary.userGrowth)}`}>
            {getGrowthIcon(summary.userGrowth) && (
              <span className="h-4 w-4">
                {summary.userGrowth > 0 ? (
                  <ArrowTrendingUpIcon className="h-4 w-4" />
                ) : (
                  <ArrowTrendingDownIcon className="h-4 w-4" />
                )}
              </span>
            )}
            <span>{Math.abs(summary.userGrowth)}%</span>
            <span className="text-gray-400">vs previous period</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Events</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-500">
                {summary.totalEvents}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <CalendarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {summary.totalVendors} vendors • {summary.totalOrganizers} organizers
          </p>
        </div>
      </div>

      {/* Charts Row 1: Revenue & Bookings Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Revenue Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "none",
                  borderRadius: "8px",
                  color: "#F9FAFB",
                }}
                formatter={(value) => [`NPR ${Number(value).toLocaleString()}`, "Revenue"]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366F1"
                fill="#6366F1"
                fillOpacity={0.2}
                name="Revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Booking Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Booking Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={bookingTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "none",
                  borderRadius: "8px",
                  color: "#F9FAFB",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="ticketBookings"
                stroke="#3B82F6"
                name="Ticket Bookings"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="vendorBookings"
                stroke="#8B5CF6"
                name="Vendor Bookings"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Payment Status Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Payment Status Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentStatusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentStatusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "none",
                  borderRadius: "8px",
                  color: "#F9FAFB",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Booking Type Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Booking Type Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={bookingTypeDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {bookingTypeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "none",
                  borderRadius: "8px",
                  color: "#F9FAFB",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 3: Monthly Stats */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Monthly Performance
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "none",
                  borderRadius: "8px",
                  color: "#F9FAFB",
                }}
                formatter={(value) => [`NPR ${Number(value).toLocaleString()}`, "Revenue"]}
              />
              <Legend />
              <Bar dataKey="revenue" fill="#6366F1" name="Revenue" />
              <Bar dataKey="bookings" fill="#3B82F6" name="Bookings" />
              <Bar dataKey="users" fill="#10B981" name="New Users" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Vendors */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BuildingOfficeIcon className="h-5 w-5 text-purple-600" />
            Top Vendors
          </h3>
          <div className="space-y-3">
            {topVendors.map((vendor, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    #{index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {vendor.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {vendor.bookings} bookings
                    </p>
                  </div>
                </div>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(vendor.revenue)}
                </span>
              </div>
            ))}
            {topVendors.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                No vendor data available
              </p>
            )}
          </div>
        </div>

        {/* Top Organizers */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <UserGroupIcon className="h-5 w-5 text-blue-600" />
            Top Organizers
          </h3>
          <div className="space-y-3">
            {topOrganizers.map((organizer, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    #{index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {organizer.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {organizer.events} events
                    </p>
                  </div>
                </div>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(organizer.revenue)}
                </span>
              </div>
            ))}
            {topOrganizers.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                No organizer data available
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}