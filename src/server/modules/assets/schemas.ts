import { z } from "zod";

export const ASSET_CATEGORIES = ["Logo", "Signage", "Menu Board", "Campaign", "Template"] as const;

export const createAssetUploadSchema = z.object({
  name: z.string().min(1).max(300),
  type: z.string().min(1).max(100),
  category: z.string().max(100).nullable().optional(),
  mime: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  storageKey: z.string().min(1),
  replacesId: z.string().uuid().nullable().optional(),
  versionNotes: z.string().max(1000).nullable().optional(),
  publishActive: z.boolean().optional(),
});

/** Metadata for a direct (server-relayed) upload — no storageKey; the server generates it. */
export const directAssetUploadMetaSchema = createAssetUploadSchema.omit({ storageKey: true });

export const updateAssetMetadataSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  category: z.string().max(100).nullable().optional(),
});

export const listAssetsQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
});
