"use client";

import { useState, useEffect } from "react";
import { ChevronLeftIcon, ChevronRightIcon, StarIcon } from "@heroicons/react/24/solid";
import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import ReviewCard from "./ReviewCard";

interface ReviewListProps {
  vendorId?: string;
  eventId?: string;
  type: "VENDOR" | "EVENT";
  initialPage?: number;
  limit?: number;
  showStats?: boolean;
  showFilters?: boolean;
  className?: string;
}

interface Review {
  id: string;
  rating: number;
  review: string | null;
  userName: string;
  userId: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt?: string;
  booking?: {
    reference: string;
    packageName?: string;
    startDate?: string;
    endDate?: string;
  } | null;
  ticket?: {
    ticketNumber: string;
    tierName?: string;
  } | null;
}

interface ReviewStats {
  average: number;
  total: number;
  min: number | null;
  max: number | null;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export default function ReviewList({
  vendorId,
  eventId,
  type,
  initialPage = 1,
  limit = 10,
  showStats = true,
  showFilters = true,
  className = "",
}: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterRating, setFilterRating] = useState<number | null>(null);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      let url = "";
      if (vendorId) {
        url = `/api/vendors/${vendorId}/ratings?page=${page}&limit=${limit}`;
      } else if (eventId) {
        url = `/api/events/${eventId}/ratings?page=${page}&limit=${limit}`;
      } else {
        return;
      }

      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setReviews(result.data.ratings);
          setStats(result.data.stats);
          setTotal(result.data.pagination.total);
          setTotalPages(result.data.pagination.pages);
        }
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReviews();
  }, [vendorId, eventId, page, limit]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              <div className="flex-1">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded mt-1"></div>
              </div>
            </div>
            <div className="mt-3 h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="mt-1 h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">📝</div>
        <p className="text-gray-500 dark:text-gray-400">No reviews yet</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Be the first to leave a review!
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stats Section */}
      {showStats && stats && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-6">
            {/* Average Rating */}
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.average.toFixed(1)}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                      key={star}
                      className={`h-4 w-4 ${
                        star <= Math.round(stats.average)
                          ? "text-yellow-400"
                          : "text-gray-300 dark:text-gray-600"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {stats.total} {stats.total === 1 ? "review" : "reviews"}
                </p>
              </div>
            </div>

            {/* Rating Distribution */}
            <div className="flex-1 min-w-[150px]">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.distribution[star as 1 | 2 | 3 | 4 | 5] || 0;
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-gray-500 dark:text-gray-400 text-right">
                      {star}★
                    </span>
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="w-8 text-gray-400 dark:text-gray-500 text-left">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filter by Rating */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Filter:</span>
          <button
            onClick={() => setFilterRating(null)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filterRating === null
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            All
          </button>
          {[5, 4, 3, 2, 1].map((star) => (
            <button
              key={star}
              onClick={() => setFilterRating(filterRating === star ? null : star)}
              className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                filterRating === star
                  ? "bg-yellow-400 text-gray-900"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {star}★
            </button>
          ))}
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews
          .filter((review) =>
            filterRating ? review.rating === filterRating : true
          )
          .map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              type={type}
              showBookingInfo={true}
              size="md"
            />
          ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Previous
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}