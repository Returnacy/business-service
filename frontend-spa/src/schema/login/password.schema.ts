import { z } from 'zod';

export const passwordLoginSchema = z.object({
  authType: z.literal('password'),
  email: z.string().email({ message: 'Invalid email' }),
  password: z.string().min(8).max(20),
});