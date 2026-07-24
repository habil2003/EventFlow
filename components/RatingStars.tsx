"use client";

import { StarIcon } from "@heroicons/react/24/solid";
import { StarIcon as StarOutline } from "@heroicons/react/24/outline";

interface RatingStarsProps {
  rating: number;
  maxStars?: number;
  size?: "sm" | "md" | "lg" | "xl";
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  showLabel?: boolean;
  label?: string;
}

export default function RatingStars({
  rating,
  maxStars = 5,
  size = "md",
  interactive = false,
  onRatingChange,
  showLabel = false,
  label,
}: RatingStarsProps) {
  const sizeMap = {
    sm: "h-3 w-3",
    md: "h-5 w-5",
    lg: "h-6 w-6",
    xl: "h-8 w-8",
  };

  const starClass = sizeMap[size];

  const handleClick = (index: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(index + 1);
    }
  };

  const handleHover = (index: number) => {
    if (interactive && onRatingChange) {
      // Could add hover preview state if needed
    }
  };

  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = maxStars - Math.ceil(rating);

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {Array.from({ length: fullStars }).map((_, index) => (
          <button
            key={`full-${index}`}
            type="button"
            onClick={() => handleClick(index)}
            onMouseEnter={() => handleHover(index)}
            disabled={!interactive}
            className={interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}
          >
            <StarIcon
              className={`${starClass} text-yellow-400 ${
                interactive ? "hover:text-yellow-300" : ""
              }`}
            />
          </button>
        ))}

        {hasHalfStar && (
          <button
            type="button"
            onClick={() => handleClick(fullStars)}
            disabled={!interactive}
            className={interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}
          >
            <div className={`relative ${starClass}`}>
              <StarOutline className={`${starClass} text-yellow-400 absolute inset-0`} />
              <div className="absolute inset-0 overflow-hidden w-1/2">
                <StarIcon className={`${starClass} text-yellow-400`} />
              </div>
            </div>
          </button>
        )}

        {Array.from({ length: emptyStars }).map((_, index) => (
          <button
            key={`empty-${index}`}
            type="button"
            onClick={() => handleClick(fullStars + (hasHalfStar ? 1 : 0) + index)}
            disabled={!interactive}
            className={interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}
          >
            <StarOutline
              className={`${starClass} text-gray-300 dark:text-gray-600 ${
                interactive ? "hover:text-yellow-300" : ""
              }`}
            />
          </button>
        ))}
      </div>

      {showLabel && (
        <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {label || `${rating.toFixed(1)}`}
        </span>
      )}
    </div>
  );
}