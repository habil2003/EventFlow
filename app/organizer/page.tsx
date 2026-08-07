// app/organizer/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarIcon,
  TicketIcon,
  ChartBarIcon,
  BanknotesIcon,
  PlusCircleIcon,
  ArrowRightIcon,
  UserGroupIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

interface DashboardStats {
  totalEvents: number;
  activeEvents: number;
  totalTicketsSold: number;
  totalRevenue: number;
  upcomingEvents: number;
  checkInsToday: number;
  recentEvents: Array<{
    id: string;
    title: string;
    eventDate: string;
    ticketsSold: number;
    revenue: number;
    checkIns: number;
    status: 'active' | 'completed' | 'upcoming';
  }>;
  recentSales: Array<{
    id: string;
    eventTitle: string;
    buyerName: string;
    amount: number;
    createdAt: string;
  }>;
}

export default function OrganizerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
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

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!session?.user?.id) return;
      
      try {
        const response = await fetch("/api/organizer/dashboard");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.role === "ORGANIZER") {
      fetchDashboardData();
    }
  }, [session]);

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

  if (!session || session.user?.role !== "ORGANIZER") {
    return null;
  }

  const data = stats || {
    totalEvents: 0,
    activeEvents: 0,
    totalTicketsSold: 0,
    totalRevenue: 0,
    upcomingEvents: 0,
    checkInsToday: 0,
    recentEvents: [],
    recentSales: [],
  };

  const quickActions = [
    { 
      label: "Create Event", 
      href: "/organizer/create", 
      icon: PlusCircleIcon, 
      color: "bg-indigo-600",
      description: "Set up a new event"
    },
    { 
      label: "My Events", 
      href: "/organizer/events", 
      icon: CalendarIcon, 
      color: "bg-emerald-600",
      description: "View all your events"
    },
    { 
      label: "Check-in", 
      href: "/organizer/checkin", 
      icon: UserGroupIcon, 
      color: "bg-amber-600",
      description: "Scan tickets at venue"
    },
    { 
      label: "Sales", 
      href: "/organizer/sales", 
      icon: ChartBarIcon, 
      color: "bg-purple-600",
      description: "Track revenue"
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
              Here&apos;s what&apos;s happening with your events
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Link
              href="/organizer/create"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <PlusCircleIcon className="h-5 w-5" />
              Create Event
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <CalendarIcon className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {data.totalEvents}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Events</p>
          {data.activeEvents > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              {data.activeEvents} active
            </p>
          )}
        </div>

        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <TicketIcon className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {data.totalTicketsSold}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Tickets Sold</p>
        </div>

        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <BanknotesIcon className="h-5 w-5 text-amber-500 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            NPR {data.totalRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Revenue</p>
        </div>

        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <UserGroupIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {data.checkInsToday}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Check-ins Today</p>
          {data.upcomingEvents > 0 && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {data.upcomingEvents} upcoming
            </p>
          )}
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
              className="group rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all"
            >
              <div className={`inline-flex rounded-lg ${action.color} p-2.5 text-white shadow-sm`}>
                <action.icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">
                {action.label}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Events */}
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Your Events</h3>
          <Link href="/organizer/events" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            View all
          </Link>
        </div>
        
        {data.recentEvents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No events yet</p>
            <Link href="/organizer/create" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block">
              Create your first event →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {data.recentEvents.map((event) => (
              <div key={event.id} className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-gray-700 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {event.title}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      📅 {new Date(event.eventDate).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      🎫 {event.ticketsSold} sold
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ✅ {event.checkIns} checked in
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    event.status === 'active' 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : event.status === 'upcoming'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {event.status}
                  </span>
                  <Link 
                    href={`/organizer/events/${event.id}`}
                    className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}