"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyRupeeIcon,
  DocumentTextIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

interface PayoutDetail {
  id: string;
  amount: number;
  platformCommission: number;
  vendorPayout: number;
  type: string;
  status: string;
  createdAt: string;
  processedAt: string;
  notes: string;
  transactionId: string;
  khaltiPayoutId: string;
  vendor: {
    businessName: string;
    user: { name: string; email: string };
  } | null;
  vendorBooking: {
    user: { name: string; email: string };
    userSocialEvent: { title: string; eventDate: string };
    servicePackage: { name: string };
  } | null;
  ticketBooking: {
    event: { title: string };
    user: { name: string; email: string };
    tier: { name: string };
  } | null;
  admin: { name: string; email: string };
}

export default function AdminPayoutDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [payout, setPayout] = useState<PayoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

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
    const fetchPayout = async () => {
      try {
        const response = await fetch(`/api/admin/payouts/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setPayout(data.data);
        }
      } catch (error) {
        console.error("Error fetching payout:", error);
      } finally {
        setLoading(false);
      }
    };
    if (params.id) {
      fetchPayout();
    }
  }, [params.id]);

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/admin/payouts/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        const data = await response.json();
        setPayout(data.data);
      }
    } catch (error) {
      console.error("Error updating payout:", error);
    } finally {
      setUpdating(false);
    }
  };

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
        return { text: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
      case "PENDING":
        return { text: "Pending", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
      case "PROCESSING":
        return { text: "Processing", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
      default:
        return { text: status, color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" };
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading payout details...</p>
        </div>
      </div>
    );
  }

  if (!payout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12">
            <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payout Not Found</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">The payout you're looking for doesn't exist.</p>
            <Link href="/admin/payouts" className="mt-6 inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Back to Payouts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusBadge = getStatusBadge(payout.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/payouts"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Payouts
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">Payout #{payout.id.slice(0, 8)}</h1>
                <p className="text-white/80 text-sm mt-1">Created: {formatDate(payout.createdAt)}</p>
              </div>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${statusBadge.color}`}>
                {statusBadge.text}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Gross Amount</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(payout.amount)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Commission (10%)</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(payout.platformCommission)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">Net Payout</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(payout.vendorPayout)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Recipient</h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {payout.vendor?.businessName || payout.ticketBooking?.event?.title || 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {payout.vendor?.user?.name || payout.ticketBooking?.user?.name || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {payout.vendor?.user?.email || payout.ticketBooking?.user?.email || 'N/A'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Event Details</h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {payout.vendorBooking?.userSocialEvent?.title || payout.ticketBooking?.event?.title || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Type: {payout.type}
                  </p>
                  {payout.vendorBooking?.userSocialEvent?.eventDate && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDate(payout.vendorBooking.userSocialEvent.eventDate)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Processed By</h3>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-gray-900 dark:text-white">{payout.admin?.name || 'System'}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{payout.admin?.email || 'N/A'}</p>
                {payout.processedAt && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Processed: {formatDate(payout.processedAt)}
                  </p>
                )}
              </div>
            </div>

            {payout.notes && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Notes</h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{payout.notes}</p>
                </div>
              </div>
            )}

            {payout.status === 'PENDING' && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Actions</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => updateStatus('PROCESSING')}
                    disabled={updating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Mark as Processing
                  </button>
                  <button
                    onClick={() => updateStatus('COMPLETED')}
                    disabled={updating}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    Mark as Completed
                  </button>
                </div>
              </div>
            )}

            {payout.status === 'PROCESSING' && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <button
                  onClick={() => updateStatus('COMPLETED')}
                  disabled={updating}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Mark as Completed
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}