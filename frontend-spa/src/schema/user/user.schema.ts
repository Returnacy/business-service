import { z } from "zod";

import { couponSchema } from "../coupon/coupon.schema";
import { stampSchema } from "../stamp/stamp.schema";
import { profileSchema } from "./profile.schema";

export const userSchema = z.object({
  id: z.string(),
  email: z.email().nullable(),
  phone: z.string().nullable(),
  role: z.enum(["BUSINESS", "ADMIN", "USER"]).default("USER"), // ensures only USER_ROLE values are valid
  isVerified: z.boolean(),
  lastVisit: z.date().nullable(),
  profile: profileSchema.nullable(),
  userAgreement: z.object({
    privacyPolicy: z.boolean(),
    termsOfService: z.boolean(),
    marketingPolicy: z.boolean(),
  }),
  coupons: z.object({
    usedCoupons: z.number().int(),
    validCoupons: z.number().int(),
    coupons: z.array(couponSchema).optional(),
  }),
  stamps: z.object({
    usedStamps: z.number().int().optional(),
    validStamps: z.number().int(),
    stamps: z.array(stampSchema).optional(),
  }),
  nextPrize: z.object({
    name: z.string(),
    stampsNeededForNextPrize: z.number().int(),
    stampsNextPrize: z.number().int(),
    stampsLastPrize: z.number().int(),
  }).optional().nullable(),
});