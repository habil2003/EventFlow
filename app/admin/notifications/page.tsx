"use client";

import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BellIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  ReceiptRefundIcon,
  CurrencyRupeeIcon,
  ScaleIcon,
  DocumentTextIcon,
  ArrowRightIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";

interface NotificationItem {
  id: string;
  type: string;
  severity: "warning" | "critical" | "info";
  title: string;
  description: string;
  link: string;
  createdAt: string;
}

interface NotificationsResponse {
  items: NotificationItem[];
  summary: {
    vendorApprovals: number;
    organizerApprovals: number;
    openDisputes: number;
    pendingRefunds: number;
    pendingBookings: number;
    failedPayouts: number;
    escrowHeld: number;
    escrowAmount: number;
    unread: number;
  };
}

const TYPE_META: Record<string, { icon: ElementType; label: string; color: string }> = {
  VENDOR_APPROVAL: {
    icon: BuildingOfficeIcon,
    label: "Vendor Approval",
    color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400",
  },
  ORGANIZER_APPROVAL: {
    icon: UserGroupIcon,
    label: "Organizer Approval",
    color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
  },
  DISPUTE: {
    icon: ScaleIcon,
    label: "Dispute",
    color: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
  },
  REFUND: {
    icon: ReceiptRefundIcon,
    label: "Refund Required",
    color: "text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400",
  },
  VENDOR_BOOKING: {
    icon: DocumentTextIcon,
    label: "Pending Booking",
    color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  PAYOUT: {
    icon: CurrencyRupeeIcon,
    label: "Failed Payout",
    color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
  },
};

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

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

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/notifications");
      if (response.ok) {
        setData(await response.json());
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
  }, []);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading notifications...
          </p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }

  const summary = data?.summary;
  const items = (data?.items || [])
    .filter((item) => severityFilter === "all" || item.severity === severityFilter)
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const severityStyles: Record<string, { dot: string; badge: string; label: string }> = {
    critical: {
      dot: "bg-red-500",
      badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      label: "Critical",
    },
    warning: {
      dot: "bg-yellow-500",
      badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      label: "Warning",
    },
    info: {
      dot: "bg-blue-500",
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      label: "Info",
    },
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <BellIcon className="h-8 w-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Notifications
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Action center — items requiring your attention
            </p>
          </div>
        </div>
        <button
          onClick={fetchNotifications}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Refresh
          </span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link href="/admin/approvals" className="block">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Pending Approvals
                </p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                  {(summary?.vendorApprovals || 0) +
                    (summary?.organizerApprovals || 0)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {summary?.vendorApprovals || 0} vendors •{" "}
              {summary?.organizerApprovals || 0} organizers
            </p>
          </div>
        </Link>

        <Link href="/admin/disputes" className="block">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Open Disputes
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-500">
                  {summary?.openDisputes || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <ScaleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Require resolution</p>
          </div>
        </Link>

        <Link href="/admin/refunds" className="block">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Pending Refunds
                </p>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-500">
                  {summary?.pendingRefunds || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <ReceiptRefundIcon className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Manual action needed</p>
          </div>
        </Link>

        <Link href="/admin/escrow" className="block">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Escrow Held
                </p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  NPR {(summary?.escrowAmount || 0).toLocaleString()}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <BanknotesIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {summary?.escrowHeld || 0} bookings awaiting release
            </p>
          </div>
        </Link>
      </div>

      {/* Severity Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "critical", "warning", "info"].map((filter) => (
          <button
            key={filter}
            onClick={() => setSeverityFilter(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              severityFilter === filter
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Notifications Feed */}
      <div className="space-y-3">
        {items.map((item) => {
          const meta = TYPE_META[item.type] || {
            icon: BellIcon,
            label: "Notification",
            color: "text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300",
          };
          const Icon = meta.icon;
          const severity = severityStyles[item.severity];
          return (
            <Link
              key={item.id}
              href={item.link}
              className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${severity.badge}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${severity.dot}`}
                        />
                        {severity.label}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                      <span>
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="inline-flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      View
                      <ArrowRightIcon className="h-3 w-3 ml-1" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {items.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
            <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              You&apos;re all caught up!
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              No {severityFilter === "all" ? "" : severityFilter + " "}
              items require your attention
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
