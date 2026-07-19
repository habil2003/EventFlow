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
  ClockIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
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
  isCompleted?: boolean;
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
  checkedInAt?: string | null;
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

  // ✅ Camera State
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isCameraSupported, setIsCameraSupported] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerKey, setScannerKey] = useState(0); // ✅ Used to force re-mount scanner

  // Manual Check-in
  const [manualInput, setManualInput] = useState("");
  const [uncheckedTickets, setUncheckedTickets] = useState<Ticket[]>([]);
  const [showTicketList, setShowTicketList] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [modalMessage, setModalMessage] = useState<MessageState | null>(null);

  // Test Mode
  const [testMode, setTestMode] = useState(false);
  const [testQRData, setTestQRData] = useState("");

  // Refs
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const modalMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
  // CHECK CAMERA SUPPORT
  // ============================================

  useEffect(() => {
    const checkCameraSupport = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(device => device.kind === 'videoinput');
        setIsCameraSupported(hasCamera);
        if (!hasCamera) {
          setCameraError('No camera detected on this device');
          setIsCameraOn(false);
        }
      } catch (error) {
        console.error('Error checking camera support:', error);
        setIsCameraSupported(false);
        setCameraError('Unable to access camera');
        setIsCameraOn(false);
      }
    };
    checkCameraSupport();
  }, []);

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      if (modalMessageTimeoutRef.current) clearTimeout(modalMessageTimeoutRef.current);
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
  // MESSAGE HELPERS
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

  const showModalMessage = useCallback((
    text: string,
    type: MessageState["type"],
    remainingTickets?: number
  ) => {
    if (modalMessageTimeoutRef.current) clearTimeout(modalMessageTimeoutRef.current);
    setModalMessage({ text, type, remainingTickets });
    modalMessageTimeoutRef.current = setTimeout(() => {
      setModalMessage(null);
    }, 3000);
  }, []);

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
  }, [selectedEvent, showMessage]);

  // ============================================
  // QR CHECK-IN
  // ============================================

  const processQRCheckin = useCallback(async (qrData: string) => {
    console.log("🔍 QR Data received:", qrData.substring(0, 50) + "...");

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
        let successMessage = data.message;
        if (data.alreadyCheckedIn) {
          successMessage = `✅ Ticket ${data.attendee?.ticketNumber || ''} was already checked in at ${data.checkedInAt ? new Date(data.checkedInAt).toLocaleTimeString() : 'earlier'}`;
        } else {
          successMessage = `✅ ${data.attendee?.name || 'Attendee'} checked in successfully!`;
        }
        showMessage(successMessage, "success", data.remainingTickets);
        await fetchStats();
        if (showTicketList) {
          setShowTicketList(false);
          setManualInput("");
        }
      } else {
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
  }, [selectedEvent, showMessage, fetchStats, showTicketList]);

  // ============================================
  // OPEN TICKET IN MODAL
  // ============================================

  const openTicketModal = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket);
    setModalMessage(null);
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setSelectedTicket(null);
    setModalMessage(null);
  }, []);

  // ============================================
  // CHECK IN TICKET FROM MODAL
  // ============================================

  const checkInTicketFromModal = useCallback(async (ticketId: string, ticketNumber: string) => {
    if (!selectedEvent) return;

    setCheckingIn(true);
    setModalMessage(null);

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
        let successMessage = data.message;
        if (data.alreadyCheckedIn) {
          successMessage = `✅ Ticket ${ticketNumber} was already checked in at ${data.checkedInAt ? new Date(data.checkedInAt).toLocaleTimeString() : 'earlier'}`;
        } else {
          successMessage = `✅ Ticket ${ticketNumber} checked in successfully!`;
        }
        
        setUncheckedTickets(prev => 
          prev.map(t => 
            t.id === ticketId 
              ? { ...t, checkedIn: true, checkedInAt: new Date().toISOString() }
              : t
          )
        );
        
        setSelectedTicket(prev => 
          prev 
            ? { ...prev, checkedIn: true, checkedInAt: new Date().toISOString() }
            : null
        );
        
        showModalMessage(successMessage, "success", data.remainingTickets);
        await fetchStats();
        
        if (data.isLastTicket) {
          setTimeout(() => {
            closeModal();
            setShowTicketList(false);
            setManualInput("");
          }, 1500);
        }
      } else {
        showModalMessage(data.message || "Check-in failed", "error");
      }
    } catch (error) {
      console.error("Error:", error);
      showModalMessage("Error processing check-in", "error");
    } finally {
      setCheckingIn(false);
    }
  }, [selectedEvent, fetchStats, closeModal, showModalMessage]);

  // ============================================
  // CHECK IN ALL TICKETS FOR A USER
  // ============================================

  const checkInAllTickets = useCallback(async () => {
    if (!selectedEvent || uncheckedTickets.length === 0) return;

    const unchecked = uncheckedTickets.filter(t => !t.checkedIn);
    if (unchecked.length === 0) {
      showModalMessage("All tickets are already checked in!", "info");
      return;
    }

    if (!confirm(`Check in all ${unchecked.length} tickets for this user?`)) {
      return;
    }

    setCheckingIn(true);
    setModalMessage(null);

    try {
      let successCount = 0;
      let alreadyCheckedCount = 0;
      let failCount = 0;

      for (const ticket of unchecked) {
        const response = await fetch("/api/organizer/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: selectedEvent,
            ticketId: ticket.id,
          }),
        });

        const data: CheckinResponse = await response.json();
        if (data.success) {
          if (data.alreadyCheckedIn) {
            alreadyCheckedCount++;
          } else {
            successCount++;
          }
          setUncheckedTickets(prev => 
            prev.map(t => 
              t.id === ticket.id 
                ? { ...t, checkedIn: true, checkedInAt: new Date().toISOString() }
                : t
            )
          );
        } else {
          failCount++;
        }
      }

      await fetchStats();
      
      let messageText = '';
      if (successCount > 0 && alreadyCheckedCount > 0) {
        messageText = `✅ ${successCount} checked in, ${alreadyCheckedCount} already checked in`;
      } else if (successCount > 0) {
        messageText = `✅ ${successCount} tickets checked in successfully!`;
      } else if (alreadyCheckedCount > 0) {
        messageText = `ℹ️ All ${alreadyCheckedCount} tickets were already checked in`;
      } else {
        messageText = `❌ Failed to check in tickets`;
      }
      
      showModalMessage(messageText, successCount > 0 ? "success" : "warning");
      
      if (failCount === 0 && successCount > 0) {
        setTimeout(() => {
          closeModal();
          setShowTicketList(false);
          setManualInput("");
        }, 1500);
      }
    } catch (error) {
      console.error("Error:", error);
      showModalMessage("Error processing check-in", "error");
    } finally {
      setCheckingIn(false);
    }
  }, [selectedEvent, uncheckedTickets, fetchStats, closeModal, showModalMessage]);

  // ============================================
  // SCAN HANDLERS
  // ============================================

  const handleScanSuccess = useCallback((decodedText: string) => {
    console.log("✅ Scan success, processing:", decodedText.substring(0, 50));
    processQRCheckin(decodedText);
  }, [processQRCheckin]);

  const handleScanError = useCallback((error: string) => {
    console.error("❌ Scanner error:", error);
  }, []);

  // ============================================
  // ✅ TOGGLE CAMERA - Resets scanner by changing key
  // ============================================

  const toggleCamera = useCallback(() => {
    setIsCameraOn(prev => {
      const newState = !prev;
      // ✅ If turning on, force scanner re-mount
      if (newState) {
        setScannerKey(prevKey => prevKey + 1);
      }
      return newState;
    });
  }, []);

  // ============================================
  // MANUAL CHECK-IN HANDLER
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
        let successMessage = data.message;
        if (data.alreadyCheckedIn) {
          successMessage = `✅ Ticket ${manualInput} was already checked in at ${data.checkedInAt ? new Date(data.checkedInAt).toLocaleTimeString() : 'earlier'}`;
        } else {
          successMessage = `✅ ${data.attendee?.name || 'Attendee'} checked in successfully!`;
        }
        showMessage(successMessage, "success", data.remainingTickets);
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

  const handleTestScan = useCallback(async () => {
    if (!testQRData) {
      showMessage("Please enter QR data to test", "error");
      return;
    }
    await processQRCheckin(testQRData);
  }, [testQRData, processQRCheckin, showMessage]);

  // ============================================
  // GET SELECTED EVENT DATA
  // ============================================

  const selectedEventData = events.find((e) => e.id === selectedEvent);
  const isEventCompleted = selectedEventData?.isCompleted === true;
  const checkinPercentage = totalTickets > 0 ? (checkedInCount / totalTickets) * 100 : 0;

  // ============================================
  // LOADING STATES
  // ============================================

  if (status === "loading" || loading) {
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

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">

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
                  {e.isCompleted && " (Completed)"}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Event Completed Warning */}
        {isEventCompleted && (
          <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  This event has been marked as completed.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Check-in is not available for completed events.
                </p>
              </div>
            </div>
          </div>
        )}

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
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base sm:text-xl font-bold text-white flex items-center">
                        <CameraIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                        QR Code Scanner
                      </h2>
                      <p className="text-white/70 text-xs mt-1">
                        {isEventCompleted ? "Check-in unavailable" : "Scan individual ticket QR codes"}
                      </p>
                    </div>
                    {/* ✅ Camera Toggle Button */}
                    {!isEventCompleted && isCameraSupported && (
                      <button
                        onClick={toggleCamera}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isCameraOn
                            ? "bg-white/20 text-white hover:bg-white/30"
                            : "bg-red-500/80 text-white hover:bg-red-600"
                        }`}
                      >
                        {isCameraOn ? (
                          <>
                            <VideoCameraIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">On</span>
                          </>
                        ) : (
                          <>
                            <VideoCameraSlashIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Off</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  {isEventCompleted ? (
                    <div className="flex flex-col items-center justify-center h-[350px] bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <CheckCircleIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
                      <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                        Event Completed
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        No check-in available for completed events
                      </p>
                    </div>
                  ) : !isCameraSupported ? (
                    <div className="flex flex-col items-center justify-center h-[350px] bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                      <CameraIcon className="h-12 w-12 text-red-400 mb-3" />
                      <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                        {cameraError || "Camera not available"}
                      </p>
                      <p className="text-xs text-red-500 dark:text-red-300 mt-1">
                        Please check your camera permissions or use manual check-in
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg overflow-hidden bg-gray-900 relative">
                        {isCameraOn ? (
                          // ✅ Use key to force re-mount when toggling on
                          <ModernQrScanner
                            key={scannerKey}
                            onScanSuccess={handleScanSuccess}
                            onError={handleScanError}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-[350px] bg-gray-800 rounded-lg">
                            <VideoCameraSlashIcon className="h-16 w-16 text-gray-500 mb-3" />
                            <p className="text-gray-400 text-sm font-medium">Camera is off</p>
                            <p className="text-xs text-gray-500 mt-1">Click the toggle button to start scanning</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 text-center">
                        <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              checkingIn ? "bg-yellow-500 animate-pulse" : isCameraOn ? "bg-green-500" : "bg-gray-400"
                            }`}
                          ></div>
                          {checkingIn
                            ? "Processing..."
                            : isEventCompleted
                            ? "Check-in disabled"
                            : isCameraOn
                            ? "Camera ready - scan each ticket's unique QR code"
                            : "Camera paused"}
                        </div>
                      </div>
                    </>
                  )}

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
              {!isEventCompleted && testMode && (
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
                </div>
              )}

              {/* Manual Check-in */}
              {!isEventCompleted && (
                <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
                    Manual Check-in
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    💡 Enter ticket number OR email address (auto-detected)
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Enter ticket number or email address"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleManualCheckin()}
                      className="flex-1 px-3 py-2 sm:px-4 sm:py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white font-mono"
                    />
                    <button
                      onClick={handleManualCheckin}
                      disabled={checkingIn}
                      className="px-4 py-2 sm:px-6 sm:py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {checkingIn ? "Processing..." : "Check In / Find"}
                    </button>
                  </div>
                </div>
              )}

              {/* Unchecked Tickets List */}
              {!isEventCompleted && showTicketList && uncheckedTickets.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-4 sm:px-6 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center">
                        <TicketIcon className="h-4 w-4 mr-2" />
                        Unchecked Tickets ({uncheckedTickets.filter(t => !t.checkedIn).length})
                      </h3>
                      <p className="text-white/70 text-xs">
                        Select a ticket to check in or view details
                      </p>
                    </div>
                    {uncheckedTickets.filter(t => !t.checkedIn).length > 1 && (
                      <button
                        onClick={checkInAllTickets}
                        disabled={checkingIn}
                        className="px-3 py-1.5 bg-white text-yellow-600 text-xs font-medium rounded-lg hover:bg-yellow-50 transition-colors disabled:opacity-50"
                      >
                        Check In All
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-64 overflow-y-auto">
                    {uncheckedTickets.map((ticket) => {
                      const isCheckedIn = ticket.checkedIn;
                      return (
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
                            {isCheckedIn && (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                                <CheckCircleIcon className="h-3 w-3" />
                                Already checked in
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openTicketModal(ticket)}
                              className="px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                            >
                              View
                            </button>
                            {!isCheckedIn && (
                              <button
                                onClick={() => checkInTicketFromModal(ticket.id, ticket.ticketNumber)}
                                disabled={checkingIn}
                                className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                Check In
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                  {isEventCompleted && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Completed
                    </span>
                  )}
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
                    {recentCheckIns.map((checkin, index) => (
                      <div
                        key={index}
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

      {/* Ticket Detail Modal */}
      {showModal && selectedTicket && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-90 transition-opacity"
              onClick={closeModal}
            />

            <div className="relative inline-block transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 text-left align-bottom shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Ticket Details</h3>
                  <p className="text-white/70 text-sm">Ticket #{selectedTicket.ticketNumber}</p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-white" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Modal Message */}
                {modalMessage && (
                  <div className={`p-3 rounded-lg ${
                    modalMessage.type === 'success' 
                      ? 'bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                      : modalMessage.type === 'warning'
                      ? 'bg-yellow-50 border border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400'
                      : modalMessage.type === 'info'
                      ? 'bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                      : 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      {modalMessage.type === 'success' ? (
                        <CheckCircleIcon className="h-5 w-5" />
                      ) : modalMessage.type === 'warning' ? (
                        <InformationCircleIcon className="h-5 w-5" />
                      ) : modalMessage.type === 'info' ? (
                        <InformationCircleIcon className="h-5 w-5" />
                      ) : (
                        <XCircleIcon className="h-5 w-5" />
                      )}
                      <span>{modalMessage.text}</span>
                    </div>
                    {modalMessage.remainingTickets !== undefined && modalMessage.remainingTickets > 0 && (
                      <p className="text-xs mt-1 text-gray-600">
                        ⚠️ This user has {modalMessage.remainingTickets} more ticket(s) to check in
                      </p>
                    )}
                  </div>
                )}

                {/* Ticket Details */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Ticket Number</span>
                    <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                      {selectedTicket.ticketNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Customer</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {selectedTicket.user?.name || "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Email</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {selectedTicket.user?.email || "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Ticket Type</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {selectedTicket.ticketTier?.name || "Standard"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-500">Status</span>
                    <span className={`text-sm font-medium ${
                      selectedTicket.checkedIn ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {selectedTicket.checkedIn ? (
                        <span className="flex items-center gap-1">
                          <CheckCircleIcon className="h-4 w-4" />
                          Checked In {selectedTicket.checkedInAt && `at ${new Date(selectedTicket.checkedInAt).toLocaleTimeString()}`}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          Pending
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  {!selectedTicket.checkedIn ? (
                    <button
                      onClick={() => checkInTicketFromModal(selectedTicket.id, selectedTicket.ticketNumber)}
                      disabled={checkingIn}
                      className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {checkingIn ? (
                        <>
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          Checking In...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-5 w-5" />
                          Check In
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex-1 py-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold rounded-lg flex items-center justify-center gap-2">
                      <CheckCircleIcon className="h-5 w-5" />
                      Already Checked In
                    </div>
                  )}
                  <button
                    onClick={closeModal}
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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