"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTheme } from "@/components/ThemeProvider";
import { 
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
  TicketIcon,
  UserGroupIcon,
  CurrencyRupeeIcon,
  ChartBarIcon,
  QrCodeIcon,
  PencilIcon,
  EyeIcon,
  MoonIcon,
  SunIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentListIcon
} from "@heroicons/react/24/outline";

interface Event {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  eventDate: string;
  eventTime: string;
  location: string;
  capacity: number;
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

interface RecentBooking {
  id: string;
  ticketNumber: string;
  user: { name: string; email: string };
  tier: { name: string };
  totalAmount: number;
  createdAt: string;
  checkedIn: boolean;
}

export default function OrganizerEventDetailPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  
  // ✅ React is now imported, so React.use() works
  const unwrappedParams = React.use(params as any);
  const eventId = unwrappedParams.id;
  
  const [event, setEvent] = useState<Event | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "attendees">("overview");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (!eventId) {
      console.error("No event ID provided");
      setLoading(false);
      return;
    }

    console.log("Event ID:", eventId);

    const fetchData = async () => {
      try {
        // Fetch event details
        const eventRes = await fetch(`/api/organizer/events/${eventId}`);
        if (eventRes.ok) {
          const data = await eventRes.json();
          setEvent(data);
        } else {
          console.error("Failed to fetch event:", eventRes.status);
        }

        // Fetch recent bookings
        const bookingsRes = await fetch(`/api/organizer/events/${eventId}/bookings`);
        if (bookingsRes.ok) {
          const data = await bookingsRes.json();
          setRecentBookings(data.slice(0, 10));
        }
      } catch (error) {
        console.error("Error fetching event:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ORGANIZER") {
    router.push("/");
    return null;
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Event not found</h2>
          <p className="text-gray-500 mt-2">Event ID: {eventId || "Not provided"}</p>
          <Link href="/organizer/events" className="mt-4 inline-block text-indigo-600">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const soldPercentage = event.capacity > 0 ? (event.totalTicketsSold / event.capacity) * 100 : 0;
  const checkedInCount = recentBookings
  .filter(b => b.checkedIn)
  .reduce((sum, b) => sum + (b.quantity || 1), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      
      {/* Navigation */}
      

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Back Button */}
        <Link
          href="/organizer/events"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-6 group"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
          Back to Events
        </Link>

        {/* Event Header */}
        <div className="mb-8">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{event.title}</h1>
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
            
            <div className="flex gap-3">
              <Link
                href={`/organizer/events/${event.id}/edit`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit
              </Link>
              <Link
                href={`/events/${event.id}`}
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
              >
                <EyeIcon className="h-4 w-4 mr-2" />
                Public View
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tickets Sold</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{event.totalTicketsSold}</p>
              </div>
              <TicketIcon className="h-8 w-8 text-indigo-500 opacity-50" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">NPR {event.totalRevenue.toLocaleString()}</p>
              </div>
              <CurrencyRupeeIcon className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Check-ins</p>
                <p className="text-2xl font-bold text-purple-600">{checkedInCount} / {event.totalTicketsSold}</p>
              </div>
              <UserGroupIcon className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
            <div className="mt-2">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${event.totalTicketsSold > 0 ? (checkedInCount / event.totalTicketsSold) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Fill Rate</p>
                <p className="text-2xl font-bold text-amber-600">{Math.round(soldPercentage)}%</p>
              </div>
              <ChartBarIcon className="h-8 w-8 text-amber-500 opacity-50" />
            </div>
            <div className="mt-2">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${soldPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "overview"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("attendees")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "attendees"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Recent Attendees
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">About This Event</h2>
                <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {event.description || "No description provided."}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ticket Tiers</h2>
                <div className="space-y-4">
                  {event.ticketTiers.map((tier) => {
                    const tierSoldPercentage = tier.quantity > 0 ? (tier.soldCount / tier.quantity) * 100 : 0;
                    return (
                      <div key={tier.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{tier.name}</span>
                          <span className="text-gray-500">
                            {tier.soldCount} / {tier.quantity} sold
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                            style={{ width: `${tierSoldPercentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">NPR {tier.price.toLocaleString()} per ticket</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <Link
                    href={`/organizer/checkin?eventId=${event.id}`}
                    className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <QrCodeIcon className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">Check-in Attendees</span>
                    </div>
                    <ArrowLeftIcon className="h-4 w-4 text-green-600 rotate-180" />
                  </Link>
                  
                  <Link
                    href={`/organizer/events/${event.id}/bookings`}
                    className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ClipboardDocumentListIcon className="h-5 w-5 text-purple-600" />
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">View All Bookings</span>
                    </div>
                    <ArrowLeftIcon className="h-4 w-4 text-purple-600 rotate-180" />
                  </Link>
                  
                  <Link
                    href={`/organizer/sales?eventId=${event.id}`}
                    className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ChartBarIcon className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Sales Analytics</span>
                    </div>
                    <ArrowLeftIcon className="h-4 w-4 text-blue-600 rotate-180" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Attendees Tab */}
        {activeTab === "attendees" && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Bookings</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Booked On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-6 py-4">
                        <code className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          {booking.ticketNumber || "N/A"}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{booking.user.name}</p>
                          <p className="text-xs text-gray-500">{booking.user.email}</p>
                        </div>
                       </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{booking.tier.name}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        NPR {booking.totalAmount.toLocaleString()}
                       </td>
                      <td className="px-6 py-4">
                        {booking.checkedIn ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircleIcon className="h-3 w-3" />
                            Checked In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            <XCircleIcon className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                       </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(booking.createdAt).toLocaleDateString()}
                       </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {recentBookings.length === 0 && (
              <div className="p-12 text-center">
                <p className="text-gray-500">No bookings yet</p>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-8 flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/organizer/events"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to My Events
          </Link>
          
          <Link
            href={`/organizer/checkin?eventId=${event.id}`}
            className="inline-flex items-center px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <QrCodeIcon className="h-4 w-4 mr-2" />
            Start Check-in
          </Link>
        </div>
      </main>
    </div>
  );
}