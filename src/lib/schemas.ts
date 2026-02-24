import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const inviteWorkerInputSchema = z.object({
  jobId: uuidSchema,
  workerId: uuidSchema,
});

export const respondAssignmentInputSchema = z.object({
  assignmentId: uuidSchema,
  accept: z.boolean(),
});

export const completeAssignmentInputSchema = z.object({
  assignmentId: uuidSchema,
  minutesWorked: z.number().int().positive(),
  score: z.number().int().min(1).max(5).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});
