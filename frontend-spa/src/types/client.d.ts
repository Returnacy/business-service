import { CouponType } from "./coupon";
import { StampType } from "./stamp";
import { ProfileType } from "./profile";

export type ClientType = {
  id: string;
  email: string | null;
  phone: string | null;
  role: "BUSINESS" | "ADMIN" | "USER";
  isVerified: boolean;
  lastVisit: Date | null;
  profile: ProfileType | null;
  userAgreement: {
    privacyPolicy: boolean;
    termsOfService: boolean;
    marketingPolicy: boolean;
  };
  coupons: {
    usedCoupons: number;
    validCoupons: number;
    coupons?: CouponType[];
  }
  stamps: {
    usedStamps?: number;
    validStamps: number;
    stamps?: StampType[];
  }
  nextPrize?: {
    name: string;
    stampsNeededForNextPrize: number;
    stampsNextPrize: number;
    stampsLastPrize: number;
  } | null;
}