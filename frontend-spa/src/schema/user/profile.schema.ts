import { z } from "zod";

export const profileSchema = z.object({
  name: z.string(),
  surname: z.string(),
  birthdate: z.date(),
});