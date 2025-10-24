import { z } from "zod";

// Mirrors backend schema for email verification
export const emailVerificationsSchema = z.object({
  token: z.string().refine((val: string) => val.length > 0, {
    message: "Verification token is required",
  }),
});

export type EmailVerificationsInput = z.infer<typeof emailVerificationsSchema>;
