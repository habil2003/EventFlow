"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import ImageUpload from "@/components/ImageUpload";
import {
  PlusIcon,
  TrashIcon,
  MoonIcon,
  SunIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";

interface AddOn {
  id: string;
  name: string;
  extraPrice: number;
  isOptional: boolean;
  pricingType: string; // NEW: "fixed" or "per_person"
}

export default function VendorSetupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Package fields
  const [packageName, setPackageName] = useState("");
  const [packagePrice, setPackagePrice] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [packageImageUrl, setPackageImageUrl] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);

  // NEW: Pricing Type
  const [pricingType, setPricingType] = useState<"fixed" | "per_person">("fixed");

  // NEW: Guest Limits
  const [minGuests, setMinGuests] = useState<string>("");
  const [maxGuests, setMaxGuests] = useState<string>("");

  // NEW: Service Details (JSON object)
  const [serviceDetails, setServiceDetails] = useState<any>({});

  // Add-ons
  const [addOns, setAddOns] = useState<AddOn[]>([
    { id: crypto.randomUUID(), name: "", extraPrice: 0, isOptional: true, pricingType: "fixed" }
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session && session.user?.role !== "VENDOR") {
      router.push("/");
    }
  }, [session, router]);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const addAddOn = () => {
    setAddOns([
      ...addOns,
      { id: crypto.randomUUID(), name: "", extraPrice: 0, isOptional: true, pricingType: "fixed" }
    ]);
  };

  const updateAddOn = (id: string, field: keyof AddOn, value: string | number | boolean) => {
    setAddOns(addOns.map(addon =>
      addon.id === id ? { ...addon, [field]: value } : addon
    ));
  };

  const removeAddOn = (id: string) => {
    if (addOns.length === 1) {
      showMessage("You need at least one add-on option", "error");
      return;
    }
    setAddOns(addOns.filter(addon => addon.id !== id));
  };

  const handleImageUpload = (result: string | string[]) => {
    if (Array.isArray(result)) {
      // If multiple images, take the first one
      if (result.length > 0) {
        setPackageImageUrl(result[0]);
      }
    } else {
      setPackageImageUrl(result);
    }
  };

  const handleRemoveImage = () => {
    setPackageImageUrl(null);
  };

  const handleGalleryUpload = (result: string | string[]) => {
    if (Array.isArray(result)) {
      // Multiple images uploaded at once - add all to gallery
      setGalleryImages(prev => [...prev, ...result]);
    } else {
      // Single image uploaded
      setGalleryImages(prev => [...prev, result]);
    }
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImages(galleryImages.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!packageName.trim()) {
      showMessage("Please enter a package name", "error");
      setLoading(false);
      return;
    }

    const price = parseFloat(packagePrice);
    if (isNaN(price) || price <= 0) {
      showMessage("Please enter a valid price", "error");
      setLoading(false);
      return;
    }

    const validAddOns = addOns.filter(a => a.name.trim() !== "");

    try {
      const response = await fetch("/api/vendor/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: packageName,
          price: price,
          description: packageDescription,
          addOns: validAddOns,
          imageUrl: packageImageUrl,
          galleryImages: galleryImages,
          // NEW FIELDS:
          pricingType: pricingType,
          minGuests: minGuests ? parseInt(minGuests) : null,
          maxGuests: maxGuests ? parseInt(maxGuests) : null,
          serviceDetails: serviceDetails,
          status: "active"
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showMessage("Package created successfully!", "success");
        // Reset form
        setPackageName("");
        setPackagePrice("");
        setPackageDescription("");
        setPackageImageUrl(null);
        setGalleryImages([]);
        setPricingType("fixed");
        setMinGuests("");
        setMaxGuests("");
        setServiceDetails({});
        setAddOns([{ id: crypto.randomUUID(), name: "", extraPrice: 0, isOptional: true, pricingType: "fixed" }]);

        setTimeout(() => {
          router.push("/vendor/packages");
        }, 2000);
      } else {
        showMessage(data.error || "Failed to create package", "error");
      }
    } catch (error) {
      console.error("Error creating package:", error);
      showMessage("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "VENDOR") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

        <Link
          href="/vendor/packages"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mb-6"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Packages
        </Link>

        {/* Message Alert */}
        {message && (
          <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 rounded-xl p-4 shadow-lg min-w-[300px] text-center ${message.type === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
            }`}>
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

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <h1 className="text-xl font-bold text-white">Create New Package</h1>
            <p className="text-white/80 text-sm mt-1">Add a new service package for customers</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Featured Image Upload */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Featured Image</h2>
              <ImageUpload
                onUploadComplete={handleImageUpload}
                onRemove={handleRemoveImage}
                existingImage={packageImageUrl}
                label="Upload package image (max 4MB)"
              />
            </div>

            {/* Gallery Images Upload */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Gallery Images</h2>
              </div>

              {/* Existing Gallery Images */}
              {galleryImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {galleryImages.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Gallery ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(index)}
                        className="absolute top-2 right-2 p-1 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <TrashIcon className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <ImageUpload
                onUploadComplete={handleGalleryUpload}
                label="Add to gallery (max 4MB)"
              />
              <p className="text-xs text-gray-400">Upload multiple images to showcase your package</p>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Package Details</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Package Name *
                </label>
                <input
                  type="text"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="e.g., Silver, Gold, Platinum"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* NEW: Pricing Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pricing Type *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${pricingType === "fixed"
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                      : "border-gray-200 dark:border-gray-700"
                    }`}>
                    <input
                      type="radio"
                      value="fixed"
                      checked={pricingType === "fixed"}
                      onChange={() => setPricingType("fixed")}
                      className="h-4 w-4 text-indigo-600"
                    />
                    <div>
                      <div className="font-medium">💰 Fixed Price</div>
                      <div className="text-xs text-gray-500">Same price regardless of guest count</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${pricingType === "per_person"
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                      : "border-gray-200 dark:border-gray-700"
                    }`}>
                    <input
                      type="radio"
                      value="per_person"
                      checked={pricingType === "per_person"}
                      onChange={() => setPricingType("per_person")}
                      className="h-4 w-4 text-indigo-600"
                    />
                    <div>
                      <div className="font-medium">👥 Per Person</div>
                      <div className="text-xs text-gray-500">Price × number of guests</div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price (NPR) *
                </label>
                <input
                  type="number"
                  value={packagePrice}
                  onChange={(e) => setPackagePrice(e.target.value)}
                  placeholder={pricingType === "per_person" ? "e.g., 500 (per person)" : "e.g., 50000"}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                {pricingType === "per_person" && (
                  <p className="text-xs text-gray-400 mt-1">This price will be multiplied by the guest count</p>
                )}
              </div>

              {/* NEW: Guest Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Minimum Guests
                  </label>
                  <input
                    type="number"
                    value={minGuests}
                    onChange={(e) => setMinGuests(e.target.value)}
                    placeholder="e.g., 50"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Maximum Guests
                  </label>
                  <input
                    type="number"
                    value={maxGuests}
                    onChange={(e) => setMaxGuests(e.target.value)}
                    placeholder="e.g., 500"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={packageDescription}
                  onChange={(e) => setPackageDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe what's included in this package..."
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Add-ons Section - UPDATED with pricing type */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add-ons (Optional)</h2>
                <button
                  type="button"
                  onClick={addAddOn}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Add-on
                </button>
              </div>

              <div className="space-y-3">
                {addOns.map((addon) => (
                  <div key={addon.id} className="flex flex-wrap gap-3 items-end p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Add-on Name
                      </label>
                      <input
                        type="text"
                        value={addon.name}
                        onChange={(e) => updateAddOn(addon.id, "name", e.target.value)}
                        placeholder="e.g., Extra hour"
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Extra Price (NPR)
                      </label>
                      <input
                        type="number"
                        value={addon.extraPrice}
                        onChange={(e) => updateAddOn(addon.id, "extraPrice", parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Add-on Pricing
                      </label>
                      <select
                        value={addon.pricingType}
                        onChange={(e) => updateAddOn(addon.id, "pricingType", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      >
                        <option value="fixed">Fixed</option>
                        <option value="per_person">Per Person</option>
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Optional?
                      </label>
                      <select
                        value={addon.isOptional ? "true" : "false"}
                        onChange={(e) => updateAddOn(addon.id, "isOptional", e.target.value === "true")}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAddOn(addon.id)}
                      className="p-1.5 text-red-500 hover:text-red-600 mt-5"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-md transition-all disabled:opacity-50"
            >
              {loading ? "Creating Package..." : "Create Package"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}