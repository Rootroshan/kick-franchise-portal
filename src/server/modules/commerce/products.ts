import type { Prisma } from "@prisma/client";
import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { HttpError } from "@/server/modules/identity/errors";
import type { z } from "zod";
import type { createProductSchema, updateProductSchema, createVariantSchema, updateVariantSchema } from "./schemas";

/** All commerce writes require KICK_ADMIN — enforced by the caller via requireRole() before these run. */

export async function createProduct(ctx: RequestContext, tenantId: string, input: z.infer<typeof createProductSchema>) {
  return withTenant(ctx, async (tx) => {
    const product = await tx.product.create({
      data: {
        tenantId,
        name: input.name,
        sku: input.sku,
        category: input.category ?? null,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        active: input.active,
      },
    });
    await writeAuditLog(tx, {
      tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "product.create",
      entity: "Product",
      entityId: product.id,
      after: product,
    });
    return product;
  });
}

export async function updateProduct(ctx: RequestContext, productId: string, input: z.infer<typeof updateProductSchema>) {
  return withTenant(ctx, async (tx) => {
    const before = await tx.product.findUnique({ where: { id: productId } });
    if (!before) throw new HttpError(404, "Product not found");

    const after = await tx.product.update({ where: { id: productId }, data: input });
    await writeAuditLog(tx, {
      tenantId: after.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "product.update",
      entity: "Product",
      entityId: productId,
      before,
      after,
    });
    return after;
  });
}

export async function listProducts(ctx: RequestContext, tenantId: string | null) {
  return withTenant(ctx, (tx) =>
    tx.product.findMany({
      where: { tenantId: tenantId ?? undefined },
      include: { variants: true },
      orderBy: { createdAt: "desc" },
    })
  );
}

export async function createVariant(ctx: RequestContext, input: z.infer<typeof createVariantSchema>) {
  return withTenant(ctx, async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new HttpError(404, "Product not found");

    const variant = await tx.productVariant.create({
      data: {
        productId: input.productId,
        name: input.name,
        priceCents: input.priceCents,
        currency: input.currency,
        stock: input.stock ?? null,
        active: input.active,
      },
    });
    await writeAuditLog(tx, {
      tenantId: product.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "variant.create",
      entity: "ProductVariant",
      entityId: variant.id,
      after: variant,
    });
    return variant;
  });
}

export async function updateVariant(ctx: RequestContext, variantId: string, input: z.infer<typeof updateVariantSchema>) {
  return withTenant(ctx, async (tx) => {
    const before = await tx.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
    if (!before) throw new HttpError(404, "Variant not found");

    const after = await tx.productVariant.update({ where: { id: variantId }, data: input });
    await writeAuditLog(tx, {
      tenantId: before.product.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "variant.priceOrStock.update",
      entity: "ProductVariant",
      entityId: variantId,
      before,
      after,
    });
    return after;
  });
}

export type CatalogQuery = {
  /** Matches product name, SKU, or category (case-insensitive contains). */
  q?: string;
  category?: string;
};

/**
 * Franchisee-facing catalog: only active products with at least one active
 * variant in the caller's own tenant. RLS also enforces the tenant scope
 * independently. Admin-only fields (shopifyId, updatedAt) are never selected.
 */
export async function getCatalogForLocation(ctx: RequestContext, tenantId: string, query: CatalogQuery = {}) {
  const q = query.q?.trim();
  return withTenant(ctx, (tx) =>
    tx.product.findMany({
      where: {
        tenantId,
        active: true,
        variants: { some: { active: true } },
        ...(query.category ? { category: query.category } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        description: true,
        imageUrl: true,
        createdAt: true,
        variants: {
          where: { active: true },
          orderBy: { priceCents: "asc" },
          select: { id: true, name: true, priceCents: true, currency: true, stock: true },
        },
      },
      orderBy: { name: "asc" },
    })
  );
}

export type PrismaTx = Prisma.TransactionClient;
