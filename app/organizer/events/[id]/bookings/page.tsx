"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTheme } from "@/components/ThemeProvider";
import ThemeWrapper from "@/components/ThemeWrapper";
import { 
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
  TicketIcon,
  UserIcon,
  CurrencyRupeeIcon,
  CheckCircleIcon,
  XCircleIcon,
  QrCodeIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  SunIcon
} from "@heroicons/react/24/outline";

interface Booking {
  id: string;
  ticketNumber: string;
  quantity: number;
  totalAmount: number;
  checkedIn: boolean;
  checkedInAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  tier: {
    id: string;
    name: string;
    price: number;
  };
}

interface Event {
  id: string;
  title: string;
  eventDate: string;
  eventTime: string;
  location: string;
}

// Helper function to safely convert any value to a number
const safeNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return 0;
};

function EventBookingsContent({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { id: eventId } = use(params);
  
  const [event, setEvent] = useState<Event | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "checked" | "unchecked">("all");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch event details
        const eventRes = await fetch(`/api/organizer/events/${eventId}`);
        if (eventRes.ok) {
          const eventData = await eventRes.json();
          setEvent(eventData);
        }

        // Fetch bookings
        const bookingsRes = await fetch(`/api/organizer/events/${eventId}/bookings`);
        if (bookingsRes.ok) {
          const data = await bookingsRes.json();
          setBookings(data);
          setFilteredBookings(data);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId]);

  // Apply filters
  useEffect(() => {
    let filtered = [...bookings];

    if (filterStatus === "checked") {
      filtered = filtered.filter(b => b.checkedIn);
    } else if (filterStatus === "unchecked") {
      filtered = filtered.filter(b => !b.checkedIn);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.user.name.toLowerCase().includes(term) ||
        b.user.email.toLowerCase().includes(term) ||
        b.ticketNumber?.toLowerCase().includes(term)
      );
    }

    setFilteredBookings(filtered);
  }, [searchTerm, filterStatus, bookings]);

  // Calculate stats - calculate based on quantity for total tickets
  const totalTickets = bookings.reduce((sum, b) => sum + (b.quantity || 1), 0);
  const checkedInTickets = bookings.filter(b => b.checkedIn).reduce((sum, b) => sum + (b.quantity || 1), 0);
  const notCheckedInTickets = totalTickets - checkedInTickets;
  
  // Calculate revenue - use safeNumber and consider quantity
  const totalRevenue = bookings.reduce((sum, b) => {
    const amount = safeNumber(b.totalAmount);
    return sum + amount;
  }, 0);

  const stats = {
    total: bookings.length,
    totalTickets: totalTickets,
    checkedIn: checkedInTickets,
    notCheckedIn: notCheckedInTickets,
    totalRevenue: totalRevenue,
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading bookings...</p>
        </div>
      </div>
    );
  }

  if (session?.user?.role !== "ORGANIZER") {
    router.push("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      
      {/* Navigation */}
      

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Back Button */}
        <Link
          href={`/organizer/events/${eventId}`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-6 group"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
          Back to Event Dashboard
        </Link>

        {/* Event Header */}
        {event && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{event.title} - Bookings</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center">
                <CalendarIcon className="h-4 w-4 mr-1 text-indigo-500" />
                {new Date(event.eventDate).toLocaleDateString()} at {event.eventTime}
              </div>
              <div className="flex items-center">
                <MapPinIcon className="h-4 w-4 mr-1 text-indigo-500" />
                {event.location}
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500">Total Bookings</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500">Total Tickets</p>
            <p className="text-2xl font-bold text-indigo-600">{stats.totalTickets}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500">Checked In</p>
            <p className="text-2xl font-bold text-green-600">{stats.checkedIn}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500">Not Checked In</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.notCheckedIn}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-green-600">NPR {stats.totalRevenue.toLocaleString()}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or ticket number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === "all" 
                  ? "bg-indigo-600 text-white" 
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus("unchecked")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === "unchecked" 
                  ? "bg-yellow-600 text-white" 
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Not Checked
            </button>
            <button
              onClick={() => setFilterStatus("checked")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === "checked" 
                  ? "bg-green-600 text-white" 
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Checked In
            </button>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booked On</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {booking.ticketNumber || "N/A"}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{booking.user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{booking.user.email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{booking.tier.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {booking.quantity || 1}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        NPR {safeNumber(booking.totalAmount).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {booking.checkedIn ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircleIcon className="h-3 w-3" />
                          Checked In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          <XCircleIcon className="h-3 w-3" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/organizer/checkin?eventId=${eventId}`}
                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                        title="Go to Check-in"
                      >
                        <QrCodeIcon className="h-5 w-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredBookings.length === 0 && (
            <div className="p-12 text-center">
              <TicketIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No bookings found</p>
              {searchTerm && (
                <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filter</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function EventBookingsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ThemeWrapper>
      <EventBookingsContent params={params} />
    </ThemeWrapper>
  );
}