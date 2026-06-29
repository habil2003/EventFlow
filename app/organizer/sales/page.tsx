"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  ArrowLeftIcon,
  TicketIcon,
  CurrencyRupeeIcon,
  UserGroupIcon,
  ChartBarIcon,
  CalendarIcon,
  MoonIcon,
  SunIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  PlusCircleIcon
} from "@heroicons/react/24/outline";

// DON'T import useTheme - we'll handle theme manually

interface Event {
  id: string;
  title: string;
  eventDate: string;
  totalTicketsSold: number;
  totalRevenue: number;
  ticketTiers: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    soldCount: number;
  }[];
}

interface Attendee {
  id: string;
  name: string;
  email: string;
  ticketName: string;
  quantity: number;
  totalAmount: number;
  checkedIn: boolean;
  checkedInAt?: string;
  createdAt: string;
}

export default function SalesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Manual theme management instead of useTheme
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  
  const eventId = searchParams.get("eventId");
  
  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingSales, setLoadingSales] = useState(false);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [copied, setCopied] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Handle theme independently
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
    setMounted(true);
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

  // Fetch all events for dropdown
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoadingEvents(true);
        setFetchError(false);
        const response = await fetch("/api/organizer/events");
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const eventsArray = Array.isArray(data) ? data : [];
        setAllEvents(eventsArray);
        
        if (eventsArray.length > 0) {
          if (eventId && eventsArray.some(e => e.id === eventId)) {
            setSelectedEvent(eventId);
          } else {
            setSelectedEvent(eventsArray[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching events:", error);
        setFetchError(true);
        setAllEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchEvents();
  }, [eventId]);

  // Fetch sales data for selected event
  useEffect(() => {
    if (!selectedEvent || allEvents.length === 0) return;

    const fetchSales = async () => {
      setLoadingSales(true);
      try {
        const response = await fetch(`/api/organizer/events/${selectedEvent}/sales`);
        if (response.ok) {
          const data = await response.json();
          setEvent(data.event);
          setAttendees(data.attendees || []);
        } else {
          console.error("Failed to fetch sales");
          setEvent(null);
          setAttendees([]);
        }
      } catch (error) {
        console.error("Error fetching sales:", error);
        setEvent(null);
        setAttendees([]);
      } finally {
        setLoadingSales(false);
      }
    };
    fetchSales();
  }, [selectedEvent, allEvents.length]);

  const exportToCSV = () => {
    if (attendees.length === 0) return;
    
    const headers = ["Name", "Email", "Ticket Type", "Quantity", "Total Amount", "Check-in Status", "Purchase Date"];
    const rows = attendees.map(a => [
      a.name,
      a.email,
      a.ticketName,
      a.quantity,
      a.totalAmount,
      a.checkedIn ? "Checked In" : "Not Checked In",
      new Date(a.createdAt).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event?.title || "sales"}_sales.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyEventLink = async () => {
    const link = `${window.location.origin}/events/${event?.id}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show loading until mounted (client-side)
  if (status === "loading" || !mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="inline-block h-12 w-12 rounded-full border-4 border-indigo-600 border-t-transparent"
          ></motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            Loading dashboard...
          </motion.p>
        </div>
      </div>
    );
  }

  if (session?.user?.role !== "ORGANIZER") {
    router.push("/");
    return null;
  }

  const soldPercentage = event && event.totalTicketsSold > 0 && event.ticketTiers?.reduce((sum, t) => sum + t.quantity, 0) > 0
    ? (event.totalTicketsSold / event.ticketTiers.reduce((sum, t) => sum + t.quantity, 0)) * 100
    : 0;

  const checkedInCount = attendees
  .filter(a => a.checkedIn)
  .reduce((sum, a) => sum + (a.quantity || 1), 0);
  const checkinPercentage = event && event.totalTicketsSold > 0 ? (checkedInCount / event.totalTicketsSold) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      
      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        
        <Link
          href="/organizer/events"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mb-6 group"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
          Back to Events
        </Link>

        {/* Loading Events State */}
        {loadingEvents && (
          <div className="flex justify-center py-20">
            <div className="text-center">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
              <p className="mt-3 text-sm text-gray-500">Loading your events...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {fetchError && !loadingEvents && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
              <ExclamationTriangleIcon className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Failed to Load Events
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              There was an error loading your events. Please try again later.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Retry
            </button>
          </motion.div>
        )}

        {/* NO EVENTS FOUND - MAIN EMPTY STATE */}
        {!loadingEvents && !fetchError && allEvents.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
          >
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 mb-6">
              <CalendarIcon className="h-14 w-14 text-indigo-600 dark:text-indigo-400" />
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              No Events Yet
            </h3>
            
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
              You haven't created any events. Create your first event to start tracking sales and analytics.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/organizer/create"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all group"
              >
                <PlusCircleIcon className="h-5 w-5 group-hover:rotate-90 transition-transform" />
                Create Your First Event
              </Link>
              
              <Link
                href="/organizer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                Back to Dashboard
              </Link>
            </div>
          </motion.div>
        )}

        {/* Events Exist - Show Event Selector and Data */}
        {!loadingEvents && !fetchError && allEvents.length > 0 && (
          <>
            {/* Event Selector */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Event
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              >
                {allEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} - {new Date(e.eventDate).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            {/* Loading Sales State */}
            {loadingSales && (
              <div className="flex justify-center py-20">
                <div className="text-center">
                  <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
                  <p className="mt-3 text-sm text-gray-500">Loading sales data...</p>
                </div>
              </div>
            )}

            {/* No Attendees State */}
            {!loadingSales && event && attendees.length === 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
              >
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 mb-6">
                  <UserGroupIcon className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No Tickets Sold Yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  Your event "{event.title}" hasn't received any ticket sales yet.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href={`/events/${event.id}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-md transition-all group"
                  >
                    <TicketIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    View Event Page
                  </Link>
                  <button
                    onClick={copyEventLink}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all group"
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="h-4 w-4 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <ClipboardDocumentIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
                        Copy Event Link
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Event Selected with Sales Data */}
            {!loadingSales && event && attendees.length > 0 && (
              <>
                {/* Stats Cards */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
                >
                  <motion.div 
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Tickets Sold</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{event.totalTicketsSold}</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <TicketIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    </div>
                  </motion.div>

                  <motion.div 
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          NPR {event.totalRevenue.toLocaleString()}
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CurrencyRupeeIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                  </motion.div>

                  <motion.div 
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Check-ins</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {checkedInCount} / {event.totalTicketsSold}
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <UserGroupIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-purple-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${checkinPercentage}%` }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                    </div>
                  </motion.div>

                  <motion.div 
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Fill Rate</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(soldPercentage)}%</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <ChartBarIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-amber-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${soldPercentage}%` }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Ticket Tiers Breakdown */}
                {event.ticketTiers && event.ticketTiers.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8"
                  >
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ticket Tiers Breakdown</h2>
                    <div className="space-y-4">
                      {event.ticketTiers.map((tier, idx) => {
                        const tierSoldPercentage = tier.quantity > 0 ? (tier.soldCount / tier.quantity) * 100 : 0;
                        return (
                          <motion.div 
                            key={tier.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium text-gray-700 dark:text-gray-300">{tier.name}</span>
                              <span className="text-gray-500 dark:text-gray-400">
                                {tier.soldCount} / {tier.quantity} sold
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <motion.div 
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${tierSoldPercentage}%` }}
                                transition={{ duration: 0.8, delay: idx * 0.1 }}
                              />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">NPR {tier.price.toLocaleString()} per ticket</p>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Attendees List */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                  <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center flex-wrap gap-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Attendees ({attendees.length})
                    </h2>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={exportToCSV}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                      Export CSV
                    </motion.button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ticket</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {attendees.map((attendee, idx) => (
                          <motion.tr 
                            key={attendee.id} 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.02 }}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                          >
                            <td className="px-6 py-3 text-sm text-gray-900 dark:text-white font-medium">{attendee.name}</td>
                            <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">{attendee.email}</td>
                            <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">{attendee.ticketName}</td>
                            <td className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">NPR {attendee.totalAmount.toLocaleString()}</td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                attendee.checkedIn 
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" 
                                  : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                              }`}>
                                {attendee.checkedIn ? "✓ Checked In" : "⏳ Not Checked In"}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}