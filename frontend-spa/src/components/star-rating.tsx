import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg" | "xl";
  interactive?: boolean;
  className?: string;
}

export function StarRating({ 
  rating, 
  onRatingChange, 
  size = "md", 
  interactive = false,
  className = "" 
}: StarRatingProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6", 
    lg: "w-8 h-8",
    xl: "w-12 h-12"
  };

  const starSize = sizeClasses[size];

  return (
    <div className={`flex space-x-1 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onRatingChange?.(star)}
          className={`transition-colors ${
            interactive 
              ? "hover:scale-110 transform transition-transform cursor-pointer" 
              : "cursor-default"
          }`}
        >
          <Star
            className={`${starSize} ${
              star <= rating 
                ? "fill-yellow-400 text-yellow-400" 
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
