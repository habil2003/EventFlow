"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  StarIcon,
  FunnelIcon,
  BuildingOfficeIcon,
  SparklesIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";

interface Package {
  id: string;
  name: string;
  price: number;
  pricingType?: string;
}

interface Vendor {
  id: string;
  businessName: string;
  serviceType: string;
  serviceTypeLabel?: string;
  serviceTypeEmoji?: string;
  location: string;
  description: string;
  imageUrl: string | null;
  rating?: number;
  reviewCount?: number;  // ← ADDED
  priceRange?: string;
  packages?: Package[];
  minPrice?: number;
  pricingType?: string;
}

// ✅ Normalize location for display
const normalizeLocation = (location: string): string => {
  if (!location) return '';
  return location
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// ✅ Extract city name from full address
const extractCity = (location: string): string => {
  if (!location) return '';
  const parts = location.split(',').map(s => s.trim());
  return parts[0] || location;
};

// ✅ Get unique, normalized cities
const getUniqueCities = (vendors: Vendor[]): string[] => {
  const cities = vendors
    .map(v => extractCity(normalizeLocation(v.location)))
    .filter(Boolean);
  return [...new Set(cities)].sort();
};

function MarketplaceContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  const searchParams = useSearchParams();
  const existingEventId = searchParams.get("eventId");
  const existingEventTitle = searchParams.get("eventTitle");
  const existingEventDate = searchParams.get("eventDate");
  const existingGuestCount = searchParams.get("guestCount");

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedService, setSelectedService] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");
  // ✅ ADD: Sort state
  const [sortBy, setSortBy] = useState<"newest" | "rating" | "price_low" | "price_high">("newest");

  const serviceTypes = [
    "all",
    ...new Set(vendors.map(v => v.serviceType).filter(Boolean))
  ];

  const cities = getUniqueCities(vendors);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const response = await fetch("/api/vendors");
        const data = await response.json();
        
        const processedVendors = data.map((vendor: Vendor) => {
          let minPrice = null;
          let pricingType = null;
          
          if (vendor.packages && vendor.packages.length > 0) {
            const cheapestPackage = vendor.packages.reduce((min: Package, pkg: Package) => 
              pkg.price < min.price ? pkg : min, vendor.packages[0]
            );
            minPrice = cheapestPackage.price;
            pricingType = cheapestPackage.pricingType || "fixed";
          }
          
          return {
            ...vendor,
            minPrice,
            pricingType
          };
        });
        
        setVendors(processedVendors);
        setFilteredVendors(processedVendors);
      } catch (error) {
        console.error("Error fetching vendors:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVendors();
  }, []);

  // ✅ UPDATED: Filter and sort vendors
  useEffect(() => {
    let filtered = [...vendors];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(vendor =>
        vendor.businessName.toLowerCase().includes(term) ||
        vendor.description?.toLowerCase().includes(term) ||
        vendor.serviceType.toLowerCase().includes(term) ||
        vendor.location.toLowerCase().includes(term)
      );
    }

    if (selectedService !== "all") {
      filtered = filtered.filter(vendor => vendor.serviceType === selectedService);
    }

    if (selectedLocation !== "all") {
      filtered = filtered.filter(vendor => 
        extractCity(vendor.location).toLowerCase() === selectedLocation.toLowerCase()
      );
    }

    // ✅ ADD: Sorting
    switch (sortBy) {
      case "rating":
        filtered = filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "price_low":
        filtered = filtered.sort((a, b) => (a.minPrice || 0) - (b.minPrice || 0));
        break;
      case "price_high":
        filtered = filtered.sort((a, b) => (b.minPrice || 0) - (a.minPrice || 0));
        break;
      case "newest":
      default:
        // Keep original order
        break;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilteredVendors(filtered);
  }, [searchTerm, selectedService, selectedLocation, vendors, sortBy]);

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

  if (!mounted || status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400"></div>
          <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">Loading vendors...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-3 py-1 text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-4"
          >
            <SparklesIcon className="mr-1 h-4 w-4" />
            Find Trusted Vendors
          </motion.div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Vendor Marketplace
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-500 dark:text-gray-400">
            Discover and book the best vendors for your special events
          </p>
        </motion.div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-xl mx-auto">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search vendors by name, service, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Filters + Sort */}
        <div className="flex flex-wrap gap-4 mb-8 justify-center items-center">
          {/* Service Type Filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-4 w-4 text-gray-400" />
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              {serviceTypes.map(service => (
                <option key={service} value={service}>
                  {service === "all" ? "All Services" : service.charAt(0).toUpperCase() + service.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-4 w-4 text-gray-400" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="all">All Locations</option>
              {cities.map(city => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* ✅ ADD: Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "rating" | "price_low" | "price_high")}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="newest">Newest</option>
              <option value="rating">Highest Rated</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
          </div>

          {/* Show count */}
          <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center">
            <span>{vendors.length} vendors available</span>
          </div>
        </div>

        {/* Results Count */}
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          Showing {filteredVendors.length} of {vendors.length} vendors
        </p>

        {filteredVendors.length === 0 ? (
          <div className="text-center py-12">
            <BuildingOfficeIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No vendors found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredVendors.map((vendor, idx) => (
              <motion.div
                key={vendor.id}
                variants={fadeUp}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="h-full"
              >
                <Link
                  href={`/vendors/${vendor.id}/packages?eventId=${existingEventId || ''}&eventTitle=${encodeURIComponent(existingEventTitle || '')}&eventDate=${existingEventDate || ''}&guestCount=${existingGuestCount || ''}`}
                  className="block h-full"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all h-full flex flex-col">
                    
                    <div className="relative w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
                      {vendor.imageUrl ? (
                        <div className="relative w-full">
                          <img
                            src={vendor.imageUrl}
                            alt={vendor.businessName}
                            className="w-full h-auto max-h-48 object-contain mx-auto bg-gray-100 dark:bg-gray-800"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-48 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center">
                          <BuildingOfficeIcon className="h-16 w-16 text-indigo-400" />
                        </div>
                      )}

                      {/* ✅ ADD: Top Rated Badge */}
                      {vendor.rating && vendor.rating >= 4.5 && vendor.reviewCount && vendor.reviewCount >= 3 && (
                        <div className="absolute top-2 right-2 z-10">
                          <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md flex items-center gap-0.5">
                            <StarIcon className="h-3 w-3 fill-current" />
                            Top Rated
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-3xl">
                          {vendor.serviceTypeEmoji || getServiceIcon(vendor.serviceType)}
                        </div>
                        {/* ✅ IMPROVED: Rating Display with Stars */}
                        <div className="flex items-center gap-1">
                          {vendor.rating ? (
                            <div className="flex items-center gap-1">
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <StarIcon
                                    key={star}
                                    className={`h-3.5 w-3.5 ${
                                      star <= Math.round(vendor.rating || 0)
                                        ? "text-yellow-400 fill-current"
                                        : "text-gray-300 dark:text-gray-600"
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {vendor.rating.toFixed(1)}
                              </span>
                              {vendor.reviewCount !== undefined && vendor.reviewCount > 0 && (
                                <span className="text-xs text-gray-400">
                                  ({vendor.reviewCount})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">New vendor</span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">
                        {vendor.businessName}
                      </h3>

                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2">
                        <MapPinIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{vendor.location}</span>
                      </div>

                      {vendor.minPrice && (
                        <div className="mb-3">
                          <div className="flex items-center gap-1">
                            <BanknotesIcon className="h-4 w-4 text-indigo-500" />
                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                              From NPR {vendor.minPrice.toLocaleString()}
                            </span>
                            {vendor.pricingType === "per_person" && (
                              <span className="text-xs text-gray-500">/person</span>
                            )}
                          </div>
                          {vendor.pricingType === "per_person" && (
                            <p className="text-xs text-gray-400 mt-1">
                              Price per person • × guest count
                            </p>
                          )}
                        </div>
                      )}

                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 flex-1">
                        {vendor.description || "Professional service provider for your special events."}
                      </p>

                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-indigo-600 dark:text-indigo-400 text-sm font-medium inline-flex items-center group">
                          View Packages
                          <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

// ✅ Main export with Suspense boundary
export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400"></div>
          <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">
            Loading marketplace...
          </p>
        </div>
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  );
}