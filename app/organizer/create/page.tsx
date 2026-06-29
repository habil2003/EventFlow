"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import ImageUpload from "@/components/ImageUpload";
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
  SparklesIcon
} from "@heroicons/react/24/outline";

interface TicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function CreateEventPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [eventImageUrl, setEventImageUrl] = useState<string | null>(null);

  // Event fields - using string for number inputs to prevent leading zero issues
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState<string>("100");

  // Ticket tiers
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([
    { id: crypto.randomUUID(), name: "Early Bird", price: 500, quantity: 100 },
    { id: crypto.randomUUID(), name: "GA", price: 1000, quantity: 500 },
    { id: crypto.randomUUID(), name: "VIP", price: 2500, quantity: 50 },
  ]);

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

  const handleImageUpload = (url: string) => {
    setEventImageUrl(url);
  };

  const handleRemoveImage = () => {
    setEventImageUrl(null);
  };

  const addTicketTier = () => {
    setTicketTiers([
      ...ticketTiers,
      { id: crypto.randomUUID(), name: "New Tier", price: 0, quantity: 0 },
    ]);
  };

  // Fixed: Handle number input for ticket tiers without leading zeros
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!title || !eventDate || !eventTime || !location) {
      setError("Please fill all required fields");
      setLoading(false);
      return;
    }

    const numericCapacity = parseInt(capacity, 10);
    if (isNaN(numericCapacity) || numericCapacity < 1) {
      setError("Please enter a valid capacity (minimum 1)");
      setLoading(false);
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
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/organizer/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          eventDate,
          eventTime,
          location,
          capacity: numericCapacity,
          ticketTiers: validTiers,
          imageUrl: eventImageUrl,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push("/organizer/events");
      } else {
        setError(data.error || "Failed to create event");
      }
    } catch (error) {
      console.error("Error creating event:", error);
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || status === "loading") {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      
      

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <h1 className="text-xl font-bold text-white">Create New Event</h1>
            <p className="text-white/80 text-sm mt-1">Set up your ticketed event</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Event Image Upload - FIXED: No empty space */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Event Image</h2>
              
              <div className="space-y-4">
                {eventImageUrl ? (
                  <div className="relative border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-700/50">
                    <div className="w-full">
                      <img
                        src={eventImageUrl}
                        alt="Event preview"
                        className="w-full h-auto max-h-96 object-contain mx-auto"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-lg"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                    <ImageUpload
                      onUploadComplete={handleImageUpload}
                      onRemove={handleRemoveImage}
                      existingImage={eventImageUrl}
                      label="Upload event image (max 4MB)"
                    />
                  </div>
                )}
                
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Recommended: Landscape images (16:9 ratio) work best. Max size 4MB.
                </p>
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Title *</label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Date *</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Time *</label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location *</label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Capacity *</label>
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
                    <button 
                      type="button" 
                      onClick={() => removeTicketTier(tier.id)} 
                      className="p-1.5 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      disabled={ticketTiers.length === 1}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
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

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-4 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Event...
                </span>
              ) : (
                "Create Event"
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}