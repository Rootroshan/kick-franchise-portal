import { z } from "zod";

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(20_000),
  isPinned: z.boolean().optional().default(false),
  publishAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  requiresAck: z.boolean().optional().default(false),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  body: z.string().min(1).max(20_000).optional(),
  isPinned: z.boolean().optional(),
  publishAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  requiresAck: z.boolean().optional(),
});
