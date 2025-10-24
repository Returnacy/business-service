// Pure Zod schema definitions for frontend validation & typings.
// Removed Drizzle ORM to slim bundle & avoid simulating backend DB on the client.
import { z } from "zod";

// ----------------------------------
// User
// ----------------------------------
export const userSchema = z.object({
  id: z.number().int().optional(),
  name: z.string(),
  surname: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(6).optional().nullable(),
  role: z.string().default("user"),
  birthdate: z.string().optional().nullable(),
  stamps: z.number().int().default(0),
  totalCoupons: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isEmailVerified: z.boolean().default(false),
  createdAt: z.string().optional(),
  lastSeen: z.string().optional().nullable(),
});

export const insertUserSchema = userSchema.pick({
  name: true,
  surname: true,
  email: true,
  phone: true,
  birthdate: true,
  role: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => !!(data.email || data.phone), {
  message: "Either email or phone number is required",
  path: ["email"],
});

// ----------------------------------
// Auth
// ----------------------------------
export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// ----------------------------------
// Phone Verification
// ----------------------------------

export const verifyPhoneSchema = z.object({
  phone: z.string().min(10, "Numero di telefono non valido"),
  code: z.string().min(4, "Codice di verifica richiesto"),
});

// ----------------------------------
// Feedback & Stamps (lightweight forms)
// ----------------------------------
export const insertFeedbackSchema = z.object({
  npsScore: z.number().int().min(0).max(10),
  comment: z.string().optional(),
  trafficSource: z.string(),
});

export const insertStampTransactionSchema = z.object({
  userId: z.number().int(),
  stampsAdded: z.number().int().min(1),
});

// ----------------------------------
// Types
// ----------------------------------
export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
export type VerifyPhoneData = z.infer<typeof verifyPhoneSchema>;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type InsertStampTransaction = z.infer<typeof insertStampTransactionSchema>;

// (Optional) Backwards compatibility stubs for removed Drizzle table types
// to prevent accidental import breakage if any code still refers to them.
// Remove later when confirmed unused.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Coupon = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Feedback = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StampTransaction = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EmailLog = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SmsLog = any;
