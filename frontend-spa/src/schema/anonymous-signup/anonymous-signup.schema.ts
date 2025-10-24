import { z } from 'zod';

export const anonymousSignupSchema = z.object({
  authType: z.literal('anonymous'),
  phone: z.string().min(9).max(15),
  name: z.string().min(2).max(50),
  surname: z.string().min(2).max(50),
  birthdate: z.string(),
});

export type AnonymousSignupInput = z.infer<typeof anonymousSignupSchema>;