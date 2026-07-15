import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  details: z.string().max(20_000).nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  locationIds: z.array(z.string().uuid()).min(1).max(500),
});

export const completeTaskAssignmentSchema = z.object({}).optional();
