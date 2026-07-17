"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, CircleCheckBig } from "lucide-react";
import { toast } from "sonner";
import { completeAssignmentAction } from "@/app/(franchisee)/tasks/[assignmentId]/actions";

/** Large touch-friendly "Mark Complete" button with confirm + idempotent action. */
export function CompleteTaskButton({ assignmentId, completed }: { assignmentId: string; completed: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (completed) {
    return (
      <div className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-status-success/10 px-4 text-sm font-medium text-status-success">
        <CircleCheckBig className="h-5 w-5" /> Completed
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        if (!window.confirm("Mark this task as complete for your store?")) return;
        start(async () => {
          try {
            await completeAssignmentAction(assignmentId);
            toast.success("Task marked complete");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not complete task");
          }
        });
      }}
      disabled={pending}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
      {pending ? "Saving…" : "Mark Complete"}
    </button>
  );
}
