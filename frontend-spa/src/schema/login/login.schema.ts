import { z } from 'zod';
import { passwordLoginSchema } from './password.schema';
import { oauthLoginSchema } from './oauth.schema';


export const loginSchema = z.discriminatedUnion('authType', [
  passwordLoginSchema,
  oauthLoginSchema,
]);

export type LoginInput = z.infer<typeof loginSchema>;

// Convenience re-exports for UI forms
export { passwordLoginSchema, oauthLoginSchema };