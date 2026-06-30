"use client";

import { Suspense, useEffect, useState } from "react";
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

// ✅ Component that uses useSearchParams()
function SalesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
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

  // The rest of your component (all the JSX) goes here...
  // I'm truncating for brevity but you should copy all your existing JSX
  // from your original file starting from the return statement
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      {/* ... your existing JSX ... */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* ... all your existing content ... */}
      </main>
    </div>
  );
}

// ✅ Main export with Suspense boundary
export default function SalesPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400"></div>
          <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">
            Loading sales data...
          </p>
        </div>
      </div>
    }>
      <SalesContent />
    </Suspense>
  );
}