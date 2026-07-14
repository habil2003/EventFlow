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
  DocumentTextIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import ImageUpload from "@/components/ImageUpload";
import { useImageCleanup } from "@/hooks/useImageCleanup";

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
  galleryImages: string[];
  eventDate: string;
  eventTime: string;
  location: string;
  capacity: number;
  ticketTiers: TicketTier[];
}

// ✅ Helper for generating unique IDs
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

// ✅ Helper functions for comparison
const areImagesEqual = (a: string | null | undefined, b: string | null | undefined) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.trim() === b.trim();
};

const areArraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
};

export default function EditEventPage() {
  const params = useParams();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Event fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState<string>("");
  
  // Image fields - MULTIPLE IMAGES SUPPORT
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [originalEvent, setOriginalEvent] = useState<EventData | null>(null);

  // Ticket tiers
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);

  // ✅ Image cleanup hook - simplified
  const { orphanedImages, isCleaningUp, cleanupImages } = useImageCleanup({
    mainImage,
    galleryImages,
    isSaved,
  });

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

        setOriginalEvent(data);
        setTitle(data.title);
        setDescription(data.description || "");
        setEventDate(data.eventDate ? new Date(data.eventDate).toISOString().split('T')[0] : "");
        setEventTime(data.eventTime || "");
        setLocation(data.location);
        setCapacity(data.capacity?.toString() || "");
        setMainImage(data.imageUrl);
        setGalleryImages(data.galleryImages || []);

        if (data.ticketTiers) {
          setTicketTiers(data.ticketTiers.map((tier: any) => ({
            id: tier.id,
            name: tier.name,
            price: tier.price,
            quantity: tier.quantity,
            soldCount: tier.soldCount || 0,
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

  // ✅ Image handlers with multi-select support
  const handleMainImageUpload = (result: string | string[]) => {
    if (Array.isArray(result)) {
      if (result.length > 0) {
        setMainImage(result[0]);
      }
    } else {
      setMainImage(result);
    }
  };

  const handleRemoveMainImage = () => {
    setMainImage(null);
  };

  const handleGalleryImageUpload = (result: string | string[]) => {
    if (Array.isArray(result)) {
      setGalleryImages(prev => [...prev, ...result]);
    } else {
      setGalleryImages(prev => [...prev, result]);
    }
  };

  const handleRemoveGalleryImage = (url: string) => {
    setGalleryImages(prev => prev.filter(img => img !== url));
  };

  const setAsMain = (url: string) => {
    if (url === mainImage) return;
    setGalleryImages(prev => prev.filter(img => img !== url));
    if (mainImage) {
      setGalleryImages(prev => [...prev, mainImage!]);
    }
    setMainImage(url);
  };

  // Ticket tier handlers
  const addTicketTier = () => {
    setTicketTiers([
      ...ticketTiers,
      { id: generateId(), name: "New Tier", price: 0, quantity: 0, soldCount: 0 },
    ]);
  };

  const updateTicketTier = (id: string, field: keyof TicketTier, value: string | number) => {
    setTicketTiers(ticketTiers.map(tier => {
      if (tier.id === id) {
        if (field === 'price' || field === 'quantity') {
          let stringValue = value.toString();
          stringValue = stringValue.replace(/^0+/, '');
          
          if (stringValue === '') {
            return { ...tier, [field]: 0 };
          }
          
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
    const tier = ticketTiers.find(t => t.id === id);
    if (tier && tier.soldCount > 0) {
      alert(`Cannot remove "${tier.name}" because ${tier.soldCount} tickets have already been sold.`);
      return;
    }
    setTicketTiers(ticketTiers.filter(tier => tier.id !== id));
  };

  const handleCapacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/^0+/, '');
    
    if (value === '') {
      setCapacity('');
      return;
    }
    
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setCapacity(numValue.toString());
    }
  };

  // ✅ FIXED: Check if any fields have changed with proper comparison
  const hasChanges = () => {
    if (!originalEvent) return false;
    
    return (
      title !== originalEvent.title ||
      description !== (originalEvent.description || "") ||
      eventDate !== (originalEvent.eventDate ? new Date(originalEvent.eventDate).toISOString().split('T')[0] : "") ||
      eventTime !== originalEvent.eventTime ||
      location !== originalEvent.location ||
      capacity !== originalEvent.capacity?.toString() ||
      !areImagesEqual(mainImage, originalEvent.imageUrl) ||
      !areArraysEqual(galleryImages, originalEvent.galleryImages || []) ||
      JSON.stringify(ticketTiers.map(t => ({ ...t, soldCount: undefined }))) !== 
      JSON.stringify(originalEvent.ticketTiers.map(t => ({ ...t, soldCount: undefined })))
    );
  };

  // ✅ Handle cancel - simplified, no cleanup for existing images
  const handleCancel = async () => {
    // Only show confirmation if there are actual changes
    if (hasChanges()) {
      const confirmed = confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
      if (!confirmed) {
        return;
      }
    }
    router.back();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    if (!title || !eventDate || !eventTime || !location) {
      setError("Please fill all required fields");
      setSaving(false);
      return;
    }

    if (!mainImage) {
      setError("Please upload at least one event image");
      setSaving(false);
      return;
    }

    const numericCapacity = parseInt(capacity, 10);
    if (isNaN(numericCapacity) || numericCapacity < 1) {
      setError("Please enter a valid capacity (minimum 1)");
      setSaving(false);
      return;
    }

    // Validate total ticket quantity doesn't exceed capacity
    const totalTickets = ticketTiers.reduce((sum, tier) => sum + tier.quantity, 0);
    if (totalTickets > numericCapacity) {
      setError(`Total tickets (${totalTickets}) exceed event capacity (${numericCapacity})`);
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

    // Check if any tier quantities were reduced below sold count
    const invalidTiers = ticketTiers.filter(t => 
      t.soldCount && t.quantity < t.soldCount
    );
    if (invalidTiers.length > 0) {
      const tierNames = invalidTiers.map(t => t.name).join(", ");
      setError(`Cannot reduce quantity below sold tickets for: ${tierNames}`);
      setSaving(false);
      return;
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
          ticketTiers: validTiers.map(t => ({
            id: t.id,
            name: t.name,
            price: t.price,
            quantity: t.quantity,
          })),
          imageUrl: mainImage,
          galleryImages: galleryImages,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSaved(true);
        setSuccess(true);
        setTimeout(() => {
          router.push(`/events/${eventId}`);
        }, 1500);
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

  // Check if event was found
  if (!originalEvent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12">
            <ExclamationTriangleIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Event Not Found</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">The event you're trying to edit doesn't exist.</p>
            <Link href="/organizer/events" className="mt-6 inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Back to My Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasUnsavedChanges = hasChanges();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

        <div className="mb-8 flex items-center justify-between">
          <Link
            href={`/organizer/events/${eventId}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Event
          </Link>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${hasUnsavedChanges ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {hasUnsavedChanges ? "⚠️ Unsaved changes" : "No changes"}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <h1 className="text-xl font-bold text-white">Edit Event</h1>
            <p className="text-white/80 text-sm mt-1">Update your event details</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">

            {/* Success Message */}
            {success && (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/30 p-4 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-600 dark:text-green-400">✅ Event updated successfully! Redirecting...</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-4 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Event Images - Multi-Select Support */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Event Images</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Main Image */}
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Main Image *
                  </label>
                  {mainImage ? (
                    <div className="relative">
                      <img
                        src={mainImage}
                        alt="Main event image"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveMainImage}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <TrashIcon className="h-3 w-3" />
                      </button>
                      <span className="absolute bottom-1 left-1 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded">
                        Main
                      </span>
                    </div>
                  ) : (
                    <ImageUpload
                      onUploadComplete={handleMainImageUpload}
                      onRemove={handleRemoveMainImage}
                      existingImage={mainImage}
                      label="Upload main image"
                      compact={true}
                    />
                  )}
                </div>

                {/* Gallery Images */}
                <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Gallery Images ({galleryImages.length}/10)
                    </label>
                    <span className="text-xs text-gray-400">
                      {10 - galleryImages.length} slots remaining
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Existing gallery images */}
                    {galleryImages.map((img, index) => (
                      <div key={index} className="relative">
                        <img
                          src={img}
                          alt={`Gallery ${index + 1}`}
                          className={`w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${
                            img === mainImage ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
                          }`}
                          onClick={() => setAsMain(img)}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryImage(img)}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>
                        {img === mainImage ? (
                          <span className="absolute bottom-1 left-1 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded">
                            Main
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAsMain(img)}
                            className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/70 text-white text-xs rounded hover:bg-black/90 transition-colors"
                          >
                            Set as Main
                          </button>
                        )}
                      </div>
                    ))}
                    
                    {/* Multi-select ImageUpload for gallery */}
                    {galleryImages.length < 10 && (
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-2 text-center min-h-[100px] flex items-center justify-center hover:border-indigo-500 transition-colors">
                        <div className="w-full">
                          <ImageUpload
                            onUploadComplete={handleGalleryImageUpload}
                            onRemove={() => {}}
                            existingImage={null}
                            label="Add Images"
                            compact={true}
                            multiple={true}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    📸 Click a gallery image to set it as main. Select multiple images at once (max 10 total).
                  </p>
                </div>
              </div>
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

            {/* ✅ Form Actions with Cancel button */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCleaningUp}
                className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {isCleaningUp ? "Cleaning up..." : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={saving || !hasUnsavedChanges}
                className={`flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                  saving || !hasUnsavedChanges 
                    ? "opacity-50 cursor-not-allowed" 
                    : "hover:shadow-lg"
                }`}
              >
                {saving ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <DocumentTextIcon className="h-5 w-5" />
                    {hasUnsavedChanges ? "Save Changes" : "No Changes to Save"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}