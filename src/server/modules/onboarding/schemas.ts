import { z } from "zod";

export const createOnboardingTemplateSchema = z.object({
  name: z.string().min(1).max(300),
  items: z.array(z.object({ title: z.string().min(1).max(500) })).min(1).max(200),
});

export const markProgressSchema = z.object({
  itemId: z.string().uuid(),
  done: z.boolean(),
});
