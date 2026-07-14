"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ShoppingCartIcon
} from "@heroicons/react/24/outline";
import PaymentButton from '@/components/PaymentButton';
import DateRangePicker from '@/components/DateRangePicker';

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

// ✅ Component that uses useSearchParams()
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
      setEventTitle(decodeURIComponent(existingEventTitle));
    }
  }, [existingEventTitle]);

  // Fetch vendor data and pre-select the package from URL
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
    
    if (isNaN(numValue)) {
      numValue = minGuestsAllowed;
    }
    
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
        alert("Booking created! Please complete the payment to confirm.");
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

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href={`/vendors/${vendor.id}/packages?eventId=${existingEventId || ''}&eventTitle=${encodeURIComponent(existingEventTitle || '')}&guestCount=${existingGuestCount || ''}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Packages
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <h1 className="text-xl font-bold text-white">Complete Your Booking</h1>
            <p className="text-white/80 text-sm mt-1">{vendor.businessName} - {selectedPkg.name}</p>
          </div>
          
          <div className="p-6">
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{selectedPkg.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedPkg.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    NPR {selectedPkg.price.toLocaleString()}
                    {selectedPkg.pricingType === "per_person" && <span className="text-sm">/person/day</span>}
                  </p>
                </div>
              </div>
            </div>

            {selectedPkg.addOns.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Add-Ons</h3>
                <div className="space-y-2">
                  {selectedPkg.addOns.map((addOn) => (
                    <label key={addOn.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={selectedAddOns.includes(addOn.id)} 
                          onChange={() => handleAddOnToggle(addOn.id)} 
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{addOn.name}</span>
                      </div>
                      <span className="text-indigo-600 dark:text-indigo-400">+ NPR {addOn.extraPrice.toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white">Event Details</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Title *</label>
                <input 
                  type="text" 
                  value={eventTitle} 
                  onChange={(e) => setEventTitle(e.target.value)} 
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  placeholder="e.g., Rita's Wedding" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Guest Count
                  {selectedPkg.pricingType === "per_person" && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">(Affects total price)</span>
                  )}
                </label>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={decrementGuestCount} 
                    disabled={guestCount <= minGuestsAllowed}
                    className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    -
                  </button>
                  <input 
                    type="text" 
                    value={guestCountInput} 
                    onChange={handleGuestCountInputChange} 
                    onBlur={handleGuestCountBlur}
                    className="w-28 text-center px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                  <button 
                    onClick={incrementGuestCount} 
                    disabled={guestCount >= maxGuestsAllowed}
                    className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
                <div className="flex justify-between items-center mt-1">
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

            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-300">{selectedPkg.name} Package (per day)</span>
                <span className="text-gray-900 dark:text-white font-medium">NPR {packagePrice.toLocaleString()}</span>
              </div>
              
              {totalDays > 1 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Number of days</span>
                  <span className="text-gray-600 dark:text-gray-300">{totalDays} days</span>
                </div>
              )}
              
              {discountPercent > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Multi-day discount ({discountPercent}%)</span>
                  <span>- NPR {multiDayDiscountAmount.toLocaleString()}</span>
                </div>
              )}
              
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-600 dark:text-gray-300">Subtotal ({totalDays} days)</span>
                <span className="text-gray-900 dark:text-white font-medium">NPR {priceAfterDiscount.toLocaleString()}</span>
              </div>
              
              {selectedAddOns.map(addOnId => {
                const addOn = selectedPkg.addOns.find(a => a.id === addOnId);
                if (!addOn) return null;
                const addOnPrice = addOn.pricingType === "per_person" ? addOn.extraPrice * guestCountNum : addOn.extraPrice;
                return (
                  <div key={addOn.id} className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">+ {addOn.name}</span>
                    <span className="text-gray-600 dark:text-gray-300">+ NPR {addOnPrice.toLocaleString()}</span>
                  </div>
                );
              })}
              
              <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                <div className="flex justify-between font-bold">
                  <span className="text-gray-900 dark:text-white">Total Amount</span>
                  <span className="text-indigo-600 dark:text-indigo-400 text-xl">NPR {totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500 dark:text-gray-400">Deposit (20%)</span>
                  <span className="text-gray-600 dark:text-gray-300">NPR {calculatedDepositAmount.toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">💰 Deposit of {calculatedDepositAmount.toLocaleString()} NPR (20%) required at checkout</p>
              </div>
            </div>

            {!showPayment ? (
              <button
                onClick={handleBooking}
                disabled={booking || !isGuestCountValid() || !startDate || !endDate}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {booking ? "Creating Booking..." : `Confirm Booking (20% Deposit - NPR ${calculatedDepositAmount.toLocaleString()})`}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="text-green-700 dark:text-green-300 text-sm">
                    ✓ Booking created successfully!
                  </p>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                    Please complete the payment to confirm your booking.
                  </p>
                </div>
                <PaymentButton
                  amount={depositAmount}
                  bookingId={createdBookingId!}
                  paymentType="VENDOR_DEPOSIT"
                  gateway="khalti"
                  buttonText={`Pay Deposit (20% - NPR ${depositAmount.toLocaleString()})`}
                  returnUrl={getSimpleReturnUrl()}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ✅ Main export with Suspense boundary
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