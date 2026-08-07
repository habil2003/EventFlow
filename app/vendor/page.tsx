"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CubeIcon,
  PlusIcon,
  CalendarIcon,
  BanknotesIcon,
  UserGroupIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

interface VendorStats {
  totalPackages: number;
  activePackages: number;
  totalBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  completedBookings: number;
  recentBookings: Array<{
    id: string;
    customerName: string;
    eventTitle: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
  recentPackages: Array<{
    id: string;
    name: string;
    price: number;
    isActive: boolean;
    bookingsCount: number;
  }>;
}

interface VendorProfile {
  serviceType: string;
  businessName: string;
  location?: string | null;
  description?: string | null;
}

interface PackageSummary {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  _count?: { vendorBookings?: number };
}

interface BookingSummary {
  id: string;
  bookingStatus: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  user?: { name?: string };
  userSocialEvent?: { title?: string };
}

export default function VendorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState<VendorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

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

  // Fetch vendor data using existing APIs
  useEffect(() => {
    const fetchVendorData = async () => {
      if (!session?.user?.id) return;

      try {
        const profileRes = await fetch("/api/vendor/profile");
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setVendorProfile(profileData);
        }

        const packagesRes = await fetch("/api/vendor/packages");
        let packages: PackageSummary[] = [];
        if (packagesRes.ok) {
          const packagesData = await packagesRes.json();
          packages = packagesData.packages || packagesData || [];
        }

        const bookingsRes = await fetch("/api/vendor/bookings");
        let bookings: BookingSummary[] = [];
        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          bookings = bookingsData.bookings || bookingsData || [];
        }

        const totalPackages = packages.length;
        const activePackages = packages.filter((p) => p.isActive).length;
        const totalBookings = bookings.length;
        const pendingBookings = bookings.filter(
          (b) =>
            b.bookingStatus === "PENDING" || b.paymentStatus === "PENDING",
        ).length;
        const completedBookings = bookings.filter(
          (b) =>
            b.bookingStatus === "COMPLETED" || b.paymentStatus === "COMPLETED",
        ).length;

        const totalRevenue = bookings
          .filter(
            (b) =>
              b.paymentStatus === "COMPLETED" ||
              b.bookingStatus === "COMPLETED",
          )
          .reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);

        const recentBookings = bookings.slice(0, 5).map((b) => ({
          id: b.id,
          customerName: b.user?.name || "Customer",
          eventTitle: b.userSocialEvent?.title || "Social Event",
          amount: Number(b.totalAmount || 0),
          status: b.bookingStatus || b.paymentStatus || "PENDING",
          createdAt: b.createdAt,
        }));

        const recentPackages = packages.slice(0, 5).map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price || 0),
          isActive: p.isActive,
          bookingsCount: p._count?.vendorBookings || 0,
        }));

        setStats({
          totalPackages,
          activePackages,
          totalBookings,
          pendingBookings,
          totalRevenue,
          completedBookings,
          recentBookings,
          recentPackages,
        });
      } catch (error) {
        console.error("Error fetching vendor data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.role === "VENDOR") {
      fetchVendorData();
    }
  }, [session]);

  const getServiceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      venue: "Venue",
      catering: "Catering",
      photography: "Photography",
      decoration: "Decoration",
      makeup: "Makeup Artist",
      dj: "DJ / Music",
    };
    return labels[type] || type || "Service Provider";
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-4 text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "VENDOR") {
    return null;
  }

  const data = stats || {
    totalPackages: 0,
    activePackages: 0,
    totalBookings: 0,
    pendingBookings: 0,
    totalRevenue: 0,
    completedBookings: 0,
    recentBookings: [],
    recentPackages: [],
  };

  const quickActions = [
    {
      label: "Add Package",
      href: "/vendor/setup",
      icon: PlusIcon,
      color: "bg-indigo-600 hover:bg-indigo-700",
      description: "Create a new service package",
    },
    {
      label: "My Packages",
      href: "/vendor/packages",
      icon: CubeIcon,
      color: "bg-emerald-600 hover:bg-emerald-700",
      description: "View all your packages",
    },
    {
      label: "Bookings",
      href: "/vendor/bookings",
      icon: CalendarIcon,
      color: "bg-amber-600 hover:bg-amber-700",
      description: "Manage incoming bookings",
    },
    {
      label: "Payouts",
      href: "/vendor/payouts",
      icon: BanknotesIcon,
      color: "bg-purple-600 hover:bg-purple-700",
      description: "View payment history",
    },
  ];

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{greeting}</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {session.user?.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage your packages, track bookings, and receive payments
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center gap-3">
            {vendorProfile?.serviceType && (
              <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1 text-sm font-medium text-indigo-700 dark:text-indigo-400">
                {getServiceTypeLabel(vendorProfile.serviceType)}
              </span>
            )}
            <Link
              href="/vendor/setup"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 hover:scale-105 hover:shadow-lg transition-all duration-200"
            >
              <PlusIcon className="h-5 w-5" />
              Add Package
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200 cursor-default">
          <div className="flex items-center justify-between">
            <CubeIcon className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {data.totalPackages}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Packages</p>
          {data.activePackages > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              {data.activePackages} active
            </p>
          )}
        </div>

        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-amber-200 dark:hover:border-amber-800 transition-all duration-200 cursor-default">
          <div className="flex items-center justify-between">
            <CalendarIcon className="h-5 w-5 text-amber-500 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {data.totalBookings}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Bookings</p>
          {data.pendingBookings > 0 && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              {data.pendingBookings} pending
            </p>
          )}
        </div>

        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all duration-200 cursor-default">
          <div className="flex items-center justify-between">
            <BanknotesIcon className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            NPR {data.totalRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Revenue</p>
        </div>

        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800 transition-all duration-200 cursor-default">
          <div className="flex items-center justify-between">
            <UserGroupIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {data.completedBookings}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Completed Bookings</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {quickActions.map((action, idx) => (
            <Link
              key={idx}
              href={action.href}
              className="group rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:-translate-y-1 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200"
            >
              <div className={`inline-flex rounded-lg ${action.color} p-2.5 text-white shadow-sm transition-all duration-200 group-hover:scale-110 group-hover:shadow-md`}>
                <action.icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200">
                {action.label}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {action.description}
              </p>
              <div className="mt-2 flex items-center text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span className="text-xs font-medium">Get Started</span>
                <ArrowRightIcon className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform duration-200" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Business Profile Summary */}
      {vendorProfile && (
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200 mb-8">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center flex-shrink-0 transition-transform duration-200 hover:scale-105">
              <BuildingOfficeIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {vendorProfile.businessName || "Your Business"}
              </h3>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {getServiceTypeLabel(vendorProfile.serviceType)}
                </span>
                {vendorProfile.location && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <MapPinIcon className="h-3 w-3" />
                    {vendorProfile.location}
                  </span>
                )}
              </div>
              {vendorProfile.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                  {vendorProfile.description}
                </p>
              )}
              <Link
                href="/vendor/profile"
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-flex items-center gap-1 hover:gap-2 transition-all duration-200"
              >
                Manage Profile
                <ArrowRightIcon className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Bookings */}
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Bookings</h3>
            <Link href="/vendor/bookings" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-200">
              View all →
            </Link>
          </div>

          {data.recentBookings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No bookings yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                When customers book your services, they&apos;ll appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.recentBookings.slice(0, 5).map((booking, idx) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0 last:pb-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg transition-all duration-200"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {booking.customerName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {booking.eventTitle || "Event"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      NPR {booking.amount.toLocaleString()}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      booking.status === "PENDING"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : booking.status === "ACCEPTED"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : booking.status === "COMPLETED"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Packages */}
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Your Packages</h3>
            <Link href="/vendor/packages" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-200">
              View all →
            </Link>
          </div>

          {data.recentPackages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No packages yet</p>
              <Link
                href="/vendor/setup"
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-200"
              >
                Create your first package →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {data.recentPackages.slice(0, 5).map((pkg) => (
                <div
                  key={pkg.id}
                  className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0 last:pb-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg transition-all duration-200"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {pkg.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {pkg.bookingsCount || 0} bookings
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                      NPR {pkg.price.toLocaleString()}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      pkg.isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}>
                      {pkg.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          EventFlow — Nepal&apos;s Event Management Platform
        </p>
      </div>
    </div>
  );
}