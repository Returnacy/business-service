import { z } from "zod";

export const couponSchema = z.object({
  createdAt: z.date(),
  code: z.string(),
  url: z.string(),
  isRedeemed: z.boolean(),
  redeemedAt: z.date().nullable(),
  prize: z
    .object({
      pointsRequired: z.number().int(),
      name: z.string(),
    })
    .optional(),
});