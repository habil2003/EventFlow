"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  CalendarIcon, 
  TicketIcon, 
  QrCodeIcon, 
  ChartBarIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CurrencyRupeeIcon
} from "@heroicons/react/24/outline";

export default function OrganizerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Manual theme management for dark/light classes (no toggle button needed)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

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

  if (status === "loading" || !mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400"></div>
          <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">Loading dashboard...</p>
        </motion.div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ORGANIZER") {
    return null;
  }

  const navItems = [
    { name: "Create Event", href: "/organizer/create", icon: CalendarIcon, color: "from-blue-500 to-blue-600", description: "Set up a new ticketed event" },
    { name: "My Events", href: "/organizer/events", icon: TicketIcon, color: "from-green-500 to-green-600", description: "Manage your events" },
    { name: "Check-in", href: "/organizer/checkin", icon: QrCodeIcon, color: "from-indigo-500 to-indigo-600", description: "Scan QR codes at venue" },
    { name: "Sales", href: "/organizer/sales", icon: ChartBarIcon, color: "from-purple-500 to-purple-600", description: "View revenue analytics" },
    { name: "Payouts", href: "/organizer/payouts", icon: CurrencyRupeeIcon, color: "from-amber-500 to-amber-600", description: "View payment history" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Welcome Section */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mb-12 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-3 py-1 text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-4"
          >
            <SparklesIcon className="mr-1 h-4 w-4" />
            Organizer Dashboard
          </motion.div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              {session.user?.name}
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-500 dark:text-gray-400 sm:text-lg">
            Manage your events, track ticket sales, and check in attendees
          </p>
        </motion.div>

        {/* Authentication Status Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-800 shadow-sm"
        >
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="rounded-full bg-green-100 dark:bg-green-800 p-2">
                  <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-green-800 dark:text-green-300">Authentication Verified</h2>
                  <p className="text-sm text-green-700 dark:text-green-400">You are logged in as Organizer</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-800 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-300">
                {session.user?.role}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-white/50 dark:bg-gray-800/50 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{session.user?.name}</p>
              </div>
              <div className="rounded-lg bg-white/50 dark:bg-gray-800/50 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{session.user?.email}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mb-8"
        >
          <h2 className="mb-4 text-lg font-bold text-gray-800 dark:text-gray-200">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {navItems.map((item, idx) => (
              <motion.div
                key={idx}
                variants={fadeUp}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Link
                  href={item.href}
                  className="group relative block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 transition-all hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className={`rounded-lg bg-gradient-to-br ${item.color} p-2.5 shadow-md`}>
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <motion.div
                      initial={{ x: -10, opacity: 0 }}
                      whileHover={{ x: 0, opacity: 1 }}
                    >
                      <ArrowRightIcon className="h-4 w-4 text-gray-400 dark:text-gray-600" />
                    </motion.div>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-800 dark:text-gray-200">{item.name}</h3>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{item.description}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Platform Overview Cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="mt-12"
        >
          <h2 className="mb-6 text-center text-xl font-bold text-gray-800 dark:text-gray-200">
            Manage Your Events
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            
            <motion.div
              variants={fadeUp}
              whileHover={{ y: -5, scale: 1.01 }}
              className="group rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-md border border-gray-100 dark:border-gray-700 transition-all hover:shadow-xl"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-md">
                <TicketIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">🎟️ Ticketed Events</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Create and manage concerts, workshops, seminars, and conferences.
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  "Tiered ticket pricing (Early Bird, GA, VIP)",
                  "Khalti & eSewa payment integration",
                  "QR code tickets & email confirmation",
                  "Real-time check-in scanner"
                ].map((item, i) => (
                  <li key={i} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <CheckCircleIcon className="mr-2 h-4 w-4 text-green-500 dark:text-green-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              variants={fadeUp}
              whileHover={{ y: -5, scale: 1.01 }}
              className="group rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-md border border-gray-100 dark:border-gray-700 transition-all hover:shadow-xl"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-md">
                <ChartBarIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">📊 Sales Analytics</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Track ticket sales, revenue, and attendance rates.
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  "Real-time sales dashboard",
                  "CSV export of attendee data",
                  "Ticket tier breakdown",
                  "Check-in rate tracking"
                ].map((item, i) => (
                  <li key={i} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <CheckCircleIcon className="mr-2 h-4 w-4 text-green-500 dark:text-green-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 border-t border-gray-200 dark:border-gray-700 pt-8 text-center"
        >
          <p className="text-xs text-gray-400 dark:text-gray-500">
            EventFlow — Nepal's Complete Event Management Solution
          </p>
          <p className="mt-1 text-xs text-gray-300 dark:text-gray-600">
            © 2026 Fusion IT Solutions. All rights reserved.
          </p>
        </motion.footer>
      </main>
    </div>
  );
}