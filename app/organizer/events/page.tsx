"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarIcon,
  MapPinIcon,
  TicketIcon,
  EyeIcon,
  PencilIcon,
  QrCodeIcon,
  ChartBarIcon,
  PlusIcon,
  TrashIcon,
  PhotoIcon,
  ClipboardDocumentListIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

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
  isActive?: boolean;
  isCompleted?: boolean;
  completedAt?: string;
  ticketTiers: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    soldCount: number;
  }[];
}

export default function OrganizerEventsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.role !== "ORGANIZER") {
      router.push("/");
    }
  }, [session, router]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("/api/organizer/events");
        const data = await response.json();
        setEvents(data);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteEvent = async (eventId: string) => {
    setActionLoading(eventId);
    try {
      const response = await fetch(`/api/organizer/events/${eventId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setEvents(events.filter(e => e.id !== eventId));
        setShowDeleteModal(null);
        showMessage("Event deleted successfully", "success");
      } else {
        showMessage("Failed to delete event", "error");
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      showMessage("Error deleting event", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (eventId: string, currentStatus: boolean) => {
    setActionLoading(eventId);
    try {
      const response = await fetch(`/api/organizer/events/${eventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response.ok) {
        setEvents(events.map(event =>
          event.id === eventId ? { ...event, isActive: !currentStatus } : event
        ));
        showMessage(`Event ${!currentStatus ? "activated" : "deactivated"}`, "success");
      } else {
        showMessage("Failed to update status", "error");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showMessage("Error updating status", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkComplete = async (eventId: string) => {
    setActionLoading(eventId);
    try {
      const response = await fetch(`/api/organizer/events/${eventId}/complete`, {
        method: "PATCH",
      });

      if (response.ok) {
        showMessage("Event marked as completed! Funds can now be released.", "success");
        const fetchResponse = await fetch("/api/organizer/events");
        const data = await fetchResponse.json();
        setEvents(data);
      } else {
        showMessage("Failed to mark event as completed", "error");
      }
    } catch (error) {
      console.error("Error completing event:", error);
      showMessage("Error completing event", "error");
    } finally {
      setActionLoading(null);
    }
  };

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

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading your events...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ORGANIZER") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">

      {/* Message Alert */}
      {message && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 rounded-xl p-4 shadow-lg min-w-[300px] text-center ${message.type === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <div className="flex items-center justify-center gap-3">
            {message.type === "success" ? (
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
            ) : (
              <XCircleIcon className="h-5 w-5 text-red-600" />
            )}
            <p className={`text-sm font-medium ${message.type === "success" ? "text-green-800" : "text-red-800"}`}>
              {message.text}
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Events</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Manage your events, track sales, and check in attendees
            </p>
          </div>
          <Link
            href="/organizer/create"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:shadow-md transition-all"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Event
          </Link>
        </div>

        {/* Events List */}
        {events.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
            <div className="flex flex-col items-center">
              <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                <CalendarIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">No events yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Create your first event to get started</p>
              <Link
                href="/organizer/create"
                className="mt-4 inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:shadow-md transition-all"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Event
              </Link>
            </div>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-6"
          >
            {events.map((event, idx) => {
              const soldPercentage = event.capacity > 0
                ? (event.totalTicketsSold / event.capacity) * 100
                : 0;

              const formattedRevenue = event.totalRevenue.toLocaleString();
              const isEventActive = event.isActive !== false;
              const isCompleted = event.isCompleted === true;
              const isPast = new Date(event.eventDate) < new Date();

              return (
                <motion.div
                  key={event.id}
                  variants={fadeUp}
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all"
                >
                  {/* Event Image */}
                  <div className="relative w-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
                    {event.imageUrl ? (
                      <div className="w-full">
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="w-full h-auto max-h-64 object-contain mx-auto"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50 flex items-center justify-center">
                        <PhotoIcon className="h-12 w-12 text-blue-400" />
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      {/* Event Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{event.title}</h3>
                          {!isEventActive && !isCompleted && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                              Draft
                            </span>
                          )}
                          {isCompleted && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircleIcon className="h-3 w-3 mr-1" />
                              Completed
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center">
                            <CalendarIcon className="h-4 w-4 mr-1 text-indigo-500" />
                            {new Date(event.eventDate).toLocaleDateString()}
                          </div>
                          <div className="flex items-center">
                            <MapPinIcon className="h-4 w-4 mr-1 text-indigo-500" />
                            {event.location}
                          </div>
                        </div>

                        {/* Ticket Tiers Preview */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {event.ticketTiers.map((tier) => (
                            <span key={tier.id} className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
                              <TicketIcon className="h-3 w-3 mr-1" />
                              {tier.name}: NPR {tier.price.toLocaleString()} ({tier.soldCount}/{tier.quantity} sold)
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-4">
                        <div className="text-center min-w-[80px]">
                          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                            {event.totalTicketsSold}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Tickets Sold</p>
                        </div>
                        <div className="text-center min-w-[100px]">
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            NPR {formattedRevenue}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
                        </div>
                        <div className="text-center min-w-[80px]">
                          <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                            {Math.round(soldPercentage)}%
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Fill Rate</p>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${soldPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* ============================================ */}
                    {/* ACTION BUTTONS WITH CONDITIONAL VISIBILITY */}
                    {/* ============================================ */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      
                      {/* ✅ Dashboard - Always visible */}
                      <Link
                        href={`/organizer/events/${event.id}`}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        Dashboard
                      </Link>
                      
                      {/* ✅ Edit - Always visible but disabled if completed */}
                      <Link
                        href={`/organizer/events/${event.id}/edit`}
                        className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          isCompleted
                            ? "text-gray-400 cursor-not-allowed opacity-50 pointer-events-none"
                            : "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                        }`}
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit
                      </Link>
                      
                      {/* ✅ Bookings - Always visible */}
                      <Link
                        href={`/organizer/events/${event.id}/bookings`}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                      >
                        <ClipboardDocumentListIcon className="h-4 w-4 mr-1" />
                        Bookings ({event.totalTicketsSold || 0})
                      </Link>
                      
                      {/* ❌ Check-in - Hide if completed */}
                      {!isCompleted && (
                        <Link
                          href={`/organizer/checkin?eventId=${event.id}`}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                        >
                          <QrCodeIcon className="h-4 w-4 mr-1" />
                          Check-in
                        </Link>
                      )}
                      
                      {/* ✅ Sales - Always visible */}
                      <Link
                        href={`/organizer/sales?eventId=${event.id}`}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                      >
                        <ChartBarIcon className="h-4 w-4 mr-1" />
                        Sales
                      </Link>
                      
                      {/* ❌ Deactivate - Hide if completed */}
                      {!isCompleted && (
                        <button
                          onClick={() => handleToggleStatus(event.id, isEventActive)}
                          disabled={actionLoading === event.id}
                          className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                            isEventActive
                              ? "text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
                              : "text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30"
                          }`}
                        >
                          {isEventActive ? "Deactivate" : "Activate"}
                        </button>
                      )}
                      
                      {/* ❌ Delete - Hide if completed */}
                      {!isCompleted && (
                        <button
                          onClick={() => setShowDeleteModal(event.id)}
                          disabled={actionLoading === event.id}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          Delete
                        </button>
                      )}
                      
                      {/* ❌ Mark Completed - Hide if completed, show only for active, past events */}
                      {!isCompleted && isPast && isEventActive && (
                        <button
                          onClick={() => handleMarkComplete(event.id)}
                          disabled={actionLoading === event.id}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                        >
                          <FlagIcon className="h-4 w-4 mr-1" />
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-md mx-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Event?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              This action cannot be undone. This event and all its tickets will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteEvent(showDeleteModal)}
                disabled={actionLoading === showDeleteModal}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === showDeleteModal ? "Deleting..." : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}