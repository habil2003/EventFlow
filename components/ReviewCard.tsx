"use client";

import { formatDistanceToNow } from "date-fns";
import { UserCircleIcon } from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import RatingStars from "./RatingStars";

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    review: string | null;
    userName: string;
    userId: string;
    isVerified: boolean;
    createdAt: string | Date;
    updatedAt?: string | Date;
    booking?: {
      reference: string;
      packageName?: string;
      startDate?: string | Date;
      endDate?: string | Date;
    } | null;
    ticket?: {
      ticketNumber: string;
      tierName?: string;
    } | null;
  };
  type?: "VENDOR" | "EVENT";
  showBookingInfo?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function ReviewCard({
  review,
  type = "VENDOR",
  showBookingInfo = true,
  size = "md",
}: ReviewCardProps) {
  const sizeMap = {
    sm: {
      avatar: "h-8 w-8",
      name: "text-sm",
      review: "text-sm",
      spacing: "gap-2",
      padding: "p-3",
    },
    md: {
      avatar: "h-10 w-10",
      name: "text-base",
      review: "text-sm",
      spacing: "gap-3",
      padding: "p-4",
    },
    lg: {
      avatar: "h-12 w-12",
      name: "text-lg",
      review: "text-base",
      spacing: "gap-4",
      padding: "p-6",
    },
  };

  const styles = sizeMap[size];

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Determine if review is recent (within 30 days)
  const isRecent = () => {
    const date = new Date(review.createdAt);
    const now = new Date();
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 ${styles.padding} hover:shadow-md transition-shadow`}>
      {/* Header: User Info + Date */}
      <div className={`flex items-start justify-between ${styles.spacing}`}>
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {review.userName ? (
              <div
                className={`${styles.avatar} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm flex-shrink-0`}
              >
                {getInitials(review.userName)}
              </div>
            ) : (
              <UserCircleIcon className={`${styles.avatar} text-gray-400`} />
            )}
          </div>

          {/* Name + Badges */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold text-gray-900 dark:text-white ${styles.name} truncate`}>
                {review.userName || "Anonymous"}
              </span>
              {review.isVerified && (
                <span className="inline-flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                  <CheckBadgeIcon className="h-3 w-3" />
                  Verified
                </span>
              )}
              {isRecent() && (
                <span className="inline-flex text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                  New
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rating */}
        <div className="flex-shrink-0">
          <RatingStars rating={review.rating} size="sm" />
        </div>
      </div>

      {/* Review Content */}
      {review.review && (
        <div className={`mt-2 ${styles.review} text-gray-600 dark:text-gray-300 leading-relaxed`}>
          {review.review}
        </div>
      )}

      {/* Booking/Ticket Info */}
      {showBookingInfo && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 pt-2">
          {type === "VENDOR" && review.booking && (
            <>
              <span>
                📦 {review.booking.packageName || "Service"}
              </span>
              {review.booking.startDate && (
                <span>
                  📅 {new Date(review.booking.startDate).toLocaleDateString()}
                </span>
              )}
              <span>
                🔖 {review.booking.reference}
              </span>
            </>
          )}
          {type === "EVENT" && review.ticket && (
            <>
              <span>
                🎟️ {review.ticket.tierName || "Ticket"}
              </span>
              <span>
                #{review.ticket.ticketNumber}
              </span>
            </>
          )}
          <span className="ml-auto">
            {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
          </span>
        </div>
      )}
    </div>
  );
}