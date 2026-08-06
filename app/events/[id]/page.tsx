"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  TicketIcon,
  UserIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  CreditCardIcon,
  PhotoIcon,
  XMarkIcon,
  PencilIcon,
  BuildingOfficeIcon,
  HeartIcon,
  ShareIcon,
  UsersIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon, StarIcon as StarSolid } from "@heroicons/react/24/solid";

// ✅ ADD: Review component imports
import ReviewList from "@/components/ReviewList";
import ReviewForm from "@/components/ReviewForm";
import RatingStars from "@/components/RatingStars";

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
  galleryImages: string[];
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
  totalTickets: number;
  totalSold: number;
  percentSold: number;
}

// ✅ FIXED CountdownTimer Component - No TypeScript errors
function CountdownTimer({ targetDate, targetTime }: { targetDate: string | Date; targetTime: string }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      let eventDateTime: Date | null = null;

      try {
        // Handle string dates
        if (typeof targetDate === 'string') {
          // Check if the string already contains a time (ISO format)
          if (targetDate.includes('T')) {
            eventDateTime = new Date(targetDate);
          }
          // Check if it's just a date string
          else if (targetDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            if (targetTime) {
              eventDateTime = new Date(`${targetDate}T${targetTime}`);
            }
          }
          // Try other formats
          else {
            eventDateTime = new Date(targetDate);
          }
        }
        // Handle Date objects
        else if (Object.prototype.toString.call(targetDate) === '[object Date]') {
          eventDateTime = new Date(targetDate as Date);
        }

        // If still invalid, try manual parsing
        if (!eventDateTime || isNaN(eventDateTime.getTime())) {
          if (typeof targetDate === 'string') {
            const dateMatch = targetDate.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (dateMatch) {
              const year = parseInt(dateMatch[1]);
              const month = parseInt(dateMatch[2]) - 1;
              const day = parseInt(dateMatch[3]);

              let hours = 0, minutes = 0;
              if (targetTime) {
                const timeParts = targetTime.split(':');
                hours = parseInt(timeParts[0]) || 0;
                minutes = parseInt(timeParts[1]) || 0;
              }

              eventDateTime = new Date(year, month, day, hours, minutes);
            }
          }
        }

        if (!eventDateTime || isNaN(eventDateTime.getTime())) {
          return { days: 0, hours: 0, minutes: 0, seconds: 0 };
        }

        const now = new Date();
        const difference = eventDateTime.getTime() - now.getTime();

        if (difference <= 0) {
          setIsPast(true);
          return { days: 0, hours: 0, minutes: 0, seconds: 0 };
        }

        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        };
      } catch (error) {
        console.error('❌ [Countdown] Error:', error);
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, targetTime]);

  if (isPast) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
        <p className="text-red-600 dark:text-red-400 font-semibold">Event has already passed</p>
      </div>
    );
  }

  const timeUnits = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  return (
    <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
      <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium text-center mb-3">
        ⏰ Event Starts In
      </p>
      <div className="grid grid-cols-4 gap-3">
        {timeUnits.map((unit, index) => (
          <motion.div
            key={unit.label}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            className="text-center"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3">
              <span className="text-2xl sm:text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {String(unit.value).padStart(2, "0")}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{unit.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [event, setEvent] = useState<Event | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [relatedEvents, setRelatedEvents] = useState<Event[]>([]);
  const [reservationMessage, setReservationMessage] = useState<string>("");
  const [reservationType, setReservationType] = useState<"success" | "warning" | "">("");

  // ✅ ADD: Review state variables
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [canReviewEvent, setCanReviewEvent] = useState(false);
  const [hasReviewedEvent, setHasReviewedEvent] = useState(false);
  const [existingEventReview, setExistingEventReview] = useState<{ id: string; rating: number; review: string | null } | null>(null);
  const [eventReviewStats, setEventReviewStats] = useState<{ average: number; total: number } | null>(null);
  const [refreshEventReviews, setRefreshEventReviews] = useState(0);

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
        console.log('📊 [Event] Full data:', data);
        console.log('📊 [Event] Ticket stats:', {
          totalSold: data.totalSold,
          totalTickets: data.totalTickets,
          percentSold: data.percentSold,
        });
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

  // Fetch related events
  useEffect(() => {
    if (!eventId) return;
    const fetchRelated = async () => {
      try {
        const response = await fetch(`/api/events?limit=4&exclude=${eventId}`);
        const data = await response.json();
        setRelatedEvents(data.events || []);
      } catch (error) {
        console.error("Error fetching related events:", error);
      }
    };
    fetchRelated();
  }, [eventId]);

  // ✅ ADD: Check if user can review this event
  useEffect(() => {
    if (!session || !eventId) return;

    const checkEventReviewStatus = async () => {
      try {
        const response = await fetch(`/api/user/tickets/event/${eventId}/review-status`);
        if (response.ok) {
          const data = await response.json();
          setCanReviewEvent(data.canReview);
          setHasReviewedEvent(data.hasReviewed);
          setExistingEventReview(data.existingReview || null);
        }
      } catch (error) {
        console.error("Error checking event review status:", error);
      }
    };

    checkEventReviewStatus();
  }, [session, eventId]);

  // ✅ ADD: Fetch event review stats
  useEffect(() => {
    if (!eventId) return;

    const fetchEventReviewStats = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/ratings?page=1&limit=1`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setEventReviewStats({
              average: data.data.stats.average,
              total: data.data.stats.total,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching event review stats:", error);
      }
    };

    fetchEventReviewStats();
  }, [eventId, refreshEventReviews]);

  // Get all images for gallery
  const getAllImages = () => {
    const images = [];
    if (event?.imageUrl) images.push(event.imageUrl);
    if (event?.galleryImages) images.push(...event.galleryImages);
    return images.filter(Boolean);
  };

  const galleryImages = getAllImages();

  // Check if user is organizer
  const isOrganizer = session?.user?.id === event?.organizer?.id;
  const backUrl = isOrganizer ? "/organizer/events" : "/events";
  const backLabel = isOrganizer ? "Back to My Events" : "Back to Events";

  // Updated handlePurchase function
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
    setReservationMessage("");
    setReservationType("");

    try {
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

      setReservationMessage(orderData.message || "Tickets reserved! Please complete payment.");
      setReservationType("success");

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
        setReservationMessage(paymentData.error || "Payment initiation failed");
        setReservationType("warning");
        alert(paymentData.error || "Payment initiation failed");
      }
    } catch (error) {
      console.error("Error purchasing ticket:", error);
      setReservationMessage("An error occurred. Please try again.");
      setReservationType("warning");
      alert("An error occurred");
    } finally {
      setPurchasing(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = event?.title || "Check out this event!";

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Join me at ${event?.title}!`,
          url,
        });
      } catch (error) {
        console.log("Share cancelled");
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert("Link copied to clipboard!");
      } catch (error) {
        console.error("Error copying link:", error);
      }
    }
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (loading || status === "loading") {
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="space-y-6"
        >
          {/* Header with Navigation */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Link
              href={backUrl}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              {backLabel}
            </Link>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all"
              >
                {isSaved ? (
                  <HeartSolidIcon className="h-5 w-5 text-red-500" />
                ) : (
                  <HeartIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                )}
              </button>

              <button
                onClick={handleShare}
                className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all"
              >
                <ShareIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>

              {isOrganizer && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <PencilIcon className="h-3 w-3 mr-1" />
                  Organizer
                </span>
              )}
            </div>
          </div>

          {/* Main Event Card */}
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Image Gallery */}
            <div className="relative">
              {galleryImages.length > 0 ? (
                <div className="relative w-full bg-gray-100 dark:bg-gray-700">
                  <div className="relative w-full h-[400px] sm:h-[500px]">
                    <img
                      src={galleryImages[currentImageIndex]}
                      alt={`${event.title} - Image ${currentImageIndex + 1}`}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setShowImageModal(true)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  </div>

                  {galleryImages.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                      >
                        <ChevronLeftIcon className="h-6 w-6" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                      >
                        <ChevronRightIcon className="h-6 w-6" />
                      </button>

                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {galleryImages.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentImageIndex(index)}
                            className={`w-2 h-2 rounded-full transition-all ${index === currentImageIndex
                              ? "bg-white w-6"
                              : "bg-white/50 hover:bg-white/80"
                              }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="w-full h-64 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50 flex items-center justify-center">
                  <PhotoIcon className="h-16 w-16 text-blue-400" />
                </div>
              )}
            </div>

            {/* Event Info */}
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                    {event.title}
                  </h1>
                  <div className="flex items-center mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <UserIcon className="h-4 w-4 mr-2 text-indigo-500" />
                    Organized by <span className="font-medium text-gray-700 dark:text-gray-300 ml-1">{event.organizer.name}</span>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2 text-center min-w-[120px]">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tickets Sold</p>
                    <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                      {event.percentSold || 0}%
                    </p>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full mt-1">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000"
                        style={{ width: `${event.percentSold || 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {event.totalSold || 0} of {event.totalTickets || 0} sold
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                  <CalendarIcon className="h-5 w-5 mr-2 text-indigo-500 flex-shrink-0" />
                  <span>{new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                  <ClockIcon className="h-5 w-5 mr-2 text-indigo-500 flex-shrink-0" />
                  <span>{event.eventTime}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                  <MapPinIcon className="h-5 w-5 mr-2 text-indigo-500 flex-shrink-0" />
                  <span className="truncate">{event.location}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                  <UsersIcon className="h-5 w-5 mr-2 text-indigo-500 flex-shrink-0" />
                  <span>{event.totalTickets || 0} tickets</span>
                </div>
              </div>

              <div className="mt-6">
                <CountdownTimer targetDate={event.eventDate} targetTime={event.eventTime} />
              </div>

              <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">About this event</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {event.description || "No description available"}
                </p>
              </div>

              {/* ✅ ADD: Ratings & Reviews Section */}
              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <StarSolid className="h-5 w-5 text-yellow-400" />
                    Event Reviews
                  </h2>
                  {canReviewEvent && !hasReviewedEvent && (
                    <button
                      onClick={() => setShowReviewForm(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:shadow-md transition-all"
                    >
                      <PencilIcon className="h-4 w-4" />
                      Write a Review
                    </button>
                  )}
                  {hasReviewedEvent && (
                    <button
                      onClick={() => setShowReviewForm(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <PencilIcon className="h-4 w-4" />
                      Edit Review
                    </button>
                  )}
                </div>

                {eventReviewStats && eventReviewStats.total > 0 ? (
                  <div className="mb-4 flex items-center gap-4">
                    <RatingStars rating={eventReviewStats.average} size="md" showLabel={true} />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {eventReviewStats.total} {eventReviewStats.total === 1 ? "review" : "reviews"}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    No reviews yet. Be the first to share your experience!
                  </p>
                )}

                <ReviewList
                  eventId={event.id}
                  type="EVENT"
                  limit={3}
                  showStats={false}
                />

                {eventReviewStats && eventReviewStats.total > 3 && (
                  <div className="mt-3 text-center">
                    <Link
                      href={`/events/${event.id}/reviews`}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      View all {eventReviewStats.total} reviews →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Ticket Selection */}
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 sm:p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <TicketIcon className="h-6 w-6 text-indigo-500" />
              Select Tickets
            </h2>

            <div className="grid gap-4">
              {event.ticketTiers?.map((tier, index) => {
                const available = tier.quantity - tier.soldCount;
                const isSelected = selectedTier === tier.id;
                return (
                  <motion.div
                    key={tier.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => available > 0 && setSelectedTier(tier.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-lg"
                      : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600"
                      } ${available === 0 ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{tier.name}</h3>
                        <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                          NPR {tier.price.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm ${available <= 10 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                          {available} {available === 1 ? 'ticket' : 'tickets'} left
                        </span>
                        {available === 0 && (
                          <span className="block text-xs font-semibold text-red-500 mt-1">Sold Out</span>
                        )}
                        {available > 0 && available <= 10 && (
                          <span className="block text-xs font-semibold text-red-500 mt-1">🔥 Almost gone!</span>
                        )}
                      </div>
                      {isSelected && (
                        <div className="flex-shrink-0">
                          <CheckCircleIcon className="h-6 w-6 text-indigo-500" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <AnimatePresence>
              {selectedTicket && availableQuantity > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700"
                >
                  {reservationMessage && (
                    <div className={`mb-4 p-3 rounded-lg ${reservationType === 'success' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'}`}>
                      <div className="flex items-center gap-2">
                        {reservationType === 'success' ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        ) : (
                          <ClockIcon className="h-5 w-5 text-yellow-500" />
                        )}
                        <span>{reservationMessage}</span>
                      </div>
                      {reservationType === 'success' && (
                        <p className="text-xs mt-1 text-green-600 dark:text-green-400">
                          ⏳ You have 10 minutes to complete payment. Your tickets are reserved.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Quantity
                      </label>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xl font-bold"
                        >
                          -
                        </button>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white w-14 text-center">
                          {quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(Math.min(availableQuantity, quantity + 1))}
                          className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xl font-bold"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Max {availableQuantity} tickets</p>
                    </div>

                    <div className="flex flex-col items-end">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        NPR {totalAmount.toLocaleString()}
                      </p>
                    </div>

                    <button
                      onClick={handlePurchase}
                      disabled={purchasing}
                      className="px-8 py-3 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 hover:scale-105 transform"
                    >
                      {purchasing ? (
                        <>
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCardIcon className="h-5 w-5" />
                          Purchase Now
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Related Events */}
          {relatedEvents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                You might also like
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {relatedEvents.map((related, index) => (
                  <motion.div
                    key={related.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link href={`/events/${related.id}`}>
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all hover:scale-105 transform">
                        <div className="h-32 bg-gray-200 dark:bg-gray-700">
                          {related.imageUrl && (
                            <img
                              src={related.imageUrl}
                              alt={related.title}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">
                            {related.title}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {new Date(related.eventDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* Image Modal */}
      {showImageModal && galleryImages.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm" onClick={() => setShowImageModal(false)}>
          <div className="relative max-w-6xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              <XMarkIcon className="h-5 w-5" />
              Close
            </button>
            <img
              src={galleryImages[currentImageIndex]}
              alt={event.title}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
            {galleryImages.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {galleryImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${index === currentImageIndex
                      ? "bg-white w-6"
                      : "bg-white/50 hover:bg-white/80"
                      }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ✅ ADD: Review Form Modal */}
      {showReviewForm && (
        <ReviewForm
          isOpen={showReviewForm}
          onClose={() => {
            setShowReviewForm(false);
            setRefreshEventReviews(prev => prev + 1);
          }}
          onSuccess={() => {
            setRefreshEventReviews(prev => prev + 1);
            setHasReviewedEvent(true);
          }}
          eventId={event.id}
          eventTitle={event.title}
          type="EVENT"
          existingRating={existingEventReview}
        />
      )}
    </div>
  );
}