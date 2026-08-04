"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  CalendarIcon, 
  TicketIcon, 
  BuildingOfficeIcon, 
  ArrowRightIcon,
  ClockIcon,
  CurrencyRupeeIcon,
  UserIcon,
  PlusIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

interface DashboardStats {
  totalBookings: number;
  totalTickets: number;
  totalRefunds: number;
  upcomingEvents: number;
}

interface RecentActivity {
  id: string;
  type: 'booking' | 'ticket' | 'refund';
  title: string;
  date: string;
  status: string;
  amount?: number;
}

export default function UserDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 0,
    totalTickets: 0,
    totalRefunds: 0,
    upcomingEvents: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!session) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch both endpoints in parallel
        const [statsRes, activityRes] = await Promise.all([
          fetch('/api/user/dashboard-stats'),
          fetch('/api/user/recent-activity'),
        ]);

        if (!statsRes.ok || !activityRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const statsData = await statsRes.json();
        const activityData = await activityRes.json();

        setStats(statsData);
        setRecentActivity(activityData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setError('Failed to load dashboard data. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [session]);

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "USER") {
    return null;
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-3 mx-auto w-fit">
            <span className="text-3xl">⚠️</span>
          </div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Stat cards configuration
  const statCards = [
    {
      label: "Total Bookings",
      value: stats.totalBookings,
      icon: CalendarIcon,
      color: "from-blue-500 to-blue-600",
      href: "/my-bookings",
    },
    {
      label: "My Tickets",
      value: stats.totalTickets,
      icon: TicketIcon,
      color: "from-green-500 to-green-600",
      href: "/my-tickets",
    },
    {
      label: "Upcoming Events",
      value: stats.upcomingEvents,
      icon: ClockIcon,
      color: "from-purple-500 to-purple-600",
      href: "/events",
    },
    {
      label: "My Refunds",
      value: stats.totalRefunds,
      icon: CurrencyRupeeIcon,
      color: "from-orange-500 to-orange-600",
      href: "/my-refunds",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'completed':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'used':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
      case 'accepted':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'declined':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ticket':
        return TicketIcon;
      case 'booking':
        return BuildingOfficeIcon;
      case 'refund':
        return CurrencyRupeeIcon;
      default:
        return CalendarIcon;
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              {session.user?.name?.split(' ')[0] || session.user?.name}
            </span>
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Here's what's happening with your events and bookings
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Browse Events
          </Link>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Find Vendors
          </Link>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {statCards.map((stat, index) => (
          <motion.div
            key={index}
            variants={fadeUp}
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Link
              href={stat.href}
              className="block rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
                </div>
                <div className={`rounded-lg bg-gradient-to-br ${stat.color} p-3 shadow-md`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="lg:col-span-2"
        >
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Activity
              </h2>
              <Link
                href="/my-bookings"
                className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1"
              >
                View All
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => {
                  const Icon = getActivityIcon(activity.type);
                  return (
                    <div
                      key={activity.id}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/30 p-2">
                        <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {activity.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(activity.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          {activity.amount && ` • ₹${activity.amount.toLocaleString()}`}
                        </p>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(activity.status)}`}>
                        {activity.status}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No recent activity yet. Start exploring events and vendors!
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Quick Actions / Profile Summary */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Quick Actions
              </h2>
            </div>
            <div className="p-6 space-y-3">
              <Link
                href="/my-tickets"
                className="flex items-center justify-between rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  View My Tickets
                </span>
                <TicketIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </Link>
              <Link
                href="/my-bookings"
                className="flex items-center justify-between rounded-lg bg-purple-50 dark:bg-purple-900/20 px-4 py-3 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  My Bookings
                </span>
                <CalendarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </Link>
              <Link
                href="/marketplace"
                className="flex items-center justify-between rounded-lg bg-green-50 dark:bg-green-900/20 px-4 py-3 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Find Vendors
                </span>
                <BuildingOfficeIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </Link>
              <Link
                href="/profile"
                className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Profile Settings
                </span>
                <UserIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Upcoming Events Section */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800 p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🎯 Ready to plan your next event?
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Discover amazing events or find trusted vendors for your social gatherings
            </p>
          </div>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            Explore Now
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}