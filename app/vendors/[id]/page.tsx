"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MapPinIcon,
  StarIcon,
  ArrowLeftIcon,
  BuildingOfficeIcon,
  PencilIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

import ReviewList from "@/components/ReviewList";
import ReviewForm from "@/components/ReviewForm";
import RatingStars from "@/components/RatingStars";

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
  serviceTypeLabel?: string;
  serviceTypeEmoji?: string;
  location: string;
  description: string;
  imageUrl: string | null;
  galleryImages: string[];
  rating?: number;
  packages: Package[];
}

// ✅ Component that uses useSearchParams()
function VendorDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const existingEventId = searchParams.get("eventId");
  const existingEventTitle = searchParams.get("eventTitle");
  const existingEventDate = searchParams.get("eventDate");
  const existingGuestCount = searchParams.get("guestCount");

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [existingReview, setExistingReview] = useState<{
    id: string;
    rating: number;
    review: string | null;
  } | null>(null);
  const [reviewStats, setReviewStats] = useState<{
    average: number;
    total: number;
  } | null>(null);
  const [refreshReviews, setRefreshReviews] = useState(0);

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

  // ✅ Check if user can review
  useEffect(() => {
    if (!session || !vendorId) return;

    const checkReviewStatus = async () => {
      try {
        // Check if user has a completed booking with this vendor
        const response = await fetch(
          `/api/user/bookings/vendor/${vendorId}/review-status`,
        );
        if (response.ok) {
          const data = await response.json();
          setCanReview(data.canReview);
          setHasReviewed(data.hasReviewed);
          setExistingReview(data.existingReview || null);
        }
      } catch (error) {
        console.error("Error checking review status:", error);
      }
    };

    checkReviewStatus();
  }, [session, vendorId]);

  // ✅ Fetch review stats
  useEffect(() => {
    if (!vendorId) return;

    const fetchReviewStats = async () => {
      try {
        const response = await fetch(
          `/api/vendors/${vendorId}/ratings?page=1&limit=1`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setReviewStats({
              average: data.data.stats.average,
              total: data.data.stats.total,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching review stats:", error);
      }
    };

    fetchReviewStats();
  }, [vendorId, refreshReviews]);

  // ✅ Build the package-browsing page link (carries marketplace event context)
  const buildPackagesUrl = () => {
    const query = new URLSearchParams();
    if (existingEventId) query.set("eventId", existingEventId);
    if (existingEventTitle)
      query.set("eventTitle", encodeURIComponent(existingEventTitle));
    if (existingEventDate) query.set("eventDate", existingEventDate);
    if (existingGuestCount) query.set("guestCount", existingGuestCount);
    const qs = query.toString();
    return `/vendors/${vendorId}/packages${qs ? `?${qs}` : ""}`;
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">
            Loading vendor details...
          </p>
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Vendor not found
          </h1>
          <Link
            href="/marketplace"
            className="mt-4 inline-block text-indigo-600 dark:text-indigo-400"
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="space-y-6"
        >
          <Link
            href={`/marketplace?eventId=${existingEventId || ""}&eventTitle=${encodeURIComponent(existingEventTitle || "")}&eventDate=${existingEventDate || ""}&guestCount=${existingGuestCount || ""}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Marketplace
          </Link>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="relative w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
              {vendor.imageUrl ? (
                <div className="relative w-full">
                  <img
                    src={vendor.imageUrl}
                    alt={vendor.businessName}
                    className="w-full h-auto max-h-96 object-contain mx-auto bg-gray-50 dark:bg-gray-800"
                  />
                </div>
              ) : (
                <div className="w-full h-64 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center">
                  <BuildingOfficeIcon className="h-16 w-16 text-indigo-400" />
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-5xl">
                  {vendor.serviceTypeEmoji || getServiceIcon(vendor.serviceType)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {vendor.businessName}
                  </h1>
                  <div className="flex items-center gap-3 mt-1 text-gray-500 dark:text-gray-400">
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
                </div>
              </div>

              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                About
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {vendor.description ||
                  "Professional service provider for your special events."}
              </p>
            </div>
          </div>

          <div
            id="reviews"
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 scroll-mt-24"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                ⭐ Reviews & Ratings
              </h2>
              {canReview && !hasReviewed && (
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:shadow-md transition-all"
                >
                  <PencilIcon className="h-4 w-4" />
                  Write a Review
                </button>
              )}
              {hasReviewed && (
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <PencilIcon className="h-4 w-4" />
                  Edit Review
                </button>
              )}
            </div>

            {reviewStats && reviewStats.total > 0 ? (
              <div className="mb-4 flex items-center gap-4">
                <RatingStars
                  rating={reviewStats.average}
                  size="lg"
                  showLabel={true}
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {reviewStats.total}{" "}
                  {reviewStats.total === 1 ? "review" : "reviews"}
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                No reviews yet. Be the first to share your experience!
              </p>
            )}

            <ReviewList
              vendorId={vendor.id}
              type="VENDOR"
              limit={3}
              showStats={false}
            />

            {reviewStats && reviewStats.total > 3 && (
              <div className="mt-3 text-center">
                <Link
                  href={`/vendors/${vendor.id}/reviews`}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  View all {reviewStats.total} reviews →
                </Link>
              </div>
            )}
          </div>

          {/* Review Form Modal */}
          {showReviewForm && (
            <ReviewForm
              isOpen={showReviewForm}
              onClose={() => {
                setShowReviewForm(false);
                setRefreshReviews((prev) => prev + 1);
              }}
              onSuccess={() => {
                setRefreshReviews((prev) => prev + 1);
                setHasReviewed(true);
              }}
              vendorId={vendor.id}
              vendorName={vendor.businessName}
              type="VENDOR"
              existingRating={existingReview}
            />
          )}

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Packages & Pricing
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {vendor.packages.length > 0
                  ? `${vendor.packages.length} ${vendor.packages.length === 1 ? "package" : "packages"} available — view details and book securely.`
                  : "No packages available for this vendor yet."}
              </p>
            </div>
            {vendor.packages.length > 0 && (
              <Link
                href={buildPackagesUrl()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-lg hover:shadow-md transition-all flex-shrink-0"
              >
                Browse Packages & Book
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

// ✅ Main export with Suspense boundary
export default function VendorDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            <p className="mt-2 text-sm text-gray-500">
              Loading vendor details...
            </p>
          </div>
        </div>
      }
    >
      <VendorDetailContent />
    </Suspense>
  );
}
