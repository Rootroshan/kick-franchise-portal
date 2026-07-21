"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { cn } from "@/lib/utils";

/**
 * `/api/assets/:id/download` returns a JSON `{url}` (not a redirect, unlike
 * the franchisor-only route) — always fetch a fresh signed URL right before
 * opening it, since it expires in 5 minutes and must never be cached/reused.
 */
export function DownloadAssetButton({ assetId, label = "Download", className }: { assetId: string; label?: string; className?: string }) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const { url } = await fetchJson<{ url: string }>(`/api/assets/${assetId}/download`);
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Preparing secure download failed — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={download} disabled={loading} className={cn("inline-flex items-center gap-1.5 disabled:opacity-60", className)}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {loading ? "Preparing…" : label}
    </button>
  );
}
