import { z } from 'zod';

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month: 1-12
}

function normalizeBirthdate(input: unknown): string | unknown {
  if (typeof input !== 'string') return input;
  const s = input.trim();
  if (s === '') return s;
  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Support DD/MM/YYYY and MM/DD/YYYY, allowing 1-2 digit day/month
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return s; // leave as-is; will fail regex later if unsupported
  const a = Number(m[1]); // first number
  const b = Number(m[2]); // second number
  const y = Number(m[3]);

  // Try DD/MM first (EU default)
  const dayEU = a, monthEU = b;
  const isValidEU = dayEU >= 1 && dayEU <= 31 && monthEU >= 1 && monthEU <= 12 && dayEU <= daysInMonth(y, monthEU);
  if (isValidEU) return `${y}-${pad2(monthEU)}-${pad2(dayEU)}`;
  // Try MM/DD (US)
  const monthUS = a, dayUS = b;
  const isValidUS = monthUS >= 1 && monthUS <= 12 && dayUS >= 1 && dayUS <= 31 && dayUS <= daysInMonth(y, monthUS);
  if (isValidUS) return `${y}-${pad2(monthUS)}-${pad2(dayUS)}`;
  return s; // let schema fail downstream
}


export const baseSchema = z.object({
  acceptedTermsAndConditions: z.boolean().refine((val: boolean) => val, {
    message: 'You must accept the terms and conditions'
  }),
  acceptedPrivacyPolicy: z.boolean().refine((val: boolean) => val, {
    message: 'You must accept the privacy policy'
  }),
  name: z.string().min(2).max(100).refine((val: string) => val.trim().length > 0, {
    message: 'Name is required'
  }),
  surname: z.string().min(2).max(100).refine((val: string) => val.trim().length > 0, {
    message: 'Surname is required'
  }),
  birthdate: z.preprocess(normalizeBirthdate, z.string().min(10).max(10).refine((val: string) => /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: 'Birthdate must be in YYYY-MM-DD format'
  })),
  // Phone is optional. Accept local or international formats:
  // - Empty string -> undefined (not provided)
  // - Normalize by removing spaces and dashes
  // - Validate as optional '+' followed by 9-15 digits
  phone: z
    .union([z.string(), z.undefined()])
    .transform((val: unknown) => {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') return undefined;
        const normalized = trimmed.replace(/[\s-]/g, '');
        return normalized;
      }
      return val;
    })
    .refine(
      (val: unknown) => val === undefined || (typeof val === 'string' && /^\+?\d{9,15}$/.test(val)),
      { message: 'Phone number must be valid' }
    ),
});