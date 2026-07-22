"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type RestoreResult = { ok: boolean; message: string };

/** Row action on the version history table — promotes a non-current version back to current. */
export function RestoreVersionButton({
  assetId,
  targetVersionId,
  action,
  className,
}: {
  assetId: string;
  targetVersionId: string;
  /** Server action for the current portal (admin vs franchisor each guard/scope differently). */
  action: (assetId: string, targetVersionId: string) => Promise<RestoreResult>;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function restore() {
    startTransition(async () => {
      const result = await action(assetId, targetVersionId);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Restore this version?</span>
        <button type="button" onClick={restore} disabled={pending} className={cn("font-medium text-primary hover:underline disabled:opacity-60", className)}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="text-muted-foreground hover:underline disabled:opacity-60">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={cn("inline-flex items-center gap-1.5 text-primary hover:underline", className)}
    >
      <RotateCcw className="h-3.5 w-3.5" />
      Restore this version
    </button>
  );
}
