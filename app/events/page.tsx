"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  CalendarIcon, 
  MapPinIcon, 
  ClockIcon, 
  TicketIcon,
  SparklesIcon,
  ArrowRightIcon,
  MoonIcon,
  SunIcon,
  PhotoIcon
} from "@heroicons/react/24/outline";

interface TicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  soldCount: number;
}

interface Event {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  eventDate: string;
  eventTime: string;
  location: string;
  ticketTiers: TicketTier[];
}

export default function EventsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // Theme management
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
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

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("/api/events");
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

  if (!mounted || status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      
      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Upcoming Events</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Discover concerts, workshops, and cultural programs
          </p>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
            <div className="flex flex-col items-center">
              <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                <CalendarIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">No events available at the moment.</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Check back later for new events!</p>
            </div>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {events.map((event, idx) => {
              const minPrice = event.ticketTiers?.length > 0 
                ? Math.min(...event.ticketTiers.map(t => t.price))
                : 0;
              return (
                <motion.div
                  key={event.id}
                  variants={fadeUp}
                  whileHover={{ y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Link href={`/events/${event.id}`}>
                    <div className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all cursor-pointer h-full flex flex-col">
                      
                      {/* Event Image - FIXED: No more truncation */}
                      <div className="relative w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
                        {event.imageUrl ? (
                          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}> {/* 16:9 aspect ratio */}
                            <img 
                              src={event.imageUrl} 
                              alt={event.title}
                              className="absolute inset-0 w-full h-full object-contain bg-gray-100 dark:bg-gray-800 transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                              onError={(e) => {
                                // If image fails to load, show fallback
                                (e.target as HTMLImageElement).style.display = 'none';
                                const parent = (e.target as HTMLImageElement).parentElement;
                                if (parent && parent.parentElement) {
                                  const fallback = parent.parentElement.querySelector('.fallback-image');
                                  if (fallback) fallback.classList.remove('hidden');
                                }
                              }}
                            />
                          </div>
                        ) : null}
                        
                        {/* Fallback when no image or image fails to load */}
                        <div className={`w-full h-48 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50 flex items-center justify-center ${event.imageUrl ? 'fallback-image hidden' : ''}`}>
                          <PhotoIcon className="h-12 w-12 text-blue-400" />
                        </div>
                      </div>
                      
                      <div className="p-5 flex-1 flex flex-col">
                        {/* Event Title */}
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 line-clamp-1">
                          {event.title}
                        </h3>
                        
                        {/* Event Description */}
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                          {event.description || "No description available"}
                        </p>
                        
                        {/* Event Details */}
                        <div className="space-y-2 mb-4 flex-1">
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <CalendarIcon className="h-4 w-4 mr-2 text-indigo-500 flex-shrink-0" />
                            <span className="truncate">{new Date(event.eventDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <ClockIcon className="h-4 w-4 mr-2 text-indigo-500 flex-shrink-0" />
                            <span>{event.eventTime}</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <MapPinIcon className="h-4 w-4 mr-2 text-indigo-500 flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        </div>

                        {/* Ticket Info & CTA */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center text-sm">
                            <TicketIcon className="h-4 w-4 mr-1 text-indigo-500 flex-shrink-0" />
                            <span className="text-indigo-600 dark:text-indigo-400 font-medium truncate">
                              From NPR {minPrice.toLocaleString()}
                            </span>
                          </div>
                          <span className="text-indigo-600 dark:text-indigo-400 text-sm font-medium group-hover:translate-x-1 transition-transform inline-flex items-center flex-shrink-0">
                            View Details
                            <ArrowRightIcon className="ml-1 h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>
    </div>
  );
}