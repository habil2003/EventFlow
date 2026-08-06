"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MapPinIcon,
  StarIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  CalendarIcon,
  UserGroupIcon,
  CurrencyRupeeIcon,
  PlusIcon,
  MinusIcon,
  ShoppingCartIcon,
  SparklesIcon,
  BuildingOfficeIcon,
  PhotoIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  PencilIcon,
  ChatBubbleLeftRightIcon,
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const existingEventId = searchParams.get("eventId");
  const existingEventTitle = searchParams.get("eventTitle");
  const existingEventDate = searchParams.get("eventDate");
  const existingGuestCount = searchParams.get("guestCount");

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState("");
  const [guestCount, setGuestCount] = useState(100);
  const [guestCountInput, setGuestCountInput] = useState<string>("100");
  const [eventTitle, setEventTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [selectedPackageImages, setSelectedPackageImages] = useState<string[]>(
    [],
  );
  const [packagesLoaded, setPackagesLoaded] = useState(false);
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
    if (existingEventTitle) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEventTitle(decodeURIComponent(existingEventTitle));
    }
    if (existingEventDate) {
      let formattedDate = existingEventDate;
      if (formattedDate.includes("T")) {
        formattedDate = formattedDate.split("T")[0];
      }
      setEventDate(formattedDate);
    }
    if (existingGuestCount) {
      const guestCountNum = parseInt(existingGuestCount);
      if (!isNaN(guestCountNum) && guestCountNum > 0) {
        setGuestCount(guestCountNum);
        setGuestCountInput(guestCountNum.toString());
      }
    }
  }, [existingEventTitle, existingEventDate, existingGuestCount]);

  useEffect(() => {
    if (!vendorId) return;

    const fetchVendor = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/vendors/${vendorId}`);
        const data = await response.json();
        setVendor(data);
        if (data.packages?.length > 0) {
          setSelectedPackage(data.packages[0].id);
          const firstPkg = data.packages[0];
          const images = [];
          if (firstPkg.imageUrl) images.push(firstPkg.imageUrl);
          if (firstPkg.galleryImages) images.push(...firstPkg.galleryImages);
          setSelectedPackageImages(images);
        }
        setPackagesLoaded(true);
      } catch (error) {
        console.error("Error fetching vendor:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVendor();
  }, [vendorId]);

  useEffect(() => {
    if (vendor && selectedPackage) {
      const pkg = vendor.packages.find((p) => p.id === selectedPackage);
      if (pkg) {
        const images = [];
        if (pkg.imageUrl) images.push(pkg.imageUrl);
        if (pkg.galleryImages) images.push(...pkg.galleryImages);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedPackageImages(images);
        setCurrentImageIndex(0);
      }
    }
  }, [selectedPackage, vendor]);

  useEffect(() => {
    if (packagesLoaded && selectedPackage && existingGuestCount) {
      const selectedPkg = vendor?.packages.find(
        (p) => p.id === selectedPackage,
      );
      if (selectedPkg) {
        const guestCountNum = parseInt(existingGuestCount);
        if (!isNaN(guestCountNum) && guestCountNum > 0) {
          const minGuests = selectedPkg.minGuests || 1;
          const maxGuests = selectedPkg.maxGuests || 10000;
          let validCount = guestCountNum;
          if (validCount < minGuests) validCount = minGuests;
          if (validCount > maxGuests) validCount = maxGuests;
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setGuestCount(validCount);
          setGuestCountInput(validCount.toString());
        }
      }
    }
  }, [packagesLoaded, selectedPackage, vendor, existingGuestCount]);

  // ✅ ADD THIS useEffect to check if user can review
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

  // ✅ ADD THIS useEffect to fetch review stats
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

  const handleAddOnToggle = (addOnId: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(addOnId)
        ? prev.filter((id) => id !== addOnId)
        : [...prev, addOnId],
    );
  };

  const handleGuestCountInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const rawValue = e.target.value;

    if (rawValue === "") {
      setGuestCountInput("");
      return;
    }

    if (/^\d+$/.test(rawValue)) {
      setGuestCountInput(rawValue);
    }
  };

  const handleGuestCountBlur = () => {
    let numValue = parseInt(guestCountInput);

    if (isNaN(numValue)) {
      numValue = selectedPkg?.minGuests || 1;
    }

    if (selectedPkg) {
      const minGuests = selectedPkg.minGuests || 1;
      const maxGuests = selectedPkg.maxGuests || 10000;
      if (numValue < minGuests) numValue = minGuests;
      if (numValue > maxGuests) numValue = maxGuests;
    }

    if (numValue < 1) numValue = 1;

    setGuestCount(numValue);
    setGuestCountInput(numValue.toString());
  };

  const incrementGuestCount = () => {
    const maxGuests = selectedPkg?.maxGuests || 10000;
    const newValue = Math.min(guestCount + 10, maxGuests);
    setGuestCount(newValue);
    setGuestCountInput(newValue.toString());
  };

  const decrementGuestCount = () => {
    const minGuests = selectedPkg?.minGuests || 1;
    const newValue = Math.max(guestCount - 10, minGuests);
    setGuestCount(newValue);
    setGuestCountInput(newValue.toString());
  };

  const selectedPkg = vendor?.packages.find((p) => p.id === selectedPackage);

  const packagePrice = Number(selectedPkg?.price) || 0;
  const guestCountNum = Number(guestCount) || 1;
  const isPerPerson = selectedPkg?.pricingType === "per_person";

  let basePriceDisplay = packagePrice;
  if (isPerPerson) {
    basePriceDisplay = packagePrice * guestCountNum;
  }

  const addOnsTotal = selectedAddOns.reduce((total, addOnId) => {
    const addOn = selectedPkg?.addOns.find((a) => a.id === addOnId);
    if (addOn) {
      const extraPrice = Number(addOn.extraPrice) || 0;
      if (addOn.pricingType === "per_person") {
        return total + extraPrice * guestCountNum;
      }
      return total + extraPrice;
    }
    return total;
  }, 0);

  const totalAmount = basePriceDisplay + addOnsTotal;
  const depositAmount = totalAmount * 0.2;

  const isGuestCountValid = () => {
    if (!selectedPkg) return true;
    const minGuests = selectedPkg.minGuests || 1;
    const maxGuests = selectedPkg.maxGuests || 10000;
    return guestCountNum >= minGuests && guestCountNum <= maxGuests;
  };

  const handleBooking = async () => {
    if (!session) {
      router.push("/login");
      return;
    }

    if (!selectedPackage) {
      alert("Please select a package");
      return;
    }

    if (!eventDate) {
      alert("Please select an event date");
      return;
    }

    if (!eventTitle) {
      alert("Please enter an event title (e.g., Rita's Wedding)");
      return;
    }

    if (!isGuestCountValid()) {
      alert(
        `Guest count must be between ${selectedPkg?.minGuests || 1} and ${selectedPkg?.maxGuests || 10000}`,
      );
      return;
    }

    setBooking(true);
    try {
      const response = await fetch("/api/vendor-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: vendor?.id,
          packageId: selectedPackage,
          addOnIds: selectedAddOns,
          eventDate,
          guestCount: guestCountNum,
          eventTitle,
          existingEventId: existingEventId || null,
          totalAmount: totalAmount,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Booking request sent successfully!");
        router.push(`/my-bookings`);
      } else {
        alert(data.error || "Booking failed");
      }
    } catch (error) {
      console.error("Error booking vendor:", error);
      alert("An error occurred");
    } finally {
      setBooking(false);
    }
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

  if (status === "loading" || loading) {
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
                  {getServiceIcon(vendor.serviceType)}
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

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
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

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Select Package
            </h2>

            <div className="space-y-4">
              {vendor.packages.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedPackage === pkg.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                      : "border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                  }`}
                >
                  <div className="flex gap-4">
                    {pkg.imageUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={pkg.imageUrl}
                          alt={pkg.name}
                          className="w-24 h-24 object-contain rounded-lg bg-gray-50 dark:bg-gray-700"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {pkg.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {pkg.description}
                          </p>
                          {pkg.pricingType === "per_person" ? (
                            <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              <UserGroupIcon className="h-3 w-3" />
                              Per Person Pricing
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              <CurrencyRupeeIcon className="h-3 w-3" />
                              Fixed Price
                            </span>
                          )}
                          {(pkg.minGuests || pkg.maxGuests) && (
                            <p className="text-xs text-gray-400 mt-1">
                              {pkg.minGuests &&
                                pkg.maxGuests &&
                                `${pkg.minGuests} - ${pkg.maxGuests} guests`}
                              {pkg.minGuests &&
                                !pkg.maxGuests &&
                                `Min ${pkg.minGuests} guests`}
                              {!pkg.minGuests &&
                                pkg.maxGuests &&
                                `Max ${pkg.maxGuests} guests`}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                            NPR {pkg.price.toLocaleString()}
                            {pkg.pricingType === "per_person" && (
                              <span className="text-sm font-normal">
                                /person
                              </span>
                            )}
                          </p>
                          {pkg.pricingType === "per_person" && (
                            <p className="text-xs text-gray-400">
                              = NPR{" "}
                              {(pkg.price * guestCountNum).toLocaleString()}{" "}
                              total for {guestCountNum} guests
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedPkg && selectedPackageImages.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Package Gallery
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {selectedPackageImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative cursor-pointer group overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700"
                    style={{ paddingBottom: "75%" }}
                    onClick={() => {
                      setCurrentImageIndex(idx);
                      setShowGalleryModal(true);
                    }}
                  >
                    <img
                      src={img}
                      alt={`Package ${idx + 1}`}
                      className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedPkg && selectedPkg.addOns.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Add-Ons
              </h2>

              <div className="space-y-3">
                {selectedPkg.addOns.map((addOn) => {
                  const extraPrice = Number(addOn.extraPrice) || 0;
                  const addOnPrice =
                    addOn.pricingType === "per_person"
                      ? extraPrice * guestCountNum
                      : extraPrice;
                  const priceSuffix =
                    addOn.pricingType === "per_person" ? " (per person)" : "";

                  return (
                    <label
                      key={addOn.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedAddOns.includes(addOn.id)}
                          onChange={() => handleAddOnToggle(addOn.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-gray-700 dark:text-gray-300">
                          {addOn.name}
                        </span>
                        {addOn.pricingType === "per_person" && (
                          <span className="text-xs text-gray-400">
                            × {guestCountNum} guests
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                          + NPR {extraPrice.toLocaleString()}
                          {priceSuffix}
                        </span>
                        {addOn.pricingType === "per_person" && (
                          <p className="text-xs text-gray-400">
                            = NPR {addOnPrice.toLocaleString()} total
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Event Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Event Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g., Rita's Wedding"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  This is your event name. You can book multiple vendors under
                  this event.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Event Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expected Guest Count
                  {isPerPerson ? (
                    <span className="text-xs text-blue-600 ml-2">
                      (Affects total price)
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 ml-2">
                      (For planning only - fixed price)
                    </span>
                  )}
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={decrementGuestCount}
                    disabled={
                      selectedPkg?.minGuests
                        ? guestCount <= selectedPkg.minGuests
                        : guestCount <= 1
                    }
                    className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MinusIcon className="h-4 w-4 mx-auto" />
                  </button>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={guestCountInput}
                    onChange={handleGuestCountInputChange}
                    onBlur={handleGuestCountBlur}
                    className="w-28 text-center px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />

                  <button
                    type="button"
                    onClick={incrementGuestCount}
                    disabled={
                      selectedPkg?.maxGuests
                        ? guestCount >= selectedPkg.maxGuests
                        : false
                    }
                    className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusIcon className="h-4 w-4 mx-auto" />
                  </button>
                </div>

                {(selectedPkg?.minGuests || selectedPkg?.maxGuests) && (
                  <p className="text-xs text-gray-400 mt-2">
                    Valid range: {selectedPkg?.minGuests || 1} -{" "}
                    {selectedPkg?.maxGuests || "unlimited"} guests
                  </p>
                )}

                {!isPerPerson && (
                  <p className="text-xs text-gray-400 mt-2">
                    ℹ️ Guest count is for planning only. Price is fixed
                    regardless of number of guests.
                  </p>
                )}

                {selectedPkg?.minGuests &&
                  guestCount < selectedPkg.minGuests && (
                    <p className="text-xs text-red-500 mt-1">
                      ❌ Minimum {selectedPkg.minGuests} guests required for
                      this package
                    </p>
                  )}
                {selectedPkg?.maxGuests &&
                  guestCount > selectedPkg.maxGuests && (
                    <p className="text-xs text-red-500 mt-1">
                      ❌ Maximum {selectedPkg.maxGuests} guests for this package
                    </p>
                  )}
              </div>

              {existingEventTitle &&
                existingEventDate &&
                existingGuestCount && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <InformationCircleIcon className="h-4 w-4" />
                      Event details pre-filled from &quot;
                      {decodeURIComponent(existingEventTitle)}&quot;
                    </p>
                  </div>
                )}
            </div>
          </div>

          {selectedPkg && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Price Summary
              </h2>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    {selectedPkg.name} Package
                  </span>
                  <div className="text-right">
                    <span className="font-medium">
                      NPR{" "}
                      {isPerPerson
                        ? basePriceDisplay.toLocaleString()
                        : packagePrice.toLocaleString()}
                    </span>
                    {isPerPerson && (
                      <p className="text-xs text-gray-400">
                        {packagePrice.toLocaleString()} NPR × {guestCountNum}{" "}
                        guests
                      </p>
                    )}
                    {!isPerPerson && (
                      <p className="text-xs text-gray-400">
                        Fixed price (guest count doesn&apos;t affect total)
                      </p>
                    )}
                  </div>
                </div>

                {selectedAddOns.map((addOnId) => {
                  const addOn = selectedPkg.addOns.find(
                    (a) => a.id === addOnId,
                  );
                  if (!addOn) return null;
                  const extraPrice = Number(addOn.extraPrice) || 0;
                  const addOnPrice =
                    addOn.pricingType === "per_person"
                      ? extraPrice * guestCountNum
                      : extraPrice;
                  const priceNote =
                    addOn.pricingType === "per_person"
                      ? `(${extraPrice.toLocaleString()} NPR × ${guestCountNum} guests)`
                      : "";

                  return (
                    <div
                      key={addOn.id}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-gray-500 dark:text-gray-400">
                        + {addOn.name}
                      </span>
                      <span>
                        + NPR {addOnPrice.toLocaleString()} {priceNote}
                      </span>
                    </div>
                  );
                })}

                <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <div className="flex justify-between font-bold">
                    <span>Total Amount</span>
                    <span className="text-indigo-600 dark:text-indigo-400 text-xl">
                      NPR {totalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500">Deposit (20%)</span>
                    <span className="font-medium">
                      NPR {depositAmount.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    💰 Deposit of {depositAmount.toLocaleString()} NPR (20%)
                    will be required at checkout
                  </p>
                </div>
              </div>

              <button
                onClick={handleBooking}
                disabled={
                  booking || !eventTitle || !eventDate || !isGuestCountValid()
                }
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {booking ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCartIcon className="h-5 w-5" />
                    Proceed to Book (20% Deposit)
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </main>

      {showGalleryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setShowGalleryModal(false)}
        >
          <div
            className="relative max-w-5xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowGalleryModal(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              <XMarkIcon className="h-5 w-5" />
              Close
            </button>

            <div className="relative bg-black rounded-lg overflow-hidden">
              <img
                src={selectedPackageImages[currentImageIndex]}
                alt="Gallery"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            </div>

            {selectedPackageImages.length > 1 && (
              <div className="flex justify-between mt-4 gap-2">
                <button
                  onClick={() =>
                    setCurrentImageIndex((prev) =>
                      prev > 0 ? prev - 1 : selectedPackageImages.length - 1,
                    )
                  }
                  className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center gap-1"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Previous
                </button>
                <span className="text-white py-2 px-4 bg-white/10 rounded-lg">
                  {currentImageIndex + 1} / {selectedPackageImages.length}
                </span>
                <button
                  onClick={() =>
                    setCurrentImageIndex((prev) =>
                      prev < selectedPackageImages.length - 1 ? prev + 1 : 0,
                    )
                  }
                  className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center gap-1"
                >
                  Next
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
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
