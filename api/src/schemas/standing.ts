import { z } from '@hono/zod-openapi';
import { TeamSchema } from './shared.js';

export const StandingSchema = z.object({
  position: z.number(),
  team: TeamSchema.nullable(),
  matchesPlayed: z.number(),
  wins: z.number(),
  draws: z.number(),
  losses: z.number(),
  goalsFor: z.number(),
  goalsAgainst: z.number(),
  points: z.number(),
  tournamentName: z.string().nullable(),
});
