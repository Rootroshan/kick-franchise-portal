"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { InlineLoader } from "@/components/ui/InlineLoader";

/**
 * Store User cancellation request. Submits a REQUEST only — the server
 * re-checks eligibility (pre-fulfilment states) and KICK_ADMIN decides; the
 * order status never changes from here.
 */
export function RequestCancelButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not submit the cancellation request");
      }
      toast.success("Cancellation requested. Your brand team will review it shortly.");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit the cancellation request");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-status-error/40 text-sm font-medium text-status-error hover:bg-status-error/5"
      >
        Request cancellation
      </button>

      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request cancellation</DialogTitle>
            <DialogClose onClick={() => !pending && setOpen(false)} />
          </DialogHeader>
          <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            This sends a cancellation request to the brand team — the order stays as-is until they approve it.
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            maxLength={500}
            rows={3}
            aria-label="Cancellation reason"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="min-h-10 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              Keep order
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-status-error px-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? <InlineLoader label="Requesting cancellation…" /> : "Request cancellation"}
            </button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
