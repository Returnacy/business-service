import { z } from "zod";

export const stampSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  createdAt: z.date(),
  isRedeemed: z.boolean(),
});