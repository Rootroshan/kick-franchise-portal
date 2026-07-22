"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { createProduct, updateProduct, createVariant, updateVariant } from "@/server/modules/commerce/products";
import { PRODUCT_CATEGORIES } from "@/server/modules/commerce/schemas";

export type ActionResult = { ok: boolean; message: string };

/**
 * Catalogue server actions.
 *
 * Thin wrappers over the existing commerce services, which already validate
 * with Zod, write audit entries and are reachable only by KICK_ADMIN. The API
 * routes were built long before any UI existed; this adds the missing UI layer
 * without duplicating the rules.
 *
 * requireRole("KICK_ADMIN") throws before any commerce query runs, so a
 * FRANCHISOR_ADMIN session never reaches the service — matching the guarantee
 * the API routes already make.
 */

function fail(err: unknown): ActionResult {
  return { ok: false, message: err instanceof Error ? err.message : "Something went wrong." };
}

const productInput = z.object({
  tenantId: z.string().uuid("Select a brand."),
  name: z.string().trim().min(1, "Enter a product name.").max(200),
  sku: z.string().trim().min(1, "Enter a SKU.").max(100),
  category: z.enum(PRODUCT_CATEGORIES).nullable(),
  description: z.string().trim().max(2000).nullable(),
  imageUrl: z.string().trim().url("Enter a valid image URL.").max(1000).nullable(),
  active: z.boolean(),
});

export async function createProductAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = productInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    // tenantId is passed explicitly: a KICK_ADMIN is cross-tenant, so the
    // product's brand cannot be inferred from their context.
    await createProduct(ctx, parsed.data.tenantId, {
      name: parsed.data.name,
      sku: parsed.data.sku,
      category: parsed.data.category,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl,
      active: parsed.data.active,
    });
  } catch (err) {
    return fail(err);
  }

  revalidatePath("/admin/commerce");
  return { ok: true, message: "Product created." };
}

export async function updateProductAction(productId: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = productInput.omit({ tenantId: true }).partial().safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await updateProduct(ctx, productId, parsed.data);
  } catch (err) {
    return fail(err);
  }

  revalidatePath("/admin/commerce");
  return { ok: true, message: "Product updated." };
}

const variantInput = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a variant name.").max(200),
  // Money crosses the wire as integer minor units, never a float — the form
  // converts dollars to cents before submitting.
  priceCents: z.number().int().nonnegative("Price cannot be negative."),
  currency: z.string().length(3).default("CAD"),
  stock: z.number().int().nonnegative().nullable(),
  active: z.boolean(),
});

export async function createVariantAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = variantInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await createVariant(ctx, parsed.data);
  } catch (err) {
    return fail(err);
  }

  revalidatePath("/admin/commerce");
  return { ok: true, message: "Variant added." };
}

export async function updateVariantAction(variantId: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireRole("KICK_ADMIN")();

  const parsed = variantInput.omit({ productId: true }).partial().safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await updateVariant(ctx, variantId, parsed.data);
  } catch (err) {
    return fail(err);
  }

  revalidatePath("/admin/commerce");
  return { ok: true, message: "Variant updated." };
}
