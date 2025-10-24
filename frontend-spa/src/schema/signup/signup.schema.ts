import { z } from 'zod';
import { passwordSignupSchema } from './password.schema';
import { oauthSignupSchema } from './oauth.schema';
import { baseSchema } from './base.schema';


export const signupSchema = z.intersection(
  baseSchema,
  z.discriminatedUnion('authType', [
    passwordSignupSchema,
    oauthSignupSchema
  ])
);

export type SignupInput = z.infer<typeof signupSchema>;
export { passwordSignupSchema, oauthSignupSchema };