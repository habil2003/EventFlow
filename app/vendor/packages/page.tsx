"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  CubeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  CurrencyRupeeIcon,
  CalendarIcon,
  MoonIcon,
  SunIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  PhotoIcon,
  UserGroupIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";

// UPDATED: Package interface with new fields
interface Package {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string | null;
  galleryImages: string[];
  isActive: boolean;
  // NEW FIELDS:
  pricingType?: string;  // "fixed" or "per_person"
  minGuests?: number;
  maxGuests?: number;
  serviceDetails?: any;
  status?: string;
  addOns: {
    id: string;
    name: string;
    extraPrice: number;
    isOptional: boolean;
    pricingType?: string;  // NEW
  }[];
  bookings?: {
    id: string;
    status: string;
  }[];
}

interface VendorProfile {
  id: string;
  businessName: string;
  serviceType: string;
  location: string;
}

export default function VendorPackagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

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

  // Fetch vendor profile and packages
  useEffect(() => {
    const fetchVendorData = async () => {
      try {
        // Get vendor profile
        const vendorRes = await fetch("/api/vendor/profile");
        if (vendorRes.ok) {
          const vendorData = await vendorRes.json();
          setVendor(vendorData);
        }

        // Get packages
        const packagesRes = await fetch("/api/vendor/packages");
        if (packagesRes.ok) {
          const packagesData = await packagesRes.json();
          setPackages(packagesData);
        }
      } catch (error) {
        console.error("Error fetching vendor data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVendorData();
  }, []);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const togglePackageStatus = async (packageId: string, currentStatus: boolean) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/vendor/packages/${packageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response.ok) {
        setPackages(packages.map(pkg => 
          pkg.id === packageId ? { ...pkg, isActive: !currentStatus } : pkg
        ));
        showMessage(`Package ${!currentStatus ? "activated" : "deactivated"}`, "success");
      } else {
        showMessage("Failed to update package status", "error");
      }
    } catch (error) {
      console.error("Error:", error);
      showMessage("Error updating package", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const deletePackage = async (packageId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/vendor/packages/${packageId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setPackages(packages.filter(pkg => pkg.id !== packageId));
        setShowDeleteModal(null);
        showMessage("Package deleted successfully", "success");
      } else {
        showMessage("Failed to delete package", "error");
      }
    } catch (error) {
      console.error("Error:", error);
      showMessage("Error deleting package", "error");
    } finally {
      setActionLoading(false);
    }
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
          <p className="mt-2 text-sm text-gray-500">Loading your packages...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "VENDOR") {
    return null;
  }

  const totalPackages = packages.length;
  const activePackages = packages.filter(p => p.isActive).length;
  const totalBookings = packages.reduce((sum, pkg) => sum + (pkg.bookings?.length || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      
      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Message Alert */}
        {message && (
          <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 rounded-xl p-4 shadow-lg min-w-[300px] text-center ${
            message.type === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
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

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Packages</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Manage your service packages and add-ons
            </p>
          </div>
          <Link
            href="/vendor/setup"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:shadow-md transition-all"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Package
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Packages</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalPackages}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <CubeIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active Packages</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activePackages}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Bookings</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalBookings}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Packages List */}
        {packages.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
            <div className="flex flex-col items-center">
              <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                <CubeIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">No packages yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Create your first service package</p>
              <Link
                href="/vendor/setup"
                className="mt-4 inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:shadow-md transition-all"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Package
              </Link>
            </div>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {packages.map((pkg, idx) => (
              <motion.div
                key={pkg.id}
                variants={fadeUp}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border overflow-hidden transition-all ${
                  pkg.isActive 
                    ? "border-gray-100 dark:border-gray-700" 
                    : "border-gray-200 dark:border-gray-600 opacity-60"
                }`}
              >
                {/* Package Image */}
                {(pkg.imageUrl || (pkg.galleryImages && pkg.galleryImages.length > 0)) ? (
                  <div className="relative w-full bg-gray-100 dark:bg-gray-700">
                    <img 
                      src={pkg.imageUrl || pkg.galleryImages[0]} 
                      alt={pkg.name}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center">
                    <PhotoIcon className="h-12 w-12 text-indigo-400" />
                  </div>
                )}
                
                <div className="p-5">
                  {/* Package Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{pkg.name}</h3>
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                        NPR {pkg.price.toLocaleString()}
                        {pkg.pricingType === "per_person" && (
                          <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">/person</span>
                        )}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      pkg.isActive 
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                        : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                    }`}>
                      {pkg.isActive ? "Active" : "Inactive"}
                    </div>
                  </div>

                  {/* NEW: Pricing Type Badge */}
                  <div className="mb-3">
                    {pkg.pricingType === "per_person" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        <UserGroupIcon className="h-3 w-3" />
                        Per Person Pricing
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        <CurrencyRupeeIcon className="h-3 w-3" />
                        Fixed Price
                      </span>
                    )}
                  </div>

                  {/* NEW: Guest Limits Display */}
                  {(pkg.minGuests || pkg.maxGuests) && (
                    <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                      {pkg.minGuests && pkg.maxGuests && (
                        <span>Guests: {pkg.minGuests} - {pkg.maxGuests}</span>
                      )}
                      {pkg.minGuests && !pkg.maxGuests && (
                        <span>Min Guests: {pkg.minGuests}</span>
                      )}
                      {!pkg.minGuests && pkg.maxGuests && (
                        <span>Max Guests: {pkg.maxGuests}</span>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                    {pkg.description || "No description provided"}
                  </p>

                  {/* Add-ons Preview - UPDATED with pricing type */}
                  {pkg.addOns && pkg.addOns.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Available Add-ons:</p>
                      <div className="flex flex-wrap gap-1">
                        {pkg.addOns.slice(0, 3).map((addon) => (
                          <span key={addon.id} className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
                            + {addon.name}
                            {addon.pricingType === "per_person" && " (per person)"}
                          </span>
                        ))}
                        {pkg.addOns.length > 3 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
                            +{pkg.addOns.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 mb-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-xs">Bookings</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{pkg.bookings?.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs">Status</p>
                      <button
                        onClick={() => togglePackageStatus(pkg.id, pkg.isActive)}
                        disabled={actionLoading}
                        className={`text-xs font-medium ${pkg.isActive ? "text-yellow-600 hover:text-yellow-700" : "text-green-600 hover:text-green-700"}`}
                      >
                        {pkg.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <Link
                      href={`/vendor/packages/${pkg.id}/edit`}
                      className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Edit
                    </Link>
                    <button
                      onClick={() => setShowDeleteModal(pkg.id)}
                      className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-md mx-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Package?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              This action cannot be undone. This package will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deletePackage(showDeleteModal)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}