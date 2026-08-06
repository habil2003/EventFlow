"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ShoppingCartIcon,
  MinusIcon,
  PlusIcon,
  InformationCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import PaymentButton from '@/components/PaymentButton';
import DateRangePicker from '@/components/DateRangePicker';

// ============================================
// HELPER: Format description with robust parsing
// ============================================
function formatDescription(description: string) {
  if (!description) return [];

  const lines = description.split('\n');
  const result: { type: 'heading' | 'bullet' | 'sub-bullet' | 'text' | 'empty'; content: string }[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (!trimmed) {
      result.push({ type: 'empty', content: '' });
      i++;
      continue;
    }

    // Check for heading patterns (ALLCAPS with colon, or common heading keywords)
    const isHeading = (
      (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.includes(':')) ||
      trimmed.startsWith('#') ||
      /^(WHAT'S INCLUDED|WHY BOOK|ABOUT|DETAILS|FEATURES|BENEFITS|INCLUDES|SERVICES|TERMS|NOTES|DESCRIPTION|OVERVIEW|HIGHLIGHTS)/i.test(trimmed) ||
      // Check for emoji at start (using simpler method)
      /^[🎉✨🌟⭐💡📌📍🔑📋📝📢💎🎯🏆🥇💪🔥✨🎊🎈🎁🎂🍾🥂💫🌟⭐️]/.test(trimmed)
    );

    if (isHeading) {
      let heading = trimmed;
      heading = heading.replace(/^#+\s*/, '');
      heading = heading.replace(/:$/, '');
      result.push({ type: 'heading', content: heading });
      i++;
      continue;
    }

    // Check for bullet points with various formats
    const bulletMatch = trimmed.match(/^[\s]*([-•*→◦▪▸▹◆◇⦿○●])\s+(.*)/);
    if (bulletMatch) {
      const bulletChar = bulletMatch[1];
      const content = bulletMatch[2];
      const indent = line.search(/\S/);
      const isSubBullet = indent > 2 || ['.', 'o', '◦', '▪', '▸'].includes(bulletChar);
      
      result.push({ 
        type: isSubBullet ? 'sub-bullet' : 'bullet', 
        content: content
      });
      i++;
      continue;
    }

    // Check for numbered lists
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      result.push({ 
        type: 'bullet', 
        content: `${numberedMatch[1]}. ${numberedMatch[2]}` 
      });
      i++;
      continue;
    }

    // Check for inline bullet points
    if (trimmed.includes('- ') || trimmed.includes('• ')) {
      const parts = trimmed.split(/\s*[-•]\s*/);
      if (parts.length > 1) {
        result.push({ type: 'text', content: parts[0] });
        for (let j = 1; j < parts.length; j++) {
          if (parts[j].trim()) {
            result.push({ type: 'bullet', content: parts[j].trim() });
          }
        }
        i++;
        continue;
      }
    }

    // Check for section header with colon
    const colonMatch = trimmed.match(/^([^:]+):\s*(.+)/);
    if (colonMatch && colonMatch[1].length < 30) {
      result.push({ type: 'heading', content: colonMatch[1] });
      result.push({ type: 'text', content: colonMatch[2] });
      i++;
      continue;
    }

    // Regular text
    result.push({ type: 'text', content: trimmed });
    i++;
  }

  return result;
}

// ============================================
// COMPONENT: Formatted Description Renderer
// ============================================
function FormattedDescription({ description }: { description: string }) {
  const parsed = formatDescription(description);
  
  if (parsed.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">No description available</p>;
  }

  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {parsed.map((item, index) => {
        if (item.type === 'empty') {
          return <div key={index} className="h-2" />;
        }
        
        if (item.type === 'heading') {
          return (
            <h4 key={index} className="font-bold text-gray-800 dark:text-gray-200 mt-3 text-sm uppercase tracking-wide">
              {item.content}
            </h4>
          );
        }
        
        if (item.type === 'bullet') {
          return (
            <div key={index} className="flex items-start gap-2 ml-1">
              <span className="text-indigo-500 mt-0.5 flex-shrink-0">•</span>
              <span className="text-gray-600 dark:text-gray-300">{item.content}</span>
            </div>
          );
        }
        
        if (item.type === 'sub-bullet') {
          return (
            <div key={index} className="flex items-start gap-2 ml-7">
              <span className="text-gray-400 mt-0.5 flex-shrink-0">◦</span>
              <span className="text-gray-500 dark:text-gray-400">{item.content}</span>
            </div>
          );
        }
        
        return (
          <p key={index} className="text-gray-600 dark:text-gray-300">
            {item.content}
          </p>
        );
      })}
    </div>
  );
}

// ============================================
// INTERFACES
// ============================================
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
  rating?: number;
  packages: Package[];
}

// ============================================
// MAIN COMPONENT
// ============================================
function VendorBookingContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const packageId = searchParams.get("packageId");
  const existingEventId = searchParams.get("eventId");
  const existingEventTitle = searchParams.get("eventTitle");
  const existingEventDate = searchParams.get("eventDate");
  const existingGuestCount = searchParams.get("guestCount");

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [totalDays, setTotalDays] = useState(1);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [guestCount, setGuestCount] = useState(100);
  const [guestCountInput, setGuestCountInput] = useState<string>("100");
  const [eventTitle, setEventTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [expandedDescription, setExpandedDescription] = useState(false);
  
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);

  // Get vendor ID from params
  useEffect(() => {
    const getId = async () => {
      const resolvedParams = await params;
      setVendorId(resolvedParams.id as string);
    };
    getId();
  }, [params]);

  // Pre-fill form with existing event data
  useEffect(() => {
    if (existingEventTitle) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEventTitle(decodeURIComponent(existingEventTitle));
    }
  }, [existingEventTitle]);

  // Fetch vendor data
  useEffect(() => {
    if (!vendorId) return;

    const fetchVendor = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/vendors/${vendorId}`);
        const data = await response.json();
        setVendor(data);
        
        if (packageId && data.packages?.some((p: Package) => p.id === packageId)) {
          setSelectedPackage(packageId);
          const selectedPkg = data.packages.find((p: Package) => p.id === packageId);
          if (selectedPkg) {
            const minGuests = selectedPkg.minGuests || 1;
            let initialGuestCount = minGuests;
            
            if (existingGuestCount) {
              const parsedCount = parseInt(existingGuestCount);
              if (!isNaN(parsedCount)) {
                const maxGuests = selectedPkg.maxGuests || 10000;
                initialGuestCount = Math.min(Math.max(parsedCount, minGuests), maxGuests);
              }
            }
            
            setGuestCount(initialGuestCount);
            setGuestCountInput(initialGuestCount.toString());
          }
        } else if (data.packages?.length > 0) {
          setSelectedPackage(data.packages[0].id);
          const firstPkg = data.packages[0];
          const minGuests = firstPkg.minGuests || 1;
          setGuestCount(minGuests);
          setGuestCountInput(minGuests.toString());
        }
      } catch (error) {
        console.error("Error fetching vendor:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVendor();
  }, [vendorId, packageId, existingGuestCount]);

  const handleAddOnToggle = (addOnId: string) => {
    setSelectedAddOns(prev =>
      prev.includes(addOnId)
        ? prev.filter(id => id !== addOnId)
        : [...prev, addOnId]
    );
  };

  const selectedPkg = vendor?.packages.find(p => p.id === selectedPackage);
  const minGuestsAllowed = selectedPkg?.minGuests || 1;
  const maxGuestsAllowed = selectedPkg?.maxGuests || 10000;

  const handleGuestCountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (isNaN(numValue)) numValue = minGuestsAllowed;
    if (numValue < minGuestsAllowed) numValue = minGuestsAllowed;
    if (numValue > maxGuestsAllowed) numValue = maxGuestsAllowed;
    setGuestCount(numValue);
    setGuestCountInput(numValue.toString());
  };

  const incrementGuestCount = () => {
    const newValue = Math.min(guestCount + 10, maxGuestsAllowed);
    setGuestCount(newValue);
    setGuestCountInput(newValue.toString());
  };

  const decrementGuestCount = () => {
    const newValue = Math.max(guestCount - 10, minGuestsAllowed);
    setGuestCount(newValue);
    setGuestCountInput(newValue.toString());
  };

  const packagePrice = Number(selectedPkg?.price) || 0;
  const guestCountNum = Number(guestCount) || minGuestsAllowed;
  const isPerPerson = selectedPkg?.pricingType === "per_person";

  let basePriceDisplay = packagePrice;
  if (isPerPerson) {
    basePriceDisplay = packagePrice * guestCountNum;
  }
  
  let discountPercentValue = 0;
  if (totalDays >= 8) discountPercentValue = 15;
  else if (totalDays >= 4) discountPercentValue = 10;
  else if (totalDays >= 2) discountPercentValue = 5;
  
  const multiDayDiscountAmount = (basePriceDisplay * discountPercentValue) / 100;
  let priceAfterDiscount = basePriceDisplay - multiDayDiscountAmount;
  priceAfterDiscount = priceAfterDiscount * totalDays;

  const addOnsTotal = selectedAddOns.reduce((total, addOnId) => {
    const addOn = selectedPkg?.addOns.find(a => a.id === addOnId);
    if (addOn) {
      const extraPrice = Number(addOn.extraPrice) || 0;
      if (addOn.pricingType === "per_person") {
        return total + (extraPrice * guestCountNum);
      }
      return total + extraPrice;
    }
    return total;
  }, 0);

  const totalAmount = priceAfterDiscount + addOnsTotal;
  const calculatedDepositAmount = totalAmount * 0.2;

  const isGuestCountValid = () => {
    return guestCountNum >= minGuestsAllowed && guestCountNum <= maxGuestsAllowed;
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

    if (!startDate || !endDate) {
      alert("Please select event dates");
      return;
    }

    if (!eventTitle) {
      alert("Please enter an event title");
      return;
    }

    if (!isGuestCountValid()) {
      alert(`Guest count must be between ${minGuestsAllowed} and ${maxGuestsAllowed}`);
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
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: guestCountNum,
          eventTitle,
          existingEventId: existingEventId || null,
          totalAmount: totalAmount,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCreatedBookingId(data.bookingId);
        setDepositAmount(data.depositAmount);
        
        const returnData = {
          vendorId: vendor?.id,
          packageId: selectedPackage,
          eventId: existingEventId || '',
          eventTitle: eventTitle,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guestCount: guestCountNum,
          bookingId: data.bookingId
        };
        sessionStorage.setItem('vendorPaymentReturnData', JSON.stringify(returnData));
        
        setShowPayment(true);
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

  const getSimpleReturnUrl = () => {
    if (!createdBookingId) return undefined;
    return `${window.location.origin}/payment/return?bookingId=${createdBookingId}`;
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (!vendor || !selectedPkg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Package not found</h1>
          <Link href={`/vendors/${vendorId}/packages`} className="mt-4 inline-block text-indigo-600">
            Back to Packages
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Back Button */}
        <div className="mb-6">
          <Link
            href={`/vendors/${vendor.id}/packages?eventId=${existingEventId || ''}&eventTitle=${encodeURIComponent(existingEventTitle || '')}&guestCount=${existingGuestCount || ''}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Packages
          </Link>
        </div>

        {/* Main Grid - 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN - Package Details & Form */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Package Header */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedPkg.name}
                    </h1>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        {vendor.businessName}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        📍 {vendor.location}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      NPR {packagePrice.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {isPerPerson ? 'per person / day' : 'per day'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Package Description - With Robust Formatter */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    📋 Package Details
                  </h3>
                  <button
                    onClick={() => setExpandedDescription(!expandedDescription)}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    {expandedDescription ? 'Show less' : 'Read more'}
                  </button>
                </div>
                
                <div className={`mt-3 text-gray-600 dark:text-gray-300 ${expandedDescription ? '' : 'max-h-48 overflow-hidden relative'}`}>
                  <FormattedDescription description={selectedPkg.description} />
                  {!expandedDescription && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-gray-800 to-transparent" />
                  )}
                </div>
              </div>
            </div>

            {/* Add-ons */}
            {selectedPkg.addOns.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    ✨ Add-Ons
                  </h3>
                  <div className="space-y-3">
                    {selectedPkg.addOns.map((addOn) => (
                      <label
                        key={addOn.id}
                        className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${
                          selectedAddOns.includes(addOn.id)
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedAddOns.includes(addOn.id)}
                            onChange={() => handleAddOnToggle(addOn.id)}
                            className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {addOn.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {addOn.pricingType === "per_person" ? 'Per person' : 'Fixed price'}
                            </p>
                          </div>
                        </div>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          + NPR {addOn.extraPrice.toLocaleString()}
                          {addOn.pricingType === "per_person" && '/person'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Event Details Form */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  📝 Event Details
                </h3>
                
                <div className="space-y-4">
                  {/* Event Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Event Title *
                    </label>
                    <input
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      placeholder="e.g., Rita's Wedding"
                    />
                  </div>

                  {/* Date Picker */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Event Dates *
                    </label>
                    <DateRangePicker
                      vendorId={vendorId || ''}
                      onSelect={(start, end, days) => {
                        setStartDate(start);
                        setEndDate(end);
                        setTotalDays(days);
                        if (days >= 8) setDiscountPercent(15);
                        else if (days >= 4) setDiscountPercent(10);
                        else if (days >= 2) setDiscountPercent(5);
                        else setDiscountPercent(0);
                      }}
                    />
                  </div>

                  {/* Guest Count */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Guest Count
                      {isPerPerson && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                          (Affects total price)
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={decrementGuestCount}
                        disabled={guestCount <= minGuestsAllowed}
                        className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        <MinusIcon className="h-5 w-5" />
                      </button>
                      <input
                        type="text"
                        value={guestCountInput}
                        onChange={handleGuestCountInputChange}
                        onBlur={handleGuestCountBlur}
                        className="w-32 text-center px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <button
                        onClick={incrementGuestCount}
                        disabled={guestCount >= maxGuestsAllowed}
                        className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        <PlusIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-xs text-gray-400">
                        Min: {minGuestsAllowed} | Max: {maxGuestsAllowed === 10000 ? 'Unlimited' : maxGuestsAllowed}
                      </p>
                      {guestCount < minGuestsAllowed && (
                        <p className="text-xs text-red-500">Minimum {minGuestsAllowed} guests required</p>
                      )}
                      {guestCount > maxGuestsAllowed && (
                        <p className="text-xs text-red-500">Maximum {maxGuestsAllowed} guests allowed</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Sticky Booking Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <ShoppingCartIcon className="h-5 w-5" />
                    Booking Summary
                  </h3>
                </div>
                
                <div className="p-6 space-y-4">
                  {/* Package */}
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Package</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedPkg.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      NPR {packagePrice.toLocaleString()} 
                      {isPerPerson ? ` × ${guestCountNum} guests` : ''}
                      {totalDays > 1 ? ` × ${totalDays} days` : ''}
                    </p>
                  </div>

                  <hr className="border-gray-200 dark:border-gray-700" />

                  {/* Price Breakdown */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Base Price</span>
                      <span className="text-gray-900 dark:text-white">NPR {basePriceDisplay.toLocaleString()}</span>
                    </div>
                    
                    {totalDays > 1 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Days</span>
                        <span className="text-gray-900 dark:text-white">× {totalDays}</span>
                      </div>
                    )}
                    
                    {discountPercent > 0 && (
                      <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                        <span>Discount ({discountPercent}%)</span>
                        <span>- NPR {multiDayDiscountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    
                    {selectedAddOns.map(addOnId => {
                      const addOn = selectedPkg.addOns.find(a => a.id === addOnId);
                      if (!addOn) return null;
                      const addOnPrice = addOn.pricingType === "per_person" 
                        ? addOn.extraPrice * guestCountNum 
                        : addOn.extraPrice;
                      return (
                        <div key={addOn.id} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">+ {addOn.name}</span>
                          <span className="text-gray-900 dark:text-white">+ NPR {addOnPrice.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>

                  <hr className="border-gray-200 dark:border-gray-700" />

                  {/* Total */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-gray-900 dark:text-white">Total</span>
                      <span className="text-indigo-600 dark:text-indigo-400">
                        NPR {totalAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Deposit (20%)</span>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        NPR {calculatedDepositAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 mt-2">
                      <p className="text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
                        <InformationCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>Deposit of {calculatedDepositAmount.toLocaleString()} NPR (20%) required at checkout</span>
                      </p>
                    </div>
                  </div>

                  {/* Booking Button */}
                  {!showPayment ? (
                    <button
                      onClick={handleBooking}
                      disabled={booking || !isGuestCountValid() || !startDate || !endDate}
                      className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base"
                    >
                      {booking ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Creating Booking...
                        </span>
                      ) : (
                        `Confirm Booking (${calculatedDepositAmount.toLocaleString()} NPR Deposit)`
                      )}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl">
                        <p className="text-green-700 dark:text-green-300 text-sm font-medium flex items-center gap-2">
                          <CheckCircleIcon className="h-5 w-5" />
                          Booking created successfully!
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                          Complete the payment to confirm your booking.
                        </p>
                      </div>
                      <PaymentButton
                        amount={depositAmount}
                        bookingId={createdBookingId!}
                        paymentType="VENDOR_DEPOSIT"
                        gateway="khalti"
                        buttonText={`Pay Deposit (NPR ${depositAmount.toLocaleString()})`}
                        returnUrl={getSimpleReturnUrl()}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================
// EXPORT with Suspense Boundary
// ============================================
export default function VendorBookingPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading booking details...</p>
        </div>
      </div>
    }>
      <VendorBookingContent />
    </Suspense>
  );
}