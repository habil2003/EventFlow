"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ScaleIcon,
  XCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface Dispute {
  id: string;
  bookingId: string;
  reason: string;
  status: string;
  adminDecision: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { name: string; email: string };
  vendor: { name: string; email: string };
  booking: {
    eventTitle: string;
    totalAmount: number;
    packageName: string;
    paymentStatus: string;
    vendorPaymentStatus: string;
  };
}

interface DisputesResponse {
  disputes: Dispute[];
  summary: { total: number; open: number; resolved: number };
}

export default function DisputesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<DisputesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [decision, setDecision] = useState<"RESOLVED" | "REJECTED">("RESOLVED");
  const [adminDecision, setAdminDecision] = useState("");
  const [notes, setNotes] = useState("");

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

  const fetchDisputes = async (filter = statusFilter) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/disputes?status=${filter || "ALL"}`
      );
      if (response.ok) {
        const json = await response.json();
        setData(json);
      }
    } catch (error) {
      console.error("Error fetching disputes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const idFromUrl = searchParams.get("id");
    if (idFromUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatusFilter("ALL");
    }
    fetchDisputes(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const openResolveModal = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setDecision("RESOLVED");
    setAdminDecision("");
    setNotes("");
  };

  const submitDecision = async () => {
    if (!selectedDispute) return;
    if (!adminDecision.trim()) {
      showMessage("Admin decision is required", "error");
      return;
    }

    setActionLoading(selectedDispute.id);
    try {
      const response = await fetch(
        `/api/admin/disputes/${selectedDispute.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: decision,
            adminDecision: adminDecision.trim(),
            notes: notes.trim(),
          }),
        }
      );

      if (response.ok) {
        const json = await response.json();
        showMessage(json.message || "Dispute updated successfully", "success");
        setSelectedDispute(null);
        await fetchDisputes(statusFilter);
      } else {
        const err = await response.json();
        showMessage(err.error || "Failed to update dispute", "error");
      }
    } catch (error) {
      console.error("Error resolving dispute:", error);
      showMessage("Error resolving dispute", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const changeFilter = (filter: string) => {
    setStatusFilter(filter);
    fetchDisputes(filter);
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading disputes...
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
          <ScaleIcon className="h-8 w-8 text-red-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Dispute Resolution
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review and resolve vendor booking disputes
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchDisputes(statusFilter)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Refresh
          </span>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Disputes
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary?.total || 0}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <ScaleIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Open
              </p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                {summary?.open || 0}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Resolved
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                {summary?.resolved || 0}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["ALL", "OPEN", "RESOLVED", "REJECTED"].map((filter) => (
          <button
            key={filter}
            onClick={() => changeFilter(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === filter
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {filter.charAt(0) + filter.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Disputes Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Opened
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data?.disputes.map((dispute) => (
                <tr
                  key={dispute.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {dispute.booking.eventTitle}
                      </span>
                      <span className="text-xs text-gray-400">
                        {dispute.booking.packageName} • NPR{" "}
                        {Number(dispute.booking.totalAmount || 0).toLocaleString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {dispute.customer.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {dispute.customer.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {dispute.vendor.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {dispute.vendor.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[200px] line-clamp-2">
                      {dispute.reason}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        dispute.status === "RESOLVED"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : dispute.status === "REJECTED"
                          ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {dispute.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(dispute.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    {(dispute.status === "OPEN" ||
                      dispute.status === "PENDING") && (
                      <button
                        onClick={() => openResolveModal(dispute)}
                        className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                    {dispute.status !== "OPEN" &&
                      dispute.status !== "PENDING" &&
                      dispute.adminDecision && (
                        <span
                          className="text-xs text-gray-400 italic cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
                          onClick={() => openResolveModal(dispute)}
                        >
                          View decision
                        </span>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!data?.disputes || data.disputes.length === 0) && (
          <div className="text-center py-12">
            <ShieldCheckIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              No disputes found
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              All clear — no disputes match this filter
            </p>
          </div>
        )}
      </div>

      {/* Resolve Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedDispute(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedDispute.status === "OPEN" ||
                  selectedDispute.status === "PENDING"
                    ? "Resolve Dispute"
                    : "Dispute Details"}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDispute(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Dispute summary */}
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedDispute.booking.eventTitle}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {selectedDispute.booking.packageName} • NPR{" "}
                  {Number(selectedDispute.booking.totalAmount || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
                  {selectedDispute.reason}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    Customer: <strong>{selectedDispute.customer.name}</strong>
                  </span>
                  <span>
                    Vendor: <strong>{selectedDispute.vendor.name}</strong>
                  </span>
                  <span>
                    Payment:{" "}
                    <strong>{selectedDispute.booking.paymentStatus}</strong>
                  </span>
                  <span>
                    Vendor Status:{" "}
                    <strong>
                      {selectedDispute.booking.vendorPaymentStatus}
                    </strong>
                  </span>
                </div>
              </div>

              {selectedDispute.status === "OPEN" ||
              selectedDispute.status === "PENDING" ? (
                <>
                  {/* Decision type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Decision
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setDecision("RESOLVED")}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                          decision === "RESOLVED"
                            ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                        }`}
                      >
                        <CheckCircleIcon className="h-5 w-5 mx-auto mb-1" />
                        Resolve (Refund)
                      </button>
                      <button
                        onClick={() => setDecision("REJECTED")}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                          decision === "REJECTED"
                            ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                        }`}
                      >
                        <XCircleIcon className="h-5 w-5 mx-auto mb-1" />
                        Reject
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {decision === "RESOLVED"
                        ? "Resolving initiates a refund to the customer and declines the booking."
                        : "Rejecting dismisses the dispute and restores the booking to accepted status."}
                    </p>
                  </div>

                  {/* Admin decision */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Admin Decision
                    </label>
                    <textarea
                      value={adminDecision}
                      onChange={(e) => setAdminDecision(e.target.value)}
                      rows={3}
                      placeholder="Explain your decision..."
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Internal Notes (optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Internal notes for the team..."
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm"
                    />
                  </div>
                </>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Decision
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {selectedDispute.status}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    Admin Decision
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    {selectedDispute.adminDecision || "N/A"}
                  </p>
                </div>
              )}
            </div>

            {(selectedDispute.status === "OPEN" ||
              selectedDispute.status === "PENDING") && (
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setSelectedDispute(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitDecision}
                  disabled={actionLoading === selectedDispute.id}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${
                    decision === "RESOLVED"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {actionLoading === selectedDispute.id
                    ? "Processing..."
                    : decision === "RESOLVED"
                    ? "Resolve & Refund"
                    : "Reject Dispute"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
