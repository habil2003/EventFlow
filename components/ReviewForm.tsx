"use client";

import { useState, useEffect } from "react";
import { XMarkIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import RatingStars from "./RatingStars";

interface ReviewFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vendorId?: string;
  eventId?: string;
  bookingId?: string;
  type: "VENDOR" | "EVENT";
  existingRating?: {
    id: string;
    rating: number;
    review: string | null;
  } | null;
  vendorName?: string;
  eventTitle?: string;
}

export default function ReviewForm({
  isOpen,
  onClose,
  onSuccess,
  vendorId,
  eventId,
  bookingId,
  type,
  existingRating,
  vendorName,
  eventTitle,
}: ReviewFormProps) {
  const [rating, setRating] = useState<number>(5);
  const [review, setReview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Load existing rating if editing
  useEffect(() => {
    if (existingRating) {
      setRating(existingRating.rating);
      setReview(existingRating.review || "");
    } else {
      setRating(5);
      setReview("");
    }
    setError(null);
    setSubmitted(false);
  }, [existingRating, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        rating,
        review: review.trim() || null,
        vendorId: vendorId || undefined,
        eventId: eventId || undefined,
        bookingId: bookingId || undefined,
        type,
      };

      const url = existingRating
        ? `/api/ratings/${existingRating.id}`
        : "/api/ratings";

      const method = existingRating ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit review");
      }

      setSubmitted(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSubmitted(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const entityName = type === "VENDOR" ? vendorName : eventTitle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {existingRating ? "Edit Your Review" : "Write a Review"}
            </h2>
            {entityName && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {type === "VENDOR" ? "Vendor:" : "Event:"} {entityName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            disabled={loading}
          >
            <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Rating Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Rating <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <RatingStars
                rating={rating}
                size="lg"
                interactive={true}
                onRatingChange={(newRating) => setRating(newRating)}
                showLabel={true}
              />
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 min-w-[3rem]">
                {rating}/5
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {rating === 5 && "🌟 Excellent - Highly recommended!"}
              {rating === 4 && "👍 Good - Would recommend"}
              {rating === 3 && "👌 Average - It was okay"}
              {rating === 2 && "😕 Below average - Needs improvement"}
              {rating === 1 && "😡 Poor - Not recommended"}
            </p>
          </div>

          {/* Review Text */}
          <div>
            <label
              htmlFor="review"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Your Review{" "}
              <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">
                (optional)
              </span>
            </label>
            <textarea
              id="review"
              rows={4}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder={
                type === "VENDOR"
                  ? "Share your experience with this vendor..."
                  : "Share your experience at this event..."
              }
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-colors resize-none"
              maxLength={2000}
            />
            <div className="flex justify-end mt-1">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {review.length}/2000
              </span>
            </div>
          </div>

          {/* Tips */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              💡 Tips for a helpful review:
            </p>
            <ul className="text-xs text-blue-500 dark:text-blue-300 mt-1 space-y-0.5 list-disc list-inside">
              <li>Be specific about your experience</li>
              <li>Mention what you liked or disliked</li>
              <li>Keep it respectful and constructive</li>
            </ul>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Success State */}
          {submitted && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800 flex items-center gap-3">
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                {existingRating
                  ? "Review updated successfully! 🎉"
                  : "Thank you for your review! 🎉"}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || submitted}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Submitting...
                </>
              ) : (
                <>{existingRating ? "Update Review" : "Submit Review"}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}