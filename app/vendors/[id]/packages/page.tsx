"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeftIcon,
  MapPinIcon,
  StarIcon,
  BuildingOfficeIcon,
  CurrencyRupeeIcon,
  UserGroupIcon,
  PhotoIcon,
  EyeIcon,
  ShoppingCartIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from "@heroicons/react/24/outline";

interface AddOn {
  id: string;
  name: string;
  extraPrice: number;
  isOptional: boolean;
  pricingType?: string;
}

interface Package {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string | null;
  galleryImages: string[];
  pricingType?: string;
  minGuests?: number;
  maxGuests?: number;
  addOns: AddOn[];
}

interface Vendor {
  id: string;
  businessName: string;
  serviceType: string;
  location: string;
  description: string;
  imageUrl: string | null;
  galleryImages: string[];
  rating?: number;
  packages: Package[];
}

export default function VendorPackagesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  
  // Manual theme management
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  const existingEventId = searchParams.get("eventId");
  const existingEventTitle = searchParams.get("eventTitle");
  const existingEventDate = searchParams.get("eventDate");
  const existingGuestCount = searchParams.get("guestCount");

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [selectedPackageForModal, setSelectedPackageForModal] = useState<Package | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);

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
    const getId = async () => {
      const resolvedParams = await params;
      setVendorId(resolvedParams.id as string);
    };
    getId();
  }, [params]);

  useEffect(() => {
    if (!vendorId) return;

    const fetchVendor = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/vendors/${vendorId}`);
        const data = await response.json();
        setVendor(data);
      } catch (error) {
        console.error("Error fetching vendor:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVendor();
  }, [vendorId]);

  const getServiceIcon = (serviceType: string) => {
    const icons: Record<string, string> = {
      venue: "🏛️",
      catering: "🍽️",
      photography: "📸",
      decoration: "🎨",
      makeup: "💄",
      dj: "🎧",
      transport: "🚐",
      invitation: "💌",
      fashion: "👗",
      gifts: "🎁",
    };
    return icons[serviceType] || "🏪";
  };

  const openPackageModal = (pkg: Package) => {
    setSelectedPackageForModal(pkg);
    setCurrentImageIndex(0);
    setShowModal(true);
  };

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
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading packages...</p>
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendor not found</h1>
          <Link href="/marketplace" className="mt-4 inline-block text-indigo-600 dark:text-indigo-400">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const modalImages = selectedPackageForModal
    ? [
        ...(selectedPackageForModal.imageUrl ? [selectedPackageForModal.imageUrl] : []),
        ...(selectedPackageForModal.galleryImages || [])
      ]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Back Button */}
        <div className="mb-6">
          <Link
            href={`/marketplace?eventId=${existingEventId || ''}&eventTitle=${encodeURIComponent(existingEventTitle || '')}&eventDate=${existingEventDate || ''}&guestCount=${existingGuestCount || ''}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Marketplace
          </Link>
        </div>

        {/* Vendor Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
              {vendor.imageUrl ? (
                <img src={vendor.imageUrl} alt={vendor.businessName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BuildingOfficeIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{vendor.businessName}</h1>
                <span className="text-3xl">{getServiceIcon(vendor.serviceType)}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center">
                  <MapPinIcon className="h-4 w-4 mr-1" />
                  {vendor.location}
                </div>
                {vendor.rating && (
                  <div className="flex items-center">
                    <StarIcon className="h-4 w-4 mr-1 fill-current text-amber-500" />
                    {vendor.rating}
                  </div>
                )}
              </div>
              <p className="mt-3 text-gray-600 dark:text-gray-300">{vendor.description}</p>
            </div>
          </div>
        </div>

        {/* Packages Grid */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Available Packages</h2>

        {vendor.packages.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No packages available</p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {vendor.packages.map((pkg) => (
              <motion.div
                key={pkg.id}
                variants={fadeUp}
                whileHover={{ y: -5 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all flex flex-col"
              >
                {/* Package Image */}
                <div className="relative h-56 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
                  {pkg.imageUrl ? (
                    <img
                      src={pkg.imageUrl}
                      alt={pkg.name}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PhotoIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                  {/* Pricing Type Badge */}
                  {pkg.pricingType === "per_person" ? (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      <UserGroupIcon className="h-3 w-3" />
                      Per Person
                    </span>
                  ) : (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      <CurrencyRupeeIcon className="h-3 w-3" />
                      Fixed Price
                    </span>
                  )}
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{pkg.name}</h3>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    NPR {pkg.price.toLocaleString()}
                    {pkg.pricingType === "per_person" && <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/person</span>}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">{pkg.description}</p>

                  {(pkg.minGuests || pkg.maxGuests) && (
                    <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                      {pkg.minGuests && pkg.maxGuests && `${pkg.minGuests} - ${pkg.maxGuests} guests`}
                      {pkg.minGuests && !pkg.maxGuests && `Min ${pkg.minGuests} guests`}
                      {!pkg.minGuests && pkg.maxGuests && `Max ${pkg.maxGuests} guests`}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
                    <button
                      onClick={() => openPackageModal(pkg)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                    >
                      <EyeIcon className="h-4 w-4" />
                      View Details
                    </button>
                    <Link
                      href={`/vendors/${vendor.id}/book?packageId=${pkg.id}&eventId=${existingEventId || ''}&eventTitle=${encodeURIComponent(existingEventTitle || '')}&eventDate=${existingEventDate || ''}&guestCount=${existingGuestCount || ''}`}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-md transition-all text-sm font-medium"
                    >
                      <ShoppingCartIcon className="h-4 w-4" />
                      Select
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* Package Details Modal */}
      {showModal && selectedPackageForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="relative max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedPackageForModal.name}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-6">
              {/* Gallery Images */}
              {modalImages.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Gallery</h4>
                  <div className="relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden" style={{ height: '400px' }}>
                    <img
                      src={modalImages[currentImageIndex]}
                      alt="Package"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {modalImages.length > 1 && (
                    <div className="flex justify-between mt-3 gap-2">
                      <button
                        onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : modalImages.length - 1)}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <ChevronLeftIcon className="h-4 w-4" />
                        Previous
                      </button>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {currentImageIndex + 1} / {modalImages.length}
                      </span>
                      <button
                        onClick={() => setCurrentImageIndex(prev => prev < modalImages.length - 1 ? prev + 1 : 0)}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Next
                        <ChevronRightIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
                <p className="text-gray-600 dark:text-gray-300">{selectedPackageForModal.description}</p>
              </div>

              {/* Pricing */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Pricing</h4>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  NPR {selectedPackageForModal.price.toLocaleString()}
                  {selectedPackageForModal.pricingType === "per_person" && <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> per person</span>}
                </p>
              </div>

              {/* Guest Limits */}
              {(selectedPackageForModal.minGuests || selectedPackageForModal.maxGuests) && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Guest Requirements</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {selectedPackageForModal.minGuests && selectedPackageForModal.maxGuests && 
                      `${selectedPackageForModal.minGuests} - ${selectedPackageForModal.maxGuests} guests`}
                    {selectedPackageForModal.minGuests && !selectedPackageForModal.maxGuests && 
                      `Minimum ${selectedPackageForModal.minGuests} guests`}
                    {!selectedPackageForModal.minGuests && selectedPackageForModal.maxGuests && 
                      `Maximum ${selectedPackageForModal.maxGuests} guests`}
                  </p>
                </div>
              )}

              {/* Add-Ons */}
              {selectedPackageForModal.addOns && selectedPackageForModal.addOns.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Available Add-Ons</h4>
                  <div className="space-y-2">
                    {selectedPackageForModal.addOns.map((addon) => (
                      <div key={addon.id} className="flex justify-between text-sm p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <span className="text-gray-700 dark:text-gray-300">{addon.name}</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">+ NPR {addon.extraPrice.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
                <Link
                  href={`/vendors/${vendor.id}/book?packageId=${selectedPackageForModal.id}&eventId=${existingEventId || ''}&eventTitle=${encodeURIComponent(existingEventTitle || '')}&eventDate=${existingEventDate || ''}&guestCount=${existingGuestCount || ''}`}
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-center font-medium hover:shadow-md transition-all"
                >
                  Select This Package
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}