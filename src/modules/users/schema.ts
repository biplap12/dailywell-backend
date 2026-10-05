import { z } from 'zod';

export const stepGoalBody = z.object({
  stepGoal: z.number().int().min(1000).max(100000),
});

export const goalsBody = z
  .object({
    waterGoalMl: z.number().int().min(500).max(10000).optional(),
    sleepTargetMinutes: z.number().int().min(60).max(1080).optional(),
    stepGoal: z.number().int().min(1000).max(100000).optional(),
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().min(7).max(30).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');
