"use client";

import React, { useRef, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  CubeIcon,
  PlusIcon, 
  CalendarIcon, 
  CurrencyRupeeIcon,
  SparklesIcon,
  MoonIcon,
  SunIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
  TrashIcon,
  PhotoIcon,
  MapPinIcon
} from "@heroicons/react/24/outline";

// ✅ Helper: Get emoji icon for service type
const getServiceTypeIcon = (type: string) => {
  const icons: Record<string, string> = {
    venue: '🏛️',
    catering: '🍽️',
    photography: '📸',
    decoration: '🎨',
    makeup: '💄',
    dj: '🎧',
  };
  return icons[type] || '🏪';
};

// ✅ Helper: Format service type for display
const formatServiceType = (type: string) => {
  const labels: Record<string, string> = {
    venue: 'Venue',
    catering: 'Catering',
    photography: 'Photography',
    decoration: 'Decoration',
    makeup: 'Makeup Artist',
    dj: 'DJ / Music',
  };
  return labels[type] || type;
};

export default function VendorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch vendor profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/vendor/profile");
        if (res.ok) {
          const data = await res.json();
          setVendorProfile(data);
          setProfileImage(data.imageUrl);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };
    if (session) {
      fetchProfile();
    }
  }, [session]);

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        const response = await fetch("/api/vendor/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: base64String }),
        });
        
        if (response.ok) {
          setProfileImage(base64String);
        } else {
          console.error("Failed to update profile image");
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading image:", error);
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    setUpdating(true);
    try {
      await fetch("/api/vendor/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: null }),
      });
      setProfileImage(null);
    } catch (error) {
      console.error("Error removing image:", error);
    } finally {
      setUpdating(false);
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

  if (!mounted || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user?.role !== "VENDOR") {
    return null;
  }

  const navItems = [
    { name: "My Packages", href: "/vendor/packages", icon: CubeIcon, color: "from-blue-500 to-blue-600", description: "View your service packages" },
    { name: "Add Package", href: "/vendor/setup", icon: PlusIcon, color: "from-green-500 to-green-600", description: "Create a new package" },
    { name: "Bookings", href: "/vendor/bookings", icon: CalendarIcon, color: "from-purple-500 to-purple-600", description: "Manage incoming bookings" },
    { name: "Payouts", href: "/vendor/payouts", icon: CurrencyRupeeIcon, color: "from-indigo-500 to-indigo-600", description: "View payment history" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      
      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Welcome Section */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mb-12 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-3 py-1 text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-4"
          >
            <SparklesIcon className="mr-1 h-4 w-4" />
            Vendor Dashboard
          </motion.div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              {session.user?.name}
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-500 dark:text-gray-400 sm:text-lg">
            Manage your packages, track bookings, and receive payments
          </p>
        </motion.div>

        {/* ✅ Business Profile Section with Service Type Display */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Business Profile</h2>
          
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Profile Image */}
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex-shrink-0 border-2 border-indigo-200 dark:border-indigo-800">
                {profileImage ? (
                  <img 
                    src={profileImage} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <BuildingOfficeIcon className="h-12 w-12" />
                  </div>
                )}
              </div>
              
              {/* Remove button if image exists */}
              {profileImage && (
                <button
                  onClick={handleRemoveImage}
                  disabled={updating}
                  className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md disabled:opacity-50"
                >
                  <TrashIcon className="h-3 w-3" />
                </button>
              )}
            </div>
            
            <div className="flex-1">
              {/* ✅ ADD: Business Name */}
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {vendorProfile?.businessName || "Business Name"}
              </p>
              
              {/* ✅ ADD: Service Type Badge */}
              {vendorProfile?.serviceType && (
                <div className="mt-1 inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-3 py-1 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  {getServiceTypeIcon(vendorProfile.serviceType)} {formatServiceType(vendorProfile.serviceType)}
                </div>
              )}
              
              {/* ✅ ADD: Location */}
              {vendorProfile?.location && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <MapPinIcon className="h-4 w-4" />
                  {vendorProfile.location}
                </p>
              )}
              
              {/* ✅ ADD: Description */}
              {vendorProfile?.description && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  {vendorProfile.description}
                </p>
              )}
              
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                Your business details will appear in the marketplace
              </p>
              
              {/* Custom upload button */}
              <div className="space-y-3 mt-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg cursor-pointer hover:shadow-md transition-all">
                  <PhotoIcon className="h-4 w-4" />
                  {profileImage ? "Change Logo" : "Upload Logo"}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                    className="hidden"
                  />
                </label>
                
                {uploading && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">
                    <span className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-indigo-600 border-t-transparent mr-1"></span>
                    Uploading...
                  </p>
                )}
                
                {updating && !uploading && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    <CheckCircleIcon className="inline h-3 w-3 mr-1" />
                    Updated successfully!
                  </p>
                )}
                
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Recommended: Square image (1:1 ratio), max 2MB. PNG or JPG.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Authentication Status Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-800 shadow-sm"
        >
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="rounded-full bg-green-100 dark:bg-green-800 p-2">
                  <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-green-800 dark:text-green-300">Authentication Verified</h2>
                  <p className="text-sm text-green-700 dark:text-green-400">You are logged in as Vendor</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-800 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-300">
                {session.user?.role}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-white/50 dark:bg-gray-800/50 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{session.user?.name}</p>
              </div>
              <div className="rounded-lg bg-white/50 dark:bg-gray-800/50 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{session.user?.email}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Quick Actions</h2>
            {/* ✅ ADD: Service Type Badge in header */}
            {vendorProfile?.serviceType && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {getServiceTypeIcon(vendorProfile.serviceType)} {formatServiceType(vendorProfile.serviceType)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {navItems.map((item, idx) => (
              <motion.div
                key={idx}
                variants={fadeUp}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Link
                  href={item.href}
                  className="group relative block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 transition-all hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className={`rounded-lg bg-gradient-to-br ${item.color} p-2.5 shadow-md`}>
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <motion.div
                      initial={{ x: -10, opacity: 0 }}
                      whileHover={{ x: 0, opacity: 1 }}
                    >
                      <ArrowRightIcon className="h-4 w-4 text-gray-400 dark:text-gray-600" />
                    </motion.div>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-800 dark:text-gray-200">{item.name}</h3>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{item.description}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Platform Overview Cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="mt-12"
        >
          <h2 className="mb-6 text-center text-xl font-bold text-gray-800 dark:text-gray-200">
            Grow Your Business
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            
            <motion.div
              variants={fadeUp}
              whileHover={{ y: -5, scale: 1.01 }}
              className="group rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-md border border-gray-100 dark:border-gray-700 transition-all hover:shadow-xl"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-md">
                <CubeIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">📦 Service Packages</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Create and manage your service packages with tiered pricing.
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  "Silver, Gold, Platinum packages",
                  "Add optional add-ons",
                  "Set custom pricing",
                  "Activate/Deactivate packages"
                ].map((item, i) => (
                  <li key={i} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <CheckCircleIcon className="mr-2 h-4 w-4 text-green-500 dark:text-green-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              variants={fadeUp}
              whileHover={{ y: -5, scale: 1.01 }}
              className="group rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-md border border-gray-100 dark:border-gray-700 transition-all hover:shadow-xl"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-md">
                <CurrencyRupeeIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">💰 Secure Payments</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Receive payments securely with escrow protection.
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  "Escrow payment protection",
                  "Automated payouts",
                  "Payment tracking dashboard",
                  "Dispute resolution"
                ].map((item, i) => (
                  <li key={i} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <CheckCircleIcon className="mr-2 h-4 w-4 text-green-500 dark:text-green-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 border-t border-gray-200 dark:border-gray-700 pt-8 text-center"
        >
          <p className="text-xs text-gray-400 dark:text-gray-500">
            EventFlow — Nepal's Complete Event Management Solution
          </p>
          <p className="mt-1 text-xs text-gray-300 dark:text-gray-600">
            © 2026 Fusion IT Solutions. All rights reserved.
          </p>
        </motion.footer>
      </main>
    </div>
  );
}