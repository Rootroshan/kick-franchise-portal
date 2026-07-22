import type { OrderStatus } from "@prisma/client";

/**
 * Single source of truth for how raw OrderStatus values map to what a store
 * user sees. Raw statuses are honest DB states; display statuses are the five
 * customer-facing buckets from the approved design (+ Refunded/Failed, which
 * exist in the data and must not be hidden or mislabelled).
 */
export type DisplayStatus = "processing" | "shipped" | "delivered" | "cancelled" | "refunded" | "failed";

export const DISPLAY_STATUS: Record<OrderStatus, DisplayStatus> = {
  PENDING: "processing",
  PAID: "processing",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  FULFILLED: "delivered", // legacy pre-shipping-workflow terminal state
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "refunded",
  FAILED: "failed",
};

export const DISPLAY_LABEL: Record<DisplayStatus, string> = {
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Payment failed",
};

/** Badge tone per display status — matches the ui/badge variants in use. */
export const DISPLAY_TONE: Record<DisplayStatus, "success" | "warning" | "destructive" | "muted"> = {
  processing: "warning",
  shipped: "success",
  delivered: "success",
  cancelled: "muted",
  refunded: "muted",
  failed: "destructive",
};

/** Raw statuses behind each store-facing tab/filter bucket. */
export const STATUS_BUCKETS: Record<DisplayStatus, OrderStatus[]> = {
  processing: ["PENDING", "PAID", "PROCESSING"],
  shipped: ["SHIPPED"],
  delivered: ["DELIVERED", "FULFILLED"],
  cancelled: ["CANCELLED"],
  refunded: ["REFUNDED", "PARTIALLY_REFUNDED"],
  failed: ["FAILED"],
};

export function isDisplayStatus(v: string): v is DisplayStatus {
  return v in STATUS_BUCKETS;
}

/**
 * Customer-facing order reference, e.g. "VS-1025": brand-name initials + the
 * sequential orderNumber. Never derived from the internal uuid.
 */
export function orderRef(brandName: string, orderNumber: number): string {
  const initials = brandName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 3)
    .join(""); // "Volt Studios" → "VS"
  return `${initials || "OR"}-${orderNumber}`;
}

/**
 * Carriers KICK_ADMIN may record shipments against. The tracking URL is built
 * from these templates server- AND client-side render alike — an arbitrary URL
 * is never stored or accepted, so unsafe links can't reach a store user.
 */
export const CARRIERS: Record<string, { label: string; trackingUrl: (n: string) => string }> = {
  "canada-post": { label: "Canada Post", trackingUrl: (n) => `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${encodeURIComponent(n)}` },
  purolator: { label: "Purolator", trackingUrl: (n) => `https://www.purolator.com/en/shipping/tracker?pin=${encodeURIComponent(n)}` },
  ups: { label: "UPS", trackingUrl: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}` },
  fedex: { label: "FedEx", trackingUrl: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}` },
  dhl: { label: "DHL", trackingUrl: (n) => `https://www.dhl.com/ca-en/home/tracking.html?tracking-id=${encodeURIComponent(n)}` },
  usps: { label: "USPS", trackingUrl: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}` },
};

export function carrierLabel(carrier: string | null): string | null {
  return carrier ? (CARRIERS[carrier]?.label ?? carrier) : null;
}

/** Validated tracking link, or null when the shipment data is incomplete. */
export function trackingUrl(carrier: string | null, trackingNumber: string | null): string | null {
  if (!carrier || !trackingNumber) return null;
  return CARRIERS[carrier]?.trackingUrl(trackingNumber) ?? null;
}
