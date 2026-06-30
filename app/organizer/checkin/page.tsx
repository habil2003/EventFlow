"use client";

import { Suspense, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ModernQrScanner from "@/components/ModernQrScanner";
import {
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  CameraIcon,
  TicketIcon,
  InformationCircleIcon,
  ClipboardDocumentIcon,
  BeakerIcon,
  XMarkIcon,
  MoonIcon,
  SunIcon,
} from "@heroicons/react/24/outline";

// ============================================
// TYPES
// ============================================

interface Event {
  id: string;
  title: string;
  eventDate: string;
  eventTime: string;
  location: string;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  user: {
    name: string;
    email: string;
  };
  ticketTier: {
    name: string;
  };
  checkedIn: boolean;
}

interface CheckinResponse {
  success: boolean;
  message: string;
  remainingTickets?: number;
  attendee?: {
    name: string;
    email: string;
    ticketName: string;
    ticketNumber: string;
    quantity: number;
  };
  alreadyCheckedIn?: boolean;
  checkedInAt?: string;
  isLastTicket?: boolean;
  ticketEventId?: string;
  selectedEventId?: string;
  ticketEventTitle?: string;
  paymentStatus?: string;
}

interface MessageState {
  text: string;
  type: "success" | "error" | "warning" | "info";
  remainingTickets?: number;
}

// ============================================
// MAIN COMPONENT
// ============================================

function CheckinContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ============================================
  // STATE
  // ============================================

  // Theme
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Events
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [loading, setLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // Check-in
  const [checkingIn, setCheckingIn] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [totalTickets, setTotalTickets] = useState(0);
  const [recentCheckIns, setRecentCheckIns] = useState<any[]>([]);
  const [lastScanResult, setLastScanResult] = useState<{ data: string; time: string } | null>(null);

  // Manual Check-in
  const [manualInput, setManualInput] = useState("");
  const [manualInputType, setManualInputType] = useState<"email" | "ticketNumber">("ticketNumber");
  const [uncheckedTickets, setUncheckedTickets] = useState<Ticket[]>([]);
  const [showTicketList, setShowTicketList] = useState(false);

  // Test Mode
  const [testMode, setTestMode] = useState(false);
  const [testQRData, setTestQRData] = useState("");

  // Refs
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // THEME MANAGEMENT
  // ============================================

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
    setMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  }, [theme]);

  // ============================================
  // AUTHENTICATION
  // ============================================

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (session && session.user?.role !== "ORGANIZER") {
      router.push("/");
    }
  }, [status, session, router]);

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    };
  }, []);

  // ============================================
  // FETCH EVENTS
  // ============================================

  useEffect(() => {
    const fetchEvents = async () => {
      if (status !== "authenticated") return;
      if (session?.user?.role !== "ORGANIZER") return;

      try {
        setEventsError(null);
        const response = await fetch("/api/organizer/events");
        
        if (!response.ok) {
          throw new Error(`Failed to fetch events: ${response.status}`);
        }
        
        const data = await response.json();
        const eventsArray = Array.isArray(data) ? data : [];
        setEvents(eventsArray);

        // Auto-select event from URL or first event
        const eventId = searchParams.get("eventId");
        if (eventId && eventsArray.some((e: Event) => e.id === eventId)) {
          setSelectedEvent(eventId);
        } else if (eventsArray.length > 0) {
          setSelectedEvent(eventsArray[0].id);
        }
      } catch (error) {
        console.error("Error fetching events:", error);
        setEventsError(error instanceof Error ? error.message : "Failed to load events");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [status, session, searchParams]);

  // ============================================
  // FETCH STATS
  // ============================================

  const fetchStats = useCallback(async () => {
    if (!selectedEvent) return;
    try {
      const response = await fetch(`/api/organizer/events/${selectedEvent}/checkin-stats`);
      if (response.ok) {
        const data = await response.json();
        setCheckedInCount(data.checkedInCount || 0);
        setTotalTickets(data.totalTickets || 0);
        setRecentCheckIns(data.recentCheckIns || []);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (!selectedEvent) return;

    fetchStats();
    statsIntervalRef.current = setInterval(fetchStats, 5000);

    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    };
  }, [selectedEvent, fetchStats]);

  // ============================================
  // FETCH UNCHECKED TICKETS
  // ============================================

  const fetchUncheckedTickets = useCallback(async (email: string) => {
    if (!selectedEvent) return;
    try {
      const response = await fetch(
        `/api/organizer/checkin?eventId=${selectedEvent}&email=${encodeURIComponent(email)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setUncheckedTickets(data.tickets || []);
        setShowTicketList(data.tickets && data.tickets.length > 0);
        if (!data.tickets || data.tickets.length === 0) {
          showMessage("No unchecked tickets found for this email", "error");
        }
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch tickets:", errorData);
        showMessage(errorData.error || "Error fetching tickets", "error");
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
      showMessage("Network error. Please try again.", "error");
    }
  }, [selectedEvent]);

  // ============================================
  // MESSAGE HELPER
  // ============================================

  const showMessage = useCallback((
    text: string,
    type: MessageState["type"],
    remainingTickets?: number
  ) => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    setMessage({ text, type, remainingTickets });
    messageTimeoutRef.current = setTimeout(() => {
      setMessage(null);
    }, 5000);
  }, []);

  // ============================================
  // QR CHECK-IN
  // ============================================

  const processQRCheckin = useCallback(async (qrData: string) => {
    console.log("🔍 QR Data received:", qrData.substring(0, 50) + "...");
    console.log("📏 QR Data length:", qrData.length);

    setLastScanResult({
      data: qrData.substring(0, 100) + (qrData.length > 100 ? "..." : ""),
      time: new Date().toLocaleTimeString(),
    });

    if (!selectedEvent) {
      showMessage("Please select an event first", "error");
      return;
    }

    setCheckingIn(true);

    try {
      const response = await fetch("/api/organizer/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEvent,
          qrCode: qrData,
        }),
      });

      const data: CheckinResponse = await response.json();
      console.log("📡 API Response:", data);

      if (data.success) {
        showMessage(data.message, "success", data.remainingTickets);
        await fetchStats();
      } else {
        // Special handling for event mismatch
        if (data.ticketEventTitle) {
          showMessage(
            `❌ This ticket belongs to "${data.ticketEventTitle}". Please select the correct event.`,
            "error"
          );
        } else {
          showMessage(data.message || "Check-in failed", "error");
        }
      }
    } catch (error) {
      console.error("❌ Network error:", error);
      showMessage("Network error. Please check your connection.", "error");
    } finally {
      setCheckingIn(false);
    }
  }, [selectedEvent, showMessage, fetchStats]);

  // ============================================
  // SCAN HANDLERS (STABLE REFERENCES)
  // ============================================

  const handleScanSuccess = useCallback((decodedText: string) => {
    console.log("✅ Scan success, processing:", decodedText.substring(0, 50));
    processQRCheckin(decodedText);
  }, [processQRCheckin]);

  const handleScanError = useCallback((error: string) => {
    console.error("❌ Scanner error:", error);
    showMessage(`Scanner error: ${error}`, "error");
  }, [showMessage]);

  // ============================================
  // MANUAL CHECK-IN HANDLERS
  // ============================================

  const handleManualCheckin = useCallback(async () => {
    if (!selectedEvent || !manualInput) {
      showMessage("Please select an event and enter ticket number or email", "error");
      return;
    }

    if (manualInput.includes('@')) {
      await fetchUncheckedTickets(manualInput);
      return;
    }

    setCheckingIn(true);
    try {
      const response = await fetch("/api/organizer/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEvent,
          ticketNumber: manualInput,
        }),
      });

      const data: CheckinResponse = await response.json();

      if (data.success) {
        showMessage(data.message, "success", data.remainingTickets);
        await fetchStats();
        setManualInput("");
      } else {
        showMessage(data.message || "Check-in failed", "error");
      }
    } catch (error) {
      console.error("Error:", error);
      showMessage("Error processing check-in", "error");
    } finally {
      setCheckingIn(false);
    }
  }, [selectedEvent, manualInput, showMessage, fetchStats, fetchUncheckedTickets]);

  const checkInTicketById = useCallback(async (ticketId: string, ticketNumber: string) => {
    setCheckingIn(true);
    try {
      const response = await fetch("/api/organizer/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEvent,
          ticketId: ticketId,
        }),
      });

      const data: CheckinResponse = await response.json();

      if (data.success) {
        showMessage(`✅ Checked in ticket ${ticketNumber}`, "success", data.remainingTickets);
        await fetchStats();
        setShowTicketList(false);
        setManualInput("");
      } else {
        showMessage(data.message || "Check-in failed", "error");
      }
    } catch (error) {
      console.error("Error:", error);
      showMessage("Error processing check-in", "error");
    } finally {
      setCheckingIn(false);
    }
  }, [selectedEvent, showMessage, fetchStats]);

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const copyTicketId = useCallback((ticketId: string) => {
    navigator.clipboard.writeText(ticketId);
    showMessage("Ticket ID copied!", "success");
  }, [showMessage]);

  const handleTestScan = useCallback(async () => {
    if (!testQRData) {
      showMessage("Please enter QR data to test", "error");
      return;
    }
    await processQRCheckin(testQRData);
  }, [testQRData, processQRCheckin, showMessage]);

  // ============================================
  // ✅ MEMOIZE SCANNER TO PREVENT REMOUNTING
  // ============================================

  const scannerComponent = useMemo(() => (
    <ModernQrScanner
      onScanSuccess={handleScanSuccess}
      onError={handleScanError}
    />
  ), [handleScanSuccess, handleScanError]);

  // ============================================
  // LOADING STATES
  // ============================================

  if (status === "loading" || loading || !mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "ORGANIZER") {
    return null;
  }

  const selectedEventData = events.find((e) => e.id === selectedEvent);
  const checkinPercentage = totalTickets > 0 ? (checkedInCount / totalTickets) * 100 : 0;

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      
      {/* Theme Toggle Button */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "light" ? (
            <MoonIcon className="h-5 w-5 text-gray-600" />
          ) : (
            <SunIcon className="h-5 w-5 text-yellow-400" />
          )}
        </button>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-3 sm:px-4 py-6 sm:py-12 lg:px-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <Link
            href="/organizer/events"
            className="inline-flex items-center text-xs sm:text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeftIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            Back to Events
          </Link>

          <button
            onClick={() => setTestMode(!testMode)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              testMode
                ? "bg-yellow-500 text-white hover:bg-yellow-600"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            <BeakerIcon className="h-3.5 w-3.5" />
            {testMode ? "Test Mode ON" : "Test Mode"}
          </button>
        </div>

        {/* Events Error */}
        {eventsError && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <XCircleIcon className="h-5 w-5" />
              {eventsError}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Retry
            </button>
          </div>
        )}

        {/* Event Selector */}
        <div className="mb-4 sm:mb-6">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
            Select Event
          </label>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full px-3 py-2 sm:px-4 sm:py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm sm:text-base text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {events.length === 0 ? (
              <option value="">No events available</option>
            ) : (
              events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} - {new Date(e.eventDate).toLocaleDateString()}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Message Alert */}
        {message && (
          <div
            className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 rounded-xl p-4 shadow-lg min-w-[320px] max-w-[90%] text-center ${
              message.type === "success"
                ? "bg-green-50 border border-green-200"
                : message.type === "warning"
                ? "bg-yellow-50 border border-yellow-200"
                : message.type === "info"
                ? "bg-blue-50 border border-blue-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              {message.type === "success" ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              ) : message.type === "warning" ? (
                <InformationCircleIcon className="h-5 w-5 text-yellow-600" />
              ) : message.type === "info" ? (
                <InformationCircleIcon className="h-5 w-5 text-blue-600" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p
                  className={`text-sm font-medium ${
                    message.type === "success"
                      ? "text-green-800"
                      : message.type === "warning"
                      ? "text-yellow-800"
                      : message.type === "info"
                      ? "text-blue-800"
                      : "text-red-800"
                  }`}
                >
                  {message.text}
                </p>
                {message.remainingTickets !== undefined && message.remainingTickets > 0 && (
                  <p className="text-xs mt-1 text-gray-600">
                    ⚠️ This user has {message.remainingTickets} more ticket(s) to check in
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedEventData && (
          <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Left Column - Scanner & Manual */}
            <div className="space-y-4 sm:space-y-6 order-2 lg:order-1">
              {/* QR Scanner Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 sm:px-6 py-3 sm:py-4">
                  <h2 className="text-base sm:text-xl font-bold text-white flex items-center">
                    <CameraIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    QR Code Scanner
                  </h2>
                  <p className="text-white/70 text-xs mt-1">
                    Scan individual ticket QR codes
                  </p>
                </div>

                <div className="p-4 sm:p-6">
                  <div className="rounded-lg overflow-hidden bg-gray-900">
                    {/* ✅ Scanner with stable key to prevent remounting */}
                    {scannerComponent}
                  </div>
                  <div className="mt-4 text-center">
                    <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          checkingIn ? "bg-yellow-500 animate-pulse" : "bg-green-500"
                        }`}
                      ></div>
                      {checkingIn
                        ? "Processing..."
                        : "Camera ready - scan each ticket's unique QR code"}
                    </div>
                  </div>

                  {lastScanResult && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-xs text-gray-400 flex items-center justify-between">
                        <span>Last scan: {lastScanResult.time}</span>
                        <span className="font-mono text-[10px] text-gray-500 truncate max-w-[150px]">
                          {lastScanResult.data}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Test Mode Section */}
              {testMode && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl sm:rounded-2xl border-2 border-yellow-300 dark:border-yellow-700 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                      <BeakerIcon className="h-4 w-4" />
                      Test Mode
                    </h3>
                    <button
                      onClick={() => setTestMode(false)}
                      className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-yellow-600 dark:text-yellow-300 mb-3">
                    Paste a QR code value to test check-in without scanning
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testQRData}
                      onChange={(e) => setTestQRData(e.target.value)}
                      placeholder="Paste QR hash or JSON data"
                      className="flex-1 px-3 py-2 text-xs border border-yellow-300 dark:border-yellow-700 rounded-lg bg-white dark:bg-gray-800 font-mono"
                    />
                    <button
                      onClick={handleTestScan}
                      disabled={checkingIn}
                      className="px-4 py-2 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                    >
                      {checkingIn ? "Testing..." : "Test"}
                    </button>
                  </div>
                  <p className="text-[10px] text-yellow-500 dark:text-yellow-400 mt-2">
                    💡 Get QR data from browser console on ticket page
                  </p>
                </div>
              )}

              {/* Manual Check-in */}
              <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
                  Manual Check-in
                </h3>

                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setManualInputType("ticketNumber")}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      manualInputType === "ticketNumber"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    Ticket Number
                  </button>
                  <button
                    onClick={() => setManualInputType("email")}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      manualInputType === "email"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    Email Address
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type={manualInputType === "email" ? "email" : "text"}
                    placeholder={
                      manualInputType === "email"
                        ? "Enter attendee email"
                        : "Enter ticket number (e.g., TKT-xxxxx)"
                    }
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="flex-1 px-3 py-2 sm:px-4 sm:py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white font-mono"
                  />
                  <button
                    onClick={handleManualCheckin}
                    disabled={checkingIn}
                    className="px-4 py-2 sm:px-6 sm:py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {checkingIn
                      ? "Processing..."
                      : manualInputType === "email"
                      ? "Find Tickets"
                      : "Check In"}
                  </button>
                </div>

                {manualInputType === "email" && (
                  <p className="text-xs text-gray-400 mt-2">
                    💡 Enter email to see all unchecked tickets for this user
                  </p>
                )}
                {manualInputType === "ticketNumber" && (
                  <p className="text-xs text-gray-400 mt-2">
                    💡 Enter the unique ticket number found on the ticket
                  </p>
                )}
              </div>

              {/* Unchecked Tickets List */}
              {showTicketList && uncheckedTickets.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-4 sm:px-6 py-3">
                    <h3 className="text-sm font-semibold text-white flex items-center">
                      <TicketIcon className="h-4 w-4 mr-2" />
                      Unchecked Tickets ({uncheckedTickets.length})
                    </h3>
                    <p className="text-white/70 text-xs">
                      Select which ticket to check in
                    </p>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {uncheckedTickets.map((ticket) => (
                      <div key={ticket.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {ticket.user?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            {ticket.ticketNumber}
                          </p>
                          <p className="text-xs text-gray-400">
                            {ticket.ticketTier?.name || "Standard"}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                            ID: {ticket.id.substring(0, 8)}...
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(ticket.ticketNumber);
                              showMessage("Ticket number copied!", "success");
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Copy ticket number"
                          >
                            <ClipboardDocumentIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => copyTicketId(ticket.id)}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Copy ticket ID"
                          >
                            <InformationCircleIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => checkInTicketById(ticket.id, ticket.ticketNumber)}
                            disabled={checkingIn}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Check In
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Stats */}
            <div className="space-y-3 sm:space-y-4 order-1 lg:order-2">
              {/* Event Info */}
              <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
                  {selectedEventData.title}
                </h3>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center">
                    <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    {new Date(selectedEventData.eventDate).toLocaleDateString()} at{" "}
                    {selectedEventData.eventTime}
                  </div>
                  <div className="flex items-center">
                    <MapPinIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    <span className="break-words">{selectedEventData.location}</span>
                  </div>
                </div>
              </div>

              {/* Check-in Progress */}
              <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
                  Check-in Progress
                </h3>
                <div className="flex justify-between mb-1.5 sm:mb-2">
                  <span className="text-2xl sm:text-3xl font-bold text-indigo-600">
                    {checkedInCount}
                  </span>
                  <span className="text-xs sm:text-sm text-gray-500">
                    of {totalTickets} tickets
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${checkinPercentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {Math.round(checkinPercentage)}% completed
                </p>
              </div>

              {/* Recent Check-ins */}
              {recentCheckIns.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
                    Recent Check-ins
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {recentCheckIns.map((checkin) => (
                      <div
                        key={checkin.id}
                        className="flex justify-between items-center text-xs sm:text-sm border-b border-gray-100 dark:border-gray-700 pb-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <UserIcon className="h-3 w-3 text-gray-400" />
                            <span className="text-gray-700 dark:text-gray-300">
                              {checkin.name}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">
                            {checkin.ticketNumber}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(checkin.time).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================
// EXPORT WITH SUSPENSE BOUNDARY
// ============================================

export default function CheckinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            <p className="mt-2 text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      }
    >
      <CheckinContent />
    </Suspense>
  );
}