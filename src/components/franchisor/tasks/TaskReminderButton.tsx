"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { sendReminderAction } from "@/app/franchisor/tasks/actions";

export function TaskReminderButton({ id, openCount }: { id: string; openCount: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      onClick={() =>
        start(async () => {
          try {
            await sendReminderAction(id);
            toast.success("Reminder sent to stores with open assignments");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to send reminder");
          }
        })
      }
      disabled={pending || openCount === 0}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
      title={openCount === 0 ? "No open assignments" : undefined}
    >
      <Send className="h-4 w-4" /> {pending ? "Sending…" : `Send Reminder${openCount > 0 ? ` (${openCount})` : ""}`}
    </button>
  );
}
