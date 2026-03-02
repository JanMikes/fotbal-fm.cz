import { z } from '@hono/zod-openapi';
import { MediaImageSchema, CategorySchema, TeamSchema } from './shared.js';

export const MatchSchema = z.object({
  documentId: z.string(),
  homeTeam: TeamSchema.nullable(),
  awayTeam: TeamSchema.nullable(),
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  matchDate: z.string(),
  matchTime: z.string().nullable(),
  venue: z.string().nullable(),
  round: z.number().nullable(),
  competitionName: z.string().nullable(),
  tournamentName: z.string().nullable(),
  status: z.enum(['upcoming', 'finished']),
  categories: z.array(CategorySchema),
});
