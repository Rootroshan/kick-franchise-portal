import { z } from "zod";

export const createAssetUploadSchema = z.object({
  name: z.string().min(1).max(300),
  type: z.string().min(1).max(100),
  category: z.string().max(100).nullable().optional(),
  mime: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  storageKey: z.string().min(1),
  replacesId: z.string().uuid().nullable().optional(),
});

export const listAssetsQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
});
