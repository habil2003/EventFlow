"use client";

// app/vendors/[id]/reviews/page.tsx
// Public reviews-only page for a vendor. Landing testimonials and the
// vendor detail page ("View all reviews") link here. No login required to
// read; writing is gated behind the reviews API + review-status endpoints.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import ReviewList from "@/components/ReviewList";

interface VendorInfo {
  id: string;
  businessName: string;
}

export default function VendorReviewsPage() {
  const params = useParams();
  const [vendorId, setVendorId] = useState<string>("");
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const resolved = await params;
      const id = Array.isArray(resolved?.id) ? resolved.id[0] : resolved?.id;
      if (!id) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setVendorId(id);
      try {
        const res = await fetch(`/api/vendors/${id}/ratings?page=1&limit=1`);
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data?.data?.vendor) {
            setVendor(data.data.vendor);
          } else {
            setNotFound(true);
          }
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (notFound || !vendor) {
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href={`/vendors/${vendorId}`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to {vendor.businessName}
        </Link>

        <div className="mt-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {vendor.businessName}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Customer reviews &amp; ratings
          </p>
        </div>

        <ReviewList vendorId={vendorId} type="VENDOR" limit={10} />
      </main>
    </div>
  );
}