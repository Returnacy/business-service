import { Pizza } from "lucide-react";
import { Progress } from "../components/ui/progress";

interface LoyaltyCardProps {
  stamps: number;
  maxStamps?: number;
  className?: string;
}

export function LoyaltyCard({ stamps, maxStamps = 15, className = "" }: LoyaltyCardProps) {
  const progress = (stamps / maxStamps) * 100;

  return (
    <div className={`bg-gradient-to-br from-brand-blue to-brand-dark rounded-2xl p-6 text-white ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-[#27496D]">Carta Fedeltà</h3>
        <p className="text-sm font-medium text-[#27496D]">Raccogli {maxStamps} timbri per un premio speciale!</p>
      </div>
      {/* Progress Bar */}
      <div className="w-full bg-brand-dark rounded-full h-3 mb-4">
        <div 
          className="bg-white h-3 rounded-full transition-all duration-500" 
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Stamps Grid - 3 rows of 5 stamps each for 15 total */}
      <div className="grid grid-cols-5 gap-2">
        {Array(maxStamps).fill(null).map((_, index) => (
          <div
            key={index}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              index < stamps
                ? "bg-white"
                : "bg-brand-dark border-2 border-white border-dashed"
            }`}
          >
            {index < stamps && (
              <Pizza className="w-4 h-4 text-brand-blue" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
