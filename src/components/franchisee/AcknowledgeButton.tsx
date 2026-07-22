"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Acknowledge flow for the store feed / detail / pinned-rail cards. Calls the
 * existing idempotent ack endpoint, then router.refresh() so the server-
 * rendered list re-reads ack state without a full reload. The optimistic
 * `done` flag swaps the button to the green pill immediately.
 */
export function AcknowledgeButton({ id, acked, fullWidth }: { id: string; acked: boolean; fullWidth?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(acked);

  if (done) {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Acknowledged
      </Badge>
    );
  }

  function acknowledge() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/announcements/${id}/ack`, { method: "POST" });
        if (!res.ok) throw new Error();
        setDone(true);
        toast.success("Announcement acknowledged");
        router.refresh();
      } catch {
        toast.error("Couldn't acknowledge — try again.");
      }
    });
  }

  return (
    <Button
      size="sm"
      variant={fullWidth ? "default" : "outline"}
      className={cn(fullWidth && "w-full")}
      onClick={acknowledge}
      disabled={pending}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      Acknowledge
    </Button>
  );
}
