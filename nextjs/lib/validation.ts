import { z } from 'zod';

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
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type MatchResultFormData = z.infer<typeof matchResultSchema>;
