import { z } from "zod";

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(20_000),
  isPinned: z.boolean().optional().default(false),
  publishAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  requiresAck: z.boolean().optional().default(false),
  /** Save as DRAFT regardless of publishAt — set server-side from the form's Save Draft intent, never inferred from dates. */
  asDraft: z.boolean().optional(),
});

export const composerSchema = z
  .object({
    intent: z.enum(["SAVE_DRAFT", "PUBLISH"]),
    publishMode: z.enum(["NOW", "SCHEDULE"]),
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(300),
    body: z.string().trim().min(1, "Body is required").max(20_000),
    isPinned: z.boolean(),
    requiresAck: z.boolean(),
    publishAt: z.string().optional(),
    expiresAt: z.string().optional(),
  })
  .superRefine((v, issueCtx) => {
    if (v.intent === "PUBLISH" && v.publishMode === "SCHEDULE") {
      if (!v.publishAt) {
        issueCtx.addIssue({ code: z.ZodIssueCode.custom, path: ["publishAt"], message: "A publish date is required when scheduling" });
      } else if (new Date(v.publishAt) <= new Date()) {
        issueCtx.addIssue({ code: z.ZodIssueCode.custom, path: ["publishAt"], message: "Scheduled publish time must be in the future" });
      }
    }
    if (v.expiresAt) {
      const effectivePublish = v.publishMode === "SCHEDULE" && v.publishAt ? new Date(v.publishAt) : new Date();
      if (new Date(v.expiresAt) <= effectivePublish) {
        issueCtx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Expiry must be after the publish time" });
      }
    }
  });

/** Parses the Create Announcement composer's FormData. Status is NEVER read from the form — derived from intent+mode by the caller. */
export function parseComposerForm(formData: FormData) {
  return composerSchema.parse({
    intent: formData.get("intent"),
    publishMode: formData.get("publishMode") ?? "NOW",
    title: formData.get("title"),
    body: formData.get("body"),
    isPinned: formData.get("isPinned") === "on",
    requiresAck: formData.get("requiresAck") === "on",
    publishAt: (formData.get("publishAt") as string) || undefined,
    expiresAt: (formData.get("expiresAt") as string) || undefined,
  });
}

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  body: z.string().min(1).max(20_000).optional(),
  isPinned: z.boolean().optional(),
  publishAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  requiresAck: z.boolean().optional(),
});
