"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ScaleIcon,
  CurrencyRupeeIcon,
  BanknotesIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  WalletIcon,
  HandRaisedIcon,
} from "@heroicons/react/24/outline";

interface CommissionData {
  summary: {
    totalCommission: number;
    totalReleased: number;
    totalVendorPayout: number;
    totalPayouts: number;
    depositCommission: number;
    remainingCommission: number;
  };
  recentPayouts: {
    id: string;
    amount: number;
    platformCommission: number;
    vendorPayout: number;
    type: string;
    processedAt: string | null;
    eventTitle: string;
    vendorName: string;
    customerName: string;
    adminName: string;
  }[];
}

export default function CommissionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<CommissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/commission/stats");
      if (response.ok) {
        const json = await response.json();
        setData(json);
      } else {
        setError("Failed to load commission data");
      }
    } catch (err) {
      console.error("Error fetching commissions:", err);
      setError("Failed to load commission data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading commission data...
          </p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }

  const summary = data?.summary;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <ScaleIcon className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Commissions
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track platform commission earned on payouts
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Refresh
          </span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {summary && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total Commission
                  </p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    NPR {summary.totalCommission.toLocaleString()}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <ScaleIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Across {summary.totalPayouts} completed payouts
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total Released
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    NPR {summary.totalReleased.toLocaleString()}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <BanknotesIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Gross amount paid out to vendors
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Vendor Net Payout
                  </p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    NPR {summary.totalVendorPayout.toLocaleString()}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <WalletIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                After platform commission deducted
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Payouts Processed
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {summary.totalPayouts}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <DocumentTextIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Deposit + remaining payments
              </p>
            </div>
          </div>

          {/* Deposit vs Remaining Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <HandRaisedIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Deposit Payouts
                </h3>
              </div>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                NPR {summary.depositCommission.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Commission earned from booking deposits
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <CurrencyRupeeIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Remaining Payouts
                </h3>
              </div>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                NPR {summary.remainingCommission.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Commission earned from remaining balances
              </p>
            </div>
          </div>
        </>
      )}

      {/* Recent Payouts */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-4">
          <DocumentTextIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Recent Payouts
          </h2>
          <div className="flex-1 border-t border-gray-200 dark:border-gray-700"></div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Vendor Payout
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Processed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data?.recentPayouts.map((payout) => (
                  <tr
                    key={payout.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {payout.eventTitle}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {payout.vendorName}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          payout.type === "DEPOSIT"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}
                      >
                        {payout.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                      NPR {payout.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-indigo-600 dark:text-indigo-400">
                      NPR {payout.platformCommission.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-emerald-600 dark:text-emerald-400">
                      NPR {payout.vendorPayout.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {payout.processedAt
                        ? new Date(payout.processedAt).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(!data?.recentPayouts || data.recentPayouts.length === 0) && (
            <div className="text-center py-12">
              <ScaleIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                No completed payouts yet
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Commission will appear here once payouts are processed
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
