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
  MoonIcon,
  SunIcon,
  SparklesIcon,
  CurrencyRupeeIcon,
  UserGroupIcon
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
  location: string;
  description: string;
  imageUrl: string | null;
  rating?: number;
  priceRange?: string;
  packages?: Package[];
  minPrice?: number;
  pricingType?: string;
}

// ✅ Component that uses useSearchParams()
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

  const serviceTypes = [
    "all",
    "venue",
    "catering",
    "photography",
    "decoration",
    "makeup",
    "dj",
    "transport",
    "invitation",
    "fashion",
    "gifts"
  ];

  const locations = [
    "all",
    "Kathmandu",
    "Pokhara",
    "Lalitpur",
    "Bhaktapur",
    "Chitwan"
  ];

  useEffect(() => {
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

  useEffect(() => {
    let filtered = [...vendors];

    if (searchTerm) {
      filtered = filtered.filter(vendor =>
        vendor.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedService !== "all") {
      filtered = filtered.filter(vendor => vendor.serviceType === selectedService);
    }

    if (selectedLocation !== "all") {
      filtered = filtered.filter(vendor => vendor.location === selectedLocation);
    }

    setFilteredVendors(filtered);
  }, [searchTerm, selectedService, selectedLocation, vendors]);

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

        <div className="mb-8">
          <div className="relative max-w-xl mx-auto">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search vendors by name or service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-8 justify-center">
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

          <div className="flex items-center gap-2">
            <MapPinIcon className="h-4 w-4 text-gray-400" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              {locations.map(location => (
                <option key={location} value={location}>
                  {location === "all" ? "All Locations" : location}
                </option>
              ))}
            </select>
          </div>
        </div>

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
                    </div>

                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-3xl">
                          {getServiceIcon(vendor.serviceType)}
                        </div>
                        {vendor.rating && (
                          <div className="flex items-center">
                            <StarIcon className="h-4 w-4 text-amber-500 fill-current" />
                            <span className="ml-1 text-sm text-gray-600 dark:text-gray-400">{vendor.rating}</span>
                          </div>
                        )}
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
                            <CurrencyRupeeIcon className="h-4 w-4 text-indigo-500" />
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