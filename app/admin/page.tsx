"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UsersIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  CurrencyRupeeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  HomeIcon,
  DocumentTextIcon,
  BanknotesIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

interface DashboardStats {
  totalUsers: number;
  totalVendors: number;
  totalOrganizers: number;
  totalEvents: number;
  totalBookings: number;
  vendorBookings: number;
  ticketBookings: number;
  totalRevenue: number;
  releasedToVendors: number;
  releasedToOrganizers: number;
  totalReleased: number;
  vendorCommission: number;
  organizerCommission: number;
  pendingVendors: number;
  pendingOrganizers: number;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "users" | "vendors" | "organizers"
  >("users");
  const [users, setUsers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [organizers, setOrganizers] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Commission state from commission API
  const [totalCommission, setTotalCommission] = useState(0);
  const [totalReleased, setTotalReleased] = useState(0);
  const [payoutsCount, setPayoutsCount] = useState(0);

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

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, usersRes, vendorsRes, organizersRes, commissionRes] =
          await Promise.all([
            fetch("/api/admin/stats"),
            fetch("/api/admin/users"),
            fetch("/api/admin/vendors"),
            fetch("/api/admin/organizers"),
            fetch("/api/admin/commission/stats"),
          ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          console.log("Stats Data:", statsData);
          setStats(statsData);
        }
        if (usersRes.ok) setUsers(await usersRes.json());
        if (vendorsRes.ok) setVendors(await vendorsRes.json());
        if (organizersRes.ok) setOrganizers(await organizersRes.json());
        if (commissionRes.ok) {
          const commissionData = await commissionRes.json();
          console.log("Commission Data:", commissionData);
          setTotalCommission(commissionData.summary.totalCommission);
          setTotalReleased(commissionData.summary.totalReleased);
          setPayoutsCount(commissionData.summary.totalPayouts);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const updateStatus = async (userId: string, role: string, status: string) => {
    setActionLoading(userId);
    try {
      const response = await fetch("/api/admin/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role, status }),
      });

      if (response.ok) {
        showMessage(`User ${status.toLowerCase()} successfully`, "success");
        const [usersRes, vendorsRes, organizersRes] = await Promise.all([
          fetch("/api/admin/users"),
          fetch("/api/admin/vendors"),
          fetch("/api/admin/organizers"),
        ]);
        if (usersRes.ok) setUsers(await usersRes.json());
        if (vendorsRes.ok) setVendors(await vendorsRes.json());
        if (organizersRes.ok) setOrganizers(await organizersRes.json());
      } else {
        showMessage("Failed to update status", "error");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showMessage("Error updating status", "error");
    } finally {
      setActionLoading(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading admin dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }

  const pendingVendors = vendors.filter((v) => v.status === "PENDING");
  const pendingOrganizers = organizers.filter((o) => o.status === "PENDING");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Message Alert */}
        {message && (
          <div
            className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 rounded-xl p-4 shadow-lg min-w-[300px] text-center ${
              message.type === "success"
                ? "bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800"
                : "bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800"
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              {message.type === "success" ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              <p
                className={`text-sm font-medium ${message.type === "success" ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}
              >
                {message.text}
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Manage users, vendors, organizers, and platform analytics
          </p>
        </div>

        {/* Stats Cards - Row 1 */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total Users
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalUsers}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <UsersIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Active platform users
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total Vendors
                  </p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-500">
                    {stats.totalVendors}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <BuildingOfficeIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {pendingVendors.length} pending approval
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total Organizers
                  </p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-500">
                    {stats.totalOrganizers}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <BriefcaseIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {pendingOrganizers.length} pending approval
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total Events
                  </p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                    {stats.totalEvents}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CalendarIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Across all users
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards - Row 2 (Financial) */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total Bookings
                  </p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-500">
                    {stats.totalBookings}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <DocumentTextIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {stats.ticketBookings || 0} ticket • {stats.vendorBookings || 0}{" "}
                vendor
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Platform Earnings
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
                    NPR {totalCommission.toLocaleString()}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CurrencyRupeeIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                10% commission from {payoutsCount} payouts
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total Released
                  </p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-500">
                    NPR {stats.totalReleased?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <BanknotesIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Vendors: NPR {stats.releasedToVendors?.toLocaleString() || "0"}{" "}
                • Organizers: NPR{" "}
                {stats.releasedToOrganizers?.toLocaleString() || "0"}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-500">
                    NPR {stats.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <ArrowTrendingUpIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Total platform revenue (ticket + vendor)
              </p>
            </div>
          </div>
        )}

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link href="/admin/approvals?tab=vendors" className="block">
            <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-yellow-200 dark:border-yellow-800 hover:border-yellow-400 dark:hover:border-yellow-600 hover:shadow-lg transition-all duration-200 p-5 cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Pending Approvals
                  </p>
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-500">
                    {pendingVendors.length + pendingOrganizers.length}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-yellow-200 dark:group-hover:bg-yellow-800/50 transition-all duration-200">
                  <ClockIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              <div className="relative mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {pendingVendors.length} vendors, {pendingOrganizers.length}{" "}
                  organizers
                </p>
                <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Review →
                </span>
              </div>
            </div>
          </Link>

          <Link href="/admin/escrow" className="block">
            <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-lg transition-all duration-200 p-5 cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-transparent dark:from-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Escrow Management
                  </p>
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                    Release Funds
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800/50 transition-all duration-200">
                  <ShieldCheckIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <div className="relative mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Manage held funds & pay vendors
                </p>
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Manage →
                </span>
              </div>
            </div>
          </Link>

          <Link href="/admin/payouts" className="block">
            <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-lg transition-all duration-200 p-5 cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Payout History
                  </p>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {payoutsCount}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition-all duration-200">
                  <DocumentTextIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="relative mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  View all completed payouts
                </p>
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  View All →
                </span>
              </div>
            </div>
          </Link>

          <Link href="/admin/refunds" className="block">
            <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-red-200 dark:border-red-800 hover:border-red-400 dark:hover:border-red-600 hover:shadow-lg transition-all duration-200 p-5 cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-red-50 to-transparent dark:from-red-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Refund Management
                  </p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                    Process
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-red-200 dark:group-hover:bg-red-800/50 transition-all duration-200">
                  <CurrencyRupeeIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div className="relative mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-400">Handle customer refunds</p>
                <span className="text-xs font-medium text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Process →
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Tabs - Users, Vendors, Organizers */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex gap-6">
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-3 px-1 text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === "users"
                  ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              <UsersIcon className="h-4 w-4" />
              All Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab("vendors")}
              className={`pb-3 px-1 text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === "vendors"
                  ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              <BuildingOfficeIcon className="h-4 w-4" />
              Vendors ({vendors.length})
              {pendingVendors.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                  {pendingVendors.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("organizers")}
              className={`pb-3 px-1 text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === "organizers"
                  ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              <BriefcaseIcon className="h-4 w-4" />
              Organizers ({organizers.length})
              {pendingOrganizers.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                  {pendingOrganizers.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Users Table */}
        {activeTab === "users" && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">
                        {user.name}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.role === "ADMIN"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                              : user.role === "ORGANIZER"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : user.role === "VENDOR"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.status === "APPROVED"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : user.status === "BLOCKED"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex gap-2">
                          {user.status === "APPROVED" ? (
                            <button
                              onClick={() =>
                                updateStatus(user.id, user.role, "BLOCKED")
                              }
                              disabled={actionLoading === user.id}
                              className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              Block
                            </button>
                          ) : user.status === "BLOCKED" ? (
                            <button
                              onClick={() =>
                                updateStatus(user.id, user.role, "APPROVED")
                              }
                              disabled={actionLoading === user.id}
                              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                updateStatus(user.id, user.role, "APPROVED")
                              }
                              disabled={actionLoading === user.id}
                              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {users.length === 0 && (
              <div className="p-12 text-center">
                <UsersIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No users found
                </p>
              </div>
            )}
          </div>
        )}

        {/* Vendors Table */}
        {activeTab === "vendors" && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Business Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Owner
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {vendors.map((vendor) => (
                    <tr
                      key={vendor.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {vendor.businessName}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {vendor.user?.name}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {vendor.serviceType}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {vendor.location}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            vendor.status === "APPROVED"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : vendor.status === "BLOCKED"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}
                        >
                          {vendor.status}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex gap-2">
                          {vendor.status === "PENDING" && (
                            <button
                              onClick={() =>
                                updateStatus(
                                  vendor.userId,
                                  "VENDOR",
                                  "APPROVED",
                                )
                              }
                              disabled={actionLoading === vendor.userId}
                              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              Approve
                            </button>
                          )}
                          {vendor.status === "APPROVED" && (
                            <button
                              onClick={() =>
                                updateStatus(vendor.userId, "VENDOR", "BLOCKED")
                              }
                              disabled={actionLoading === vendor.userId}
                              className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              Block
                            </button>
                          )}
                          {vendor.status === "BLOCKED" && (
                            <button
                              onClick={() =>
                                updateStatus(
                                  vendor.userId,
                                  "VENDOR",
                                  "APPROVED",
                                )
                              }
                              disabled={actionLoading === vendor.userId}
                              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              Unblock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {vendors.length === 0 && (
              <div className="p-12 text-center">
                <BuildingOfficeIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No vendors found
                </p>
              </div>
            )}
          </div>
        )}

        {/* Organizers Table */}
        {activeTab === "organizers" && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Events
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {organizers.map((org) => (
                    <tr
                      key={org.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {org.name}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {org.email}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {org._count?.organizedEvents || 0}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            org.status === "APPROVED"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : org.status === "BLOCKED"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}
                        >
                          {org.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex gap-2">
                          {org.status === "PENDING" && (
                            <button
                              onClick={() =>
                                updateStatus(org.id, "ORGANIZER", "APPROVED")
                              }
                              disabled={actionLoading === org.id}
                              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              Approve
                            </button>
                          )}
                          {org.status === "APPROVED" && (
                            <button
                              onClick={() =>
                                updateStatus(org.id, "ORGANIZER", "BLOCKED")
                              }
                              disabled={actionLoading === org.id}
                              className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              Block
                            </button>
                          )}
                          {org.status === "BLOCKED" && (
                            <button
                              onClick={() =>
                                updateStatus(org.id, "ORGANIZER", "APPROVED")
                              }
                              disabled={actionLoading === org.id}
                              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              Unblock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {organizers.length === 0 && (
              <div className="p-12 text-center">
                <BriefcaseIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No organizers found
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
