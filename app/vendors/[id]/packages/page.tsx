"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronRightIcon,
  CheckBadgeIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";

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

// Helper to get service emoji
const getServiceEmoji = (serviceType: string): string => {
  const map: Record<string, string> = {
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
  return map[serviceType] || "🏪";
};

// Helper to format description with line breaks
const formatDescription = (text: string) => {
  return text.split("\n").map((line, i) => {
    if (line.trim() === "") return <br key={i} />;
    if (line.startsWith("✦") || line.startsWith("•")) {
      return <div key={i} className="text-gray-600 dark:text-gray-300">{line}</div>;
    }
    if (line.startsWith("✅")) {
      return <div key={i} className="text-gray-600 dark:text-gray-300">{line}</div>;
    }
    return <p key={i} className="text-gray-600 dark:text-gray-300">{line}</p>;
  });
};

function VendorPackagesContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // Get event context from URL
  const eventId = searchParams.get("eventId");
  const eventTitle = searchParams.get("eventTitle");
  const eventDate = searchParams.get("eventDate");
  const guestCount = searchParams.get("guestCount");

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);

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
        const res = await fetch(`/api/vendors/${vendorId}`);
        const data = await res.json();
        setVendor(data);
      } catch (error) {
        console.error("Error fetching vendor:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVendor();
  }, [vendorId]);

  const openPackageModal = (pkg: Package) => {
    setSelectedPackage(pkg);
    setCurrentImageIndex(0);
    setShowModal(true);
    document.body.style.overflow = "hidden";
  };

  const closePackageModal = () => {
    setShowModal(false);
    document.body.style.overflow = "auto";
  };

  // Build the "back to marketplace" URL cleanly
  const buildMarketplaceUrl = () => {
    const url = new URL("/marketplace", window.location.origin);
    if (eventId) url.searchParams.set("eventId", eventId);
    if (eventTitle) url.searchParams.set("eventTitle", eventTitle);
    if (eventDate) url.searchParams.set("eventDate", eventDate);
    if (guestCount) url.searchParams.set("guestCount", guestCount);
    return url.pathname + url.search;
  };

  // Build booking URL
  const buildBookingUrl = (packageId: string) => {
    const url = new URL(`/vendors/${vendorId}/book`, window.location.origin);
    url.searchParams.set("packageId", packageId);
    if (eventId) url.searchParams.set("eventId", eventId);
    if (eventTitle) url.searchParams.set("eventTitle", eventTitle);
    if (eventDate) url.searchParams.set("eventDate", eventDate);
    if (guestCount) url.searchParams.set("guestCount", guestCount);
    return url.pathname + url.search;
  };

  // Get modal images
  const modalImages = selectedPackage
    ? [
        ...(selectedPackage.imageUrl ? [selectedPackage.imageUrl] : []),
        ...(selectedPackage.galleryImages || []),
      ]
    : [];

  // Loading state
  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading packages...</p>
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendor not found</h1>
          <Link href="/marketplace" className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 hover:underline">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* === BACK BUTTON === */}
        <Link
          href={buildMarketplaceUrl()}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors mb-6"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Marketplace
        </Link>

        {/* === VENDOR HEADER === */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 border-2 border-indigo-100 dark:border-indigo-900">
              {vendor.imageUrl ? (
                <img src={vendor.imageUrl} alt={vendor.businessName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">
                  {getServiceEmoji(vendor.serviceType)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                  {vendor.businessName}
                </h1>
                <span className="text-2xl">{getServiceEmoji(vendor.serviceType)}</span>
                {vendor.rating && (
                  <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full text-sm">
                    <StarSolidIcon className="h-4 w-4 text-amber-500" />
                    {vendor.rating}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <MapPinIcon className="h-4 w-4" />
                  {vendor.location}
                </span>
                <span className="flex items-center gap-1">
                  <BuildingOfficeIcon className="h-4 w-4" />
                  {vendor.serviceType.charAt(0).toUpperCase() + vendor.serviceType.slice(1)}
                </span>
              </div>

              {vendor.description && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                  {vendor.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* === PACKAGES GRID === */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Available Packages
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              ({vendor.packages.length})
            </span>
          </h2>
        </div>

        {vendor.packages.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No packages available for this vendor.</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {vendor.packages.map((pkg, index) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -4 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all flex flex-col group"
              >
                {/* Image */}
                <div className="relative h-48 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
                  {pkg.imageUrl ? (
                    <img
                      src={pkg.imageUrl}
                      alt={pkg.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PhotoIcon className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                    </div>
                  )}
                  
                  {/* Badge - Pricing Type */}
                  <span className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                    pkg.pricingType === "per_person"
                      ? "bg-blue-500/80 text-white"
                      : "bg-green-500/80 text-white"
                  }`}>
                    {pkg.pricingType === "per_person" ? (
                      <>
                        <UserGroupIcon className="h-3 w-3" />
                        Per Person
                      </>
                    ) : (
                      <>
                        <CurrencyRupeeIcon className="h-3 w-3" />
                        Fixed
                      </>
                    )}
                  </span>

                  {/* Guest count badge */}
                  {(pkg.minGuests || pkg.maxGuests) && (
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-black/50 backdrop-blur-sm text-white">
                      <UserGroupIcon className="h-3 w-3" />
                      {pkg.minGuests && pkg.maxGuests && `${pkg.minGuests}–${pkg.maxGuests} guests`}
                      {pkg.minGuests && !pkg.maxGuests && `Min ${pkg.minGuests}`}
                      {!pkg.minGuests && pkg.maxGuests && `Max ${pkg.maxGuests}`}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1">
                    {pkg.name}
                  </h3>
                  
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                      NPR {pkg.price.toLocaleString()}
                    </span>
                    {pkg.pricingType === "per_person" && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">/person</span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2 flex-1">
                    {pkg.description.replace(/[✦•✅🎄].*$/g, "").trim() || "Premium package with all inclusions."}
                  </p>

                  {/* Add-ons preview */}
                  {pkg.addOns && pkg.addOns.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {pkg.addOns.slice(0, 2).map((addon) => (
                        <span key={addon.id} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                          +{addon.name}
                        </span>
                      ))}
                      {pkg.addOns.length > 2 && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          +{pkg.addOns.length - 2} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                    <button
                      onClick={() => openPackageModal(pkg)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                    >
                      <EyeIcon className="h-4 w-4" />
                      Details
                    </button>
                    <Link
                      href={buildBookingUrl(pkg.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-md hover:scale-[1.02] transition-all text-sm font-medium"
                    >
                      <ShoppingCartIcon className="h-4 w-4" />
                      Book Now
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* === PACKAGE DETAIL MODAL === */}
      <AnimatePresence>
        {showModal && selectedPackage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={closePackageModal}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="relative max-w-3xl w-full max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* === Modal Header === */}
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center flex-shrink-0 z-10">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedPackage.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      NPR {selectedPackage.price.toLocaleString()}
                      {selectedPackage.pricingType === "per_person" && (
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> / person</span>
                      )}
                    </span>
                    {(selectedPackage.minGuests || selectedPackage.maxGuests) && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        • {selectedPackage.minGuests && selectedPackage.maxGuests 
                          ? `${selectedPackage.minGuests}–${selectedPackage.maxGuests} guests`
                          : selectedPackage.minGuests 
                          ? `Min ${selectedPackage.minGuests} guests`
                          : `Max ${selectedPackage.maxGuests} guests`
                        }
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={closePackageModal}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* === Modal Body (Scrollable) === */}
              <div className="overflow-y-auto flex-1 p-6">
                {/* Gallery */}
                {modalImages.length > 0 && (
                  <div className="mb-6">
                    <div className="relative bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden" style={{ height: '320px' }}>
                      <img
                        src={modalImages[currentImageIndex]}
                        alt="Package"
                        className="w-full h-full object-cover"
                      />
                      {modalImages.length > 1 && (
                        <>
                          <button
                            onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : modalImages.length - 1)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                          >
                            <ChevronLeftIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => setCurrentImageIndex(prev => prev < modalImages.length - 1 ? prev + 1 : 0)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                          >
                            <ChevronRightIcon className="h-5 w-5" />
                          </button>
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {modalImages.map((_, idx) => (
                              <button
                                key={idx}
                                onClick={() => setCurrentImageIndex(idx)}
                                className={`h-1.5 rounded-full transition-all ${
                                  idx === currentImageIndex 
                                    ? 'w-6 bg-white' 
                                    : 'w-1.5 bg-white/50 hover:bg-white/80'
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-gray-500">
                      <span>{currentImageIndex + 1} of {modalImages.length}</span>
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <span>📋</span> Package Details
                  </h4>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {formatDescription(selectedPackage.description)}
                  </div>
                </div>

                {/* Add-ons */}
                {selectedPackage.addOns && selectedPackage.addOns.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <span>✨</span> Available Add-Ons
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedPackage.addOns.map((addon) => (
                        <div
                          key={addon.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600"
                        >
                          <span className="text-sm text-gray-700 dark:text-gray-300">{addon.name}</span>
                          <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                            +NPR {addon.extraPrice.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* === Modal Footer === */}
              <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
                <div className="flex gap-3">
                  <button
                    onClick={closePackageModal}
                    className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    Close
                  </button>
                  <Link
                    href={buildBookingUrl(selectedPackage.id)}
                    onClick={closePackageModal}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all font-medium"
                  >
                    <ShoppingCartIcon className="h-5 w-5" />
                    Select This Package
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VendorPackagesPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <VendorPackagesContent />
    </Suspense>
  );
}