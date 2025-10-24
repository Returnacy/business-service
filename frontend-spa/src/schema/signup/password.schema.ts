import { z } from 'zod';

export const passwordSignupSchema = z.object({
  authType: z.literal('password'),
  email: z.string().email({ message: 'Invalid email' }),
  password: z.string().min(8).max(20),
});