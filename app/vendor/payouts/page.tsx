"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BanknotesIcon,
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
} from "@heroicons/react/24/outline";

interface Payout {
  id: string;
  amount: number;
  platformCommission: number;
  vendorPayout: number;
  type: string;
  status: string;
  processedAt: string;
  notes: string;
  eventTitle: string;
  packageName: string;
  customerName: string;
  adminName: string;
}

interface PendingBooking {
  id: string;
  eventTitle: string;
  eventDate: string;
  depositAmount: number;
  totalAmount: number;
  customerName: string;
  packageName: string;
}

export default function VendorPayoutsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [summary, setSummary] = useState({
    totalReleased: 0,
    totalCommission: 0,
    totalReceived: 0,
    pendingAmount: 0,
    pendingCount: 0,
    totalPayouts: 0,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    if (session && session.user?.role !== "VENDOR") {
      router.push("/");
    }
  }, [session, router]);

  useEffect(() => {
    const fetchPayouts = async () => {
      try {
        const response = await fetch("/api/vendor/payouts");
        if (response.ok) {
          const data = await response.json();
          setPayouts(data.payouts || []);
          setPendingBookings(data.pendingBookings || []);
          setSummary(data.summary || {
            totalReleased: 0,
            totalCommission: 0,
            totalReceived: 0,
            pendingAmount: 0,
            pendingCount: 0,
            totalPayouts: 0,
          });
        }
      } catch (error) {
        console.error("Error fetching payouts:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPayouts();
  }, [session]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-NP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return { text: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircleIcon };
      case "PENDING":
        return { text: "Pending", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: ClockIcon };
      case "PROCESSING":
        return { text: "Processing", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: ArrowPathIcon };
      default:
        return { text: status, color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300", icon: ClockIcon };
    }
  };

  if (!mounted || status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading payout history...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "VENDOR") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">

      {/* Navigation */}
      

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Payment History</h1>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Track your earnings and payment releases
              </p>
            </div>
            <Link
              href="/vendor"
              className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Earnings Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Released</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">NPR {summary.totalReleased.toLocaleString()}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <BanknotesIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{summary.totalPayouts} payouts completed</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Platform Commission (10%)</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">NPR {summary.totalCommission.toLocaleString()}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <InformationCircleIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Deducted from your earnings</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Net Received</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">NPR {summary.totalReceived.toLocaleString()}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Amount credited to your account</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending Release</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">NPR {summary.pendingAmount.toLocaleString()}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{summary.pendingCount} bookings waiting</p>
          </div>
        </div>

        {/* Pending Bookings Section */}
        {pendingBookings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
              Pending Payouts ({pendingBookings.length})
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Event</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Package</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Deposit Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {pendingBookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900 dark:text-white">{booking.eventTitle}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(booking.eventDate).toLocaleDateString()}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-gray-900 dark:text-white">{booking.customerName}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400">{booking.packageName}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-green-600 dark:text-green-400">NPR {booking.depositAmount.toLocaleString()}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                            <ClockIcon className="h-3 w-3 mr-1" />
                            Pending Release
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              <InformationCircleIcon className="h-3 w-3 inline mr-1" />
              Funds are released by admin after service completion. Platform commission (10%) will be deducted at release.
            </p>
          </div>
        )}

        {/* Payout History Table */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            Payout History
          </h2>
          
          {payouts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
              <BanknotesIcon className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No payouts yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Payments will appear here after admin releases funds</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Event</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gross Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Commission (10%)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Net Received</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {payouts.map((payout) => {
                      const StatusBadge = getStatusBadge(payout.status);
                      const StatusIcon = StatusBadge.icon;
                      
                      return (
                        <tr key={payout.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm text-gray-900 dark:text-white">{formatDate(payout.processedAt)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900 dark:text-white">{payout.eventTitle}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{payout.packageName}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900 dark:text-white">{payout.customerName}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900 dark:text-white">NPR {payout.amount.toLocaleString()}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-red-600 dark:text-red-400">- NPR {payout.platformCommission.toLocaleString()}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-green-600 dark:text-green-400">NPR {payout.vendorPayout.toLocaleString()}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${StatusBadge.color}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {StatusBadge.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Commission Info Box */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">How Commission Works</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                EventFlow charges a 10% platform commission on all payments released to vendors. 
                This commission is deducted automatically when admin releases funds. 
                The net amount shown is what you receive in your bank account.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}