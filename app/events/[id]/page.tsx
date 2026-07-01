"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  TicketIcon,
  UserIcon,
  CheckCircleIcon,
  MoonIcon,
  SunIcon,
  ArrowLeftIcon,
  CreditCardIcon,
  PhotoIcon,
  XMarkIcon,
  PencilIcon,
  BuildingOfficeIcon,
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
  capacity: number;
  organizer: {
    id: string;
    name: string;
    email: string;
  };
  ticketTiers: TicketTier[];
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

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

  // Get event ID from params
  useEffect(() => {
    const getId = async () => {
      const resolvedParams = await params;
      setEventId(resolvedParams.id as string);
    };
    getId();
  }, [params]);

  // Fetch event data
  useEffect(() => {
    if (!eventId) return;

    const fetchEvent = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/events/${eventId}`);
        const data = await response.json();
        setEvent(data);
        if (data.ticketTiers?.length > 0) {
          setSelectedTier(data.ticketTiers[0].id);
        }
      } catch (error) {
        console.error("Error fetching event:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [eventId]);

  // ✅ Check if current user is the organizer of this event
  const isOrganizer = session?.user?.id === event?.organizer?.id;

  // ✅ Determine the correct back URL
  const backUrl = isOrganizer ? "/organizer/events" : "/events";
  const backLabel = isOrganizer ? "Back to My Events" : "Back to Events";

  const handlePurchase = async () => {
    if (!session) {
      router.push("/login");
      return;
    }

    if (!selectedTier) {
      alert("Please select a ticket type");
      return;
    }

    setPurchasing(true);
    try {
      // Step 1: Create ticket order
      const orderResponse = await fetch("/api/tickets/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event?.id,
          tierId: selectedTier,
          quantity,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        alert(orderData.error || "Failed to create order");
        setPurchasing(false);
        return;
      }

      // Step 2: Initiate payment
      const paymentResponse = await fetch("/api/tickets/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId: orderData.paymentIntentId,
          returnUrl: `${window.location.origin}/api/tickets/payment-callback`,
        }),
      });

      const paymentData = await paymentResponse.json();

      if (paymentResponse.ok && paymentData.payment_url) {
        window.location.href = paymentData.payment_url;
      } else {
        alert(paymentData.error || "Payment initiation failed");
      }
    } catch (error) {
      console.error("Error purchasing ticket:", error);
      alert("An error occurred");
    } finally {
      setPurchasing(false);
    }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (!mounted || status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Event not found</h1>
          <Link href="/events" className="mt-4 inline-block text-indigo-600 dark:text-indigo-400">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const selectedTicket = event.ticketTiers?.find(t => t.id === selectedTier);
  const availableQuantity = selectedTicket ? selectedTicket.quantity - selectedTicket.soldCount : 0;
  const totalAmount = selectedTicket ? selectedTicket.price * quantity : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="space-y-6"
        >
          {/* ✅ Smart Back Button + Organizer Badge */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Link
              href={backUrl}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              {backLabel}
            </Link>

            {isOrganizer && (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <PencilIcon className="h-3 w-3 mr-1" />
                  Organizer
                </span>
                <Link
                  href={`/organizer/events/${event.id}`}
                  className="text-xs text-indigo-600 hover:underline dark:text-indigo-400 flex items-center gap-1"
                >
                  <BuildingOfficeIcon className="h-3 w-3" />
                  Dashboard →
                </Link>
              </div>
            )}
          </div>

          {/* Event Header with Image */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            {event.imageUrl ? (
              <div className="relative w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
                <div className="relative w-full cursor-pointer" onClick={() => setShowImageModal(true)}>
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="w-full h-auto max-h-96 object-contain mx-auto bg-gray-100 dark:bg-gray-800"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                </div>
              </div>
            ) : (
              <div className="w-full h-64 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50 flex items-center justify-center">
                <PhotoIcon className="h-16 w-16 text-blue-400" />
              </div>
            )}

            <div className="p-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{event.title}</h1>
              <div className="flex flex-wrap gap-4 mt-3 text-gray-500 dark:text-gray-400">
                <div className="flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-2 text-indigo-500" />
                  {new Date(event.eventDate).toLocaleDateString()}
                </div>
                <div className="flex items-center">
                  <ClockIcon className="h-5 w-5 mr-2 text-indigo-500" />
                  {event.eventTime}
                </div>
                <div className="flex items-center">
                  <MapPinIcon className="h-5 w-5 mr-2 text-indigo-500" />
                  {event.location}
                </div>
              </div>

              <div className="mt-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">About this event</h2>
                <p className="text-gray-600 dark:text-gray-400">{event.description || "No description available"}</p>

                <div className="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <UserIcon className="h-4 w-4 mr-2 text-indigo-500" />
                  Organized by {event.organizer.name}
                </div>
              </div>
            </div>
          </div>

          {/* Ticket Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Select Tickets</h2>

            <div className="space-y-4">
              {event.ticketTiers?.map((tier) => {
                const available = tier.quantity - tier.soldCount;
                const isSelected = selectedTier === tier.id;
                return (
                  <div
                    key={tier.id}
                    onClick={() => available > 0 && setSelectedTier(tier.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                        : "border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                      } ${available === 0 ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{tier.name}</h3>
                        <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                          NPR {tier.price.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {available} available
                        </span>
                        {available === 0 && (
                          <span className="block text-xs text-red-500 mt-1">Sold Out</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedTicket && availableQuantity > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Quantity
                    </label>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        -
                      </button>
                      <span className="text-lg font-semibold text-gray-900 dark:text-white w-12 text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity(Math.min(availableQuantity, quantity + 1))}
                        className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Max {availableQuantity} tickets</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      NPR {totalAmount.toLocaleString()}
                    </p>
                  </div>

                  <button
                    onClick={handlePurchase}
                    disabled={purchasing}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {purchasing ? (
                      <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCardIcon className="h-5 w-5" />
                        Purchase Tickets
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </main>

      {/* Image Modal */}
      {showImageModal && event.imageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => setShowImageModal(false)}>
          <div className="relative max-w-5xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              <XMarkIcon className="h-5 w-5" />
              Close
            </button>
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}