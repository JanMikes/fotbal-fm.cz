import { z } from 'zod/v4';
import './zod-init'; // Initialize Czech locale for Zod error messages

/**
 * Normalize time input to Strapi's expected format: HH:mm:ss.SSS
 * Handles various browser formats:
 * - "HH:mm" (Chrome, Firefox)
 * - "HH:mm:ss"
 * - "h:mm AM/PM" or "h:mm:ss AM/PM" (Safari 12-hour format)
 */
export function normalizeTimeForStrapi(time: string | undefined | null): string | undefined {
  if (!time || time.trim() === '') {
    return undefined;
  }

  const trimmed = time.trim();

  // Check for 12-hour format with AM/PM
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const seconds = ampmMatch[3] || '00';
    const period = ampmMatch[4].toUpperCase();

    // Convert to 24-hour format
    if (period === 'AM' && hours === 12) {
      hours = 0;
    } else if (period === 'PM' && hours !== 12) {
      hours += 12;
    }

    const hoursStr = hours.toString().padStart(2, '0');
    return `${hoursStr}:${minutes}:${seconds}.000`;
  }

  // Check for 24-hour format HH:mm or HH:mm:ss
  const time24Match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (time24Match) {
    const hours = time24Match[1].padStart(2, '0');
    const minutes = time24Match[2];
    const seconds = time24Match[3] || '00';
    return `${hours}:${minutes}:${seconds}.000`;
  }

  // If format is unrecognized, return as-is (Strapi will validate)
  return trimmed;
}

export const loginSchema = z.object({
  email: z.string().email('Neplatný formát emailu'),
  password: z.string().min(1, 'Heslo je povinné'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Neplatný formát emailu'),
});

export const resetPasswordSchema = z
  .object({
    code: z.string().min(1, 'Kód je povinný'),
    password: z
      .string()
      .min(8, 'Heslo musí mít alespoň 8 znaků')
      .regex(/[A-Z]/, 'Heslo musí obsahovat alespoň jedno velké písmeno')
      .regex(/[a-z]/, 'Heslo musí obsahovat alespoň jedno malé písmeno')
      .regex(/[0-9]/, 'Heslo musí obsahovat alespoň jednu číslici'),
    passwordConfirmation: z.string().min(1, 'Potvrzení hesla je povinné'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Hesla se neshodují',
    path: ['passwordConfirmation'],
  });

export const registerSchema = z.object({
  email: z.string().email('Neplatný formát emailu'),
  password: z
    .string()
    .min(8, 'Heslo musí mít alespoň 8 znaků')
    .regex(/[A-Z]/, 'Heslo musí obsahovat alespoň jedno velké písmeno')
    .regex(/[a-z]/, 'Heslo musí obsahovat alespoň jedno malé písmeno')
    .regex(/[0-9]/, 'Heslo musí obsahovat alespoň jednu číslici'),
  firstName: z.string().min(1, 'Jméno je povinné'),
  lastName: z.string().min(1, 'Příjmení je povinné'),
  jobTitle: z.string().min(1, 'Funkce je povinná'),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'Jméno je povinné'),
  lastName: z.string().min(1, 'Příjmení je povinné'),
  jobTitle: z.string().min(1, 'Funkce je povinná'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Současné heslo je povinné'),
    newPassword: z
      .string()
      .min(8, 'Nové heslo musí mít alespoň 8 znaků')
      .regex(/[A-Z]/, 'Nové heslo musí obsahovat alespoň jedno velké písmeno')
      .regex(/[a-z]/, 'Nové heslo musí obsahovat alespoň jedno malé písmeno')
      .regex(/[0-9]/, 'Nové heslo musí obsahovat alespoň jednu číslici'),
    confirmPassword: z.string().min(1, 'Potvrzení hesla je povinné'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Hesla se neshodují',
    path: ['confirmPassword'],
  });

// Event type enum values
const eventTypeEnum = z.enum(['nadcházející', 'proběhlá'], {
  message: 'Typ události je povinný',
});

// Schema for client-side form validation (using valueAsNumber)
export const matchSchema = z.object({
  homeTeam: z.string().min(1, 'Domácí tým je povinný'),
  awayTeam: z.string().min(1, 'Hostující tým je povinný'),
  homeScore: z.number()
    .int('Skóre musí být celé číslo')
    .min(0, 'Skóre nemůže být záporné'),
  awayScore: z.number()
    .int('Skóre musí být celé číslo')
    .min(0, 'Skóre nemůže být záporné'),
  homeGoalscorers: z.string().optional(),
  awayGoalscorers: z.string().optional(),
  matchReport: z.string().optional(),
  lineup: z.string().optional(),
  categoryIds: z.array(z.string()).min(1, 'Vyberte alespoň jednu kategorii'),
  matchDate: z.string().min(1, 'Datum zápasu je povinné'),
  imagesUrl: z.string().url('Neplatná URL adresa').optional().or(z.literal('')),
  tournament: z.string().optional(),
});

// Schema for API validation (receives FormData as strings, uses coerce)
// Transform empty strings to undefined for optional fields
const emptyToUndefined = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().optional()
);

export const matchApiSchema = z.object({
  homeTeam: z.string().min(1, 'Domácí tým je povinný'),
  awayTeam: z.string().min(1, 'Hostující tým je povinný'),
  homeScore: z.coerce.number()
    .int('Skóre musí být celé číslo')
    .min(0, 'Skóre nemůže být záporné'),
  awayScore: z.coerce.number()
    .int('Skóre musí být celé číslo')
    .min(0, 'Skóre nemůže být záporné'),
  homeGoalscorers: emptyToUndefined,
  awayGoalscorers: emptyToUndefined,
  matchReport: emptyToUndefined,
  lineup: emptyToUndefined,
  categories: z.array(z.string()).min(1, 'Vyberte alespoň jednu kategorii'),
  matchDate: z.string().min(1, 'Datum zápasu je povinné'),
  imagesUrl: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url('Neplatná URL adresa').optional()
  ),
  tournament: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().optional()
  ),
});

// Event schemas
export const eventSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  eventType: eventTypeEnum,
  dateFrom: z.string().min(1, 'Datum začátku je povinné'),
  dateTo: z.string().optional(),
  publishDate: z.string().optional(),
  eventTime: z.string().optional(),
  eventTimeTo: z.string().optional(),
  description: z.string().optional(),
  requiresPhotographer: z.boolean().optional(),
  categoryIds: z.array(z.string()).optional(),
});

export const eventApiSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  eventType: eventTypeEnum,
  dateFrom: z.string().min(1, 'Datum začátku je povinné'),
  dateTo: emptyToUndefined,
  publishDate: emptyToUndefined,
  eventTime: emptyToUndefined,
  eventTimeTo: emptyToUndefined,
  description: emptyToUndefined,
  requiresPhotographer: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().optional()
  ),
  categories: z.array(z.string()).optional(),
});

// Inline match schema (for matches created within tournament form)
export const inlineMatchSchema = z.object({
  homeTeam: z.string().min(1, 'Domácí tým je povinný'),
  awayTeam: z.string().min(1, 'Hostující tým je povinný'),
  homeScore: z.number()
    .int('Skóre musí být celé číslo')
    .min(0, 'Skóre nemůže být záporné'),
  awayScore: z.number()
    .int('Skóre musí být celé číslo')
    .min(0, 'Skóre nemůže být záporné'),
  homeGoalscorers: z.string().optional(),
  awayGoalscorers: z.string().optional(),
});

export const inlineMatchApiSchema = z.object({
  homeTeam: z.string().min(1, 'Domácí tým je povinný'),
  awayTeam: z.string().min(1, 'Hostující tým je povinný'),
  homeScore: z.coerce.number()
    .int('Skóre musí být celé číslo')
    .min(0, 'Skóre nemůže být záporné'),
  awayScore: z.coerce.number()
    .int('Skóre musí být celé číslo')
    .min(0, 'Skóre nemůže být záporné'),
  homeGoalscorers: z.string().optional(),
  awayGoalscorers: z.string().optional(),
});

// Tournament player schema (for players created within tournament form)
export const tournamentPlayerSchema = z.object({
  title: z.string().min(1, 'Titul je povinný'),
  playerName: z.string().min(1, 'Jméno hráče je povinné'),
});

// Tournament schemas
export const tournamentSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  description: z.string().optional(),
  location: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  categoryIds: z.array(z.string()).min(1, 'Vyberte alespoň jednu kategorii'),
  imagesUrl: z.string().url('Neplatná URL adresa').optional().or(z.literal('')),
  matches: z.array(inlineMatchSchema).optional(),
  players: z.array(tournamentPlayerSchema).optional(),
});

export const tournamentApiSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  description: emptyToUndefined,
  location: emptyToUndefined,
  dateFrom: emptyToUndefined,
  dateTo: emptyToUndefined,
  categories: z.array(z.string()).min(1, 'Vyberte alespoň jednu kategorii'),
  imagesUrl: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url('Neplatná URL adresa').optional()
  ),
  matches: z.array(inlineMatchApiSchema).optional(),
  players: z.array(tournamentPlayerSchema).optional(),
});

// News article schemas
export const newsArticleSchema = z.object({
  title: z.string().min(1, 'Titulek je povinný'),
  description: z.string().min(1, 'Obsah aktuality je povinný'),
  date: z.string().min(1, 'Datum publikace je povinné'),
  time: z.string().optional(),
  video: z.string().url('Neplatná URL adresa').optional().or(z.literal('')),
  categoryIds: z.array(z.string()).min(1, 'Vyberte alespoň jednu kategorii'),
});

export const newsArticleApiSchema = z.object({
  title: z.string().min(1, 'Titulek je povinný'),
  description: z.string().min(1, 'Obsah aktuality je povinný'),
  date: z.string().min(1, 'Datum publikace je povinné'),
  video: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url('Neplatná URL adresa').optional()
  ),
  categories: z.array(z.string()).min(1, 'Vyberte alespoň jednu kategorii'),
  mainPhotoId: z.number().int().positive().optional(),
  galleryIds: z.array(z.number().int().positive()).optional(),
  fileIds: z.array(z.number().int().positive()).optional(),
});

// Comment schemas
export const commentSchema = z.object({
  content: z.string().min(1, 'Komentář je povinný').max(2000, 'Komentář může mít maximálně 2000 znaků'),
});

export const commentApiSchema = z.object({
  content: z.string().min(1, 'Komentář je povinný').max(2000, 'Komentář může mít maximálně 2000 znaků'),
  parentComment: z.string().optional(),
  match: z.string().optional(),
  tournament: z.string().optional(),
  event: z.string().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type MatchFormData = z.infer<typeof matchSchema>;
export type EventFormData = z.infer<typeof eventSchema>;
export type TournamentFormData = z.infer<typeof tournamentSchema>;
export type InlineMatchFormData = z.infer<typeof inlineMatchSchema>;
export type TournamentPlayerFormData = z.infer<typeof tournamentPlayerSchema>;
export type CommentFormData = z.infer<typeof commentSchema>;
export type NewsArticleFormData = z.infer<typeof newsArticleSchema>;
