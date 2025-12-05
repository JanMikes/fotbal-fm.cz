import { z } from 'zod';
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

// Category enum values
const categoryEnum = z.enum([
  'Muži A',
  'Muži B',
  'Dorost U16',
  'Dorost U17',
  'Dorost U18',
  'Dorost U19',
  'Žáci U12',
  'Žáci U13',
  'Žáci U14',
  'Žáci U15',
  'Přípravka U8',
  'Přípravka U9',
  'Přípravka U10',
  'Přípravka U11',
  'Školička',
  'Ženy A',
  'Žákyně Mladší',
  'Žákyně Starší',
  'Žákyně Přípravka',
], {
  message: 'Kategorie je povinná',
});

// Event type enum values
const eventTypeEnum = z.enum(['nadcházející', 'proběhlá'], {
  message: 'Typ události je povinný',
});

// Schema for client-side form validation (using valueAsNumber)
export const matchResultSchema = z.object({
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
  category: categoryEnum,
  matchDate: z.string().min(1, 'Datum zápasu je povinné'),
  imagesUrl: z.string().url('Neplatná URL adresa').optional().or(z.literal('')),
});

// Schema for API validation (receives FormData as strings, uses coerce)
export const matchResultApiSchema = z.object({
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
  matchReport: z.string().optional(),
  category: categoryEnum,
  matchDate: z.string().min(1, 'Datum zápasu je povinné'),
  imagesUrl: z.string().url('Neplatná URL adresa').optional().or(z.literal('')),
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
});

export const eventApiSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  eventType: eventTypeEnum,
  dateFrom: z.string().min(1, 'Datum začátku je povinné'),
  dateTo: z.string().optional(),
  publishDate: z.string().optional(),
  eventTime: z.string().optional(),
  eventTimeTo: z.string().optional(),
  description: z.string().optional(),
  requiresPhotographer: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().optional()
  ),
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
  dateFrom: z.string().min(1, 'Datum začátku je povinné'),
  dateTo: z.string().optional(),
  category: categoryEnum,
  imagesUrl: z.string().url('Neplatná URL adresa').optional().or(z.literal('')),
  matches: z.array(inlineMatchSchema).optional(),
  players: z.array(tournamentPlayerSchema).optional(),
});

export const tournamentApiSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  description: z.string().optional(),
  location: z.string().optional(),
  dateFrom: z.string().min(1, 'Datum začátku je povinné'),
  dateTo: z.string().optional(),
  category: categoryEnum,
  imagesUrl: z.string().url('Neplatná URL adresa').optional().or(z.literal('')),
  matches: z.array(inlineMatchApiSchema).optional(),
  players: z.array(tournamentPlayerSchema).optional(),
});

// Tournament match schemas
export const tournamentMatchSchema = z.object({
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
  tournament: z.number({ message: 'Turnaj je povinný' }).int().positive('Vyberte turnaj'),
});

export const tournamentMatchApiSchema = z.object({
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
  tournament: z.coerce.number({ message: 'Turnaj je povinný' }).int().positive('Vyberte turnaj'),
});

// Comment schemas
export const commentSchema = z.object({
  content: z.string().min(1, 'Komentář je povinný').max(2000, 'Komentář může mít maximálně 2000 znaků'),
});

export const commentApiSchema = z.object({
  content: z.string().min(1, 'Komentář je povinný').max(2000, 'Komentář může mít maximálně 2000 znaků'),
  parentComment: z.string().optional(),
  matchResult: z.string().optional(),
  tournament: z.string().optional(),
  event: z.string().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type MatchResultFormData = z.infer<typeof matchResultSchema>;
export type EventFormData = z.infer<typeof eventSchema>;
export type TournamentFormData = z.infer<typeof tournamentSchema>;
export type TournamentMatchFormData = z.infer<typeof tournamentMatchSchema>;
export type InlineMatchFormData = z.infer<typeof inlineMatchSchema>;
export type TournamentPlayerFormData = z.infer<typeof tournamentPlayerSchema>;
export type CommentFormData = z.infer<typeof commentSchema>;
