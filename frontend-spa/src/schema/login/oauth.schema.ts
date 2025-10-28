import { z } from 'zod';

export const oauthLoginSchema = z.object({
  authType: z.literal('oauth'),
  provider: z.enum(['google', 'apple']),
  idToken: z.string(),
  email: z.email().optional(),
});