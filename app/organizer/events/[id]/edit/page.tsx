"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  TicketIcon,
  PlusIcon,
  TrashIcon,
  MoonIcon,
  SunIcon,
  ArrowLeftIcon,
  SparklesIcon,
  PhotoIcon,
  DocumentTextIcon
} from "@heroicons/react/24/outline";

interface TicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  soldCount: number;
}

interface EventData {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  eventDate: string;
  eventTime: string;
  location: string;
  capacity: number;
  ticketTiers: TicketTier[];
}

export default function EditEventPage() {
  const params = useParams();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [eventImage, setEventImage] = useState<File | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Event fields - using string for number inputs to prevent leading zero issues
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState<string>("100");
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  // Ticket tiers
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);

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
      try {
        const response = await fetch(`/api/events/${eventId}`);
        const data = await response.json();

        setTitle(data.title);
        setDescription(data.description || "");
        setEventDate(data.eventDate.split('T')[0]);
        setEventTime(data.eventTime);
        setLocation(data.location);
        setCapacity(data.capacity.toString()); // Convert to string
        setExistingImageUrl(data.imageUrl);

        if (data.ticketTiers) {
          setTicketTiers(data.ticketTiers.map((tier: any) => ({
            id: tier.id,
            name: tier.name,
            price: tier.price,
            quantity: tier.quantity,
            soldCount: tier.soldCount,
          })));
        }
      } catch (error) {
        console.error("Error fetching event:", error);
        setError("Failed to load event");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [eventId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEventImage(file);
      setRemoveExistingImage(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setEventImage(null);
    setPreviewImage(null);
    setRemoveExistingImage(true);
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const addTicketTier = () => {
    setTicketTiers([
      ...ticketTiers,
      { id: crypto.randomUUID(), name: "New Tier", price: 0, quantity: 0, soldCount: 0 },
    ]);
  };

  // Fixed: Handle number input for ticket tiers without leading zeros
  const updateTicketTier = (id: string, field: keyof TicketTier, value: string | number) => {
    setTicketTiers(ticketTiers.map(tier => {
      if (tier.id === id) {
        if (field === 'price' || field === 'quantity') {
          // Handle as number field
          let stringValue = value.toString();
          // Remove leading zeros
          stringValue = stringValue.replace(/^0+/, '');

          // Handle empty value
          if (stringValue === '') {
            return { ...tier, [field]: 0 };
          }

          // Parse to number
          const numValue = parseInt(stringValue, 10);
          if (!isNaN(numValue)) {
            return { ...tier, [field]: numValue };
          }
          return tier;
        }
        return { ...tier, [field]: value };
      }
      return tier;
    }));
  };

  const removeTicketTier = (id: string) => {
    setTicketTiers(ticketTiers.filter(tier => tier.id !== id));
  };

  // Fixed: Handle capacity input without leading zeros
  const handleCapacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Remove leading zeros
    value = value.replace(/^0+/, '');

    // Allow empty string
    if (value === '') {
      setCapacity('');
      return;
    }

    // Only allow numbers
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setCapacity(numValue.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (!title || !eventDate || !eventTime || !location) {
      setError("Please fill all required fields");
      setSaving(false);
      return;
    }

    // Validate capacity
    const numericCapacity = parseInt(capacity, 10);
    if (isNaN(numericCapacity) || numericCapacity < 1) {
      setError("Please enter a valid capacity (minimum 1)");
      setSaving(false);
      return;
    }

    const validTiers = ticketTiers.filter(t => {
      const isValidName = t.name && t.name.trim() !== "";
      const isValidPrice = t.price > 0;
      const isValidQuantity = t.quantity > 0;
      return isValidName && isValidPrice && isValidQuantity;
    });

    if (validTiers.length === 0) {
      setError("Please add at least one valid ticket tier with name, price > 0, and quantity > 0");
      setSaving(false);
      return;
    }

    let imageUrl = existingImageUrl;
    if (removeExistingImage) {
      imageUrl = null;
    }
    if (eventImage) {
      imageUrl = await convertToBase64(eventImage);
    }

    try {
      const response = await fetch(`/api/organizer/events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          eventDate,
          eventTime,
          location,
          capacity: numericCapacity,
          ticketTiers: validTiers,
          imageUrl,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push("/organizer/events");
      } else {
        setError(data.error || "Failed to update event");
      }
    } catch (error) {
      console.error("Error updating event:", error);
      setError("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted || status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  if (session?.user?.role !== "ORGANIZER") {
    router.push("/");
    return null;
  }

  const displayImage = previewImage || (existingImageUrl && !removeExistingImage ? existingImageUrl : null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

        <div className="mb-8">
          <Link
            href="/organizer/events"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to My Events
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <h1 className="text-xl font-bold text-white">Edit Event</h1>
            <p className="text-white/80 text-sm mt-1">Update your event details</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Event Image</h2>

              {displayImage ? (
                <div className="relative border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-700/50">
                  {/* Fixed: Auto-adjusting height, no empty space */}
                  <div className="w-full">
                    <img
                      src={displayImage}
                      alt="Event preview"
                      className="w-full h-auto max-h-96 object-contain mx-auto"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-2 bg-red-600 rounded-full hover:bg-red-700 transition-colors shadow-lg"
                  >
                    <TrashIcon className="h-4 w-4 text-white" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative cursor-pointer group"
                >
                  <div className="w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center hover:border-indigo-500 transition-colors bg-gray-50 dark:bg-gray-700/50">
                    <PhotoIcon className="h-12 w-12 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Click to upload event image</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB (Recommended: 16:9 ratio)</p>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />

              {displayImage && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Image preview shows full photo without cropping. For best results, use a 16:9 landscape image.
                </p>
              )}
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  placeholder="Enter event title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Describe your event..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Event Time *
                  </label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location *
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  placeholder="Venue name, city, or online link"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Total Capacity *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={capacity}
                  onChange={handleCapacityChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter total capacity"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum number of attendees for this event</p>
              </div>
            </div>

            {/* Ticket Tiers */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Ticket Tiers</h2>
                <button
                  type="button"
                  onClick={addTicketTier}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Tier
                </button>
              </div>

              <div className="space-y-3">
                {ticketTiers.map((tier) => (
                  <div key={tier.id} className="flex flex-wrap gap-3 items-end p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ticket Name *</label>
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => updateTicketTier(tier.id, "name", e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g., Early Bird, VIP, Regular"
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Price (NPR) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={tier.price === 0 ? '' : tier.price}
                        onChange={(e) => updateTicketTier(tier.id, "price", e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Price"
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Quantity *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={tier.quantity === 0 ? '' : tier.quantity}
                        onChange={(e) => updateTicketTier(tier.id, "quantity", e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Quantity"
                      />
                    </div>
                    {tier.soldCount === 0 ? (
                      <button
                        type="button"
                        onClick={() => removeTicketTier(tier.id)}
                        className="p-1.5 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        disabled={ticketTiers.length === 1}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    ) : (
                      <div className="p-1.5 text-gray-400" title="Cannot delete tier with existing sales">
                        <TrashIcon className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {ticketTiers.length === 0 && (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-gray-500 dark:text-gray-400">No ticket tiers added yet</p>
                  <button
                    type="button"
                    onClick={addTicketTier}
                    className="mt-2 inline-flex items-center text-indigo-600 hover:text-indigo-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add your first ticket tier
                  </button>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-4 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Saving Changes...
                </>
              ) : (
                <>
                  <DocumentTextIcon className="h-5 w-5" />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}