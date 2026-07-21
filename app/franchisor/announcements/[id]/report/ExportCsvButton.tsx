"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { InlineLoader } from "@/components/ui/InlineLoader";
import { bulkExportAcknowledgementCsvAction } from "@/app/franchisor/announcements/actions";

/** Decodes the base64 CSV returned by the server action and downloads it — same client-side pattern as audit-log export. */
export function ExportCsvButton({ announcementId, tenantId, fileName }: { announcementId: string; tenantId?: string; fileName: string }) {
  const [pending, start] = useTransition();

  const onClick = () => {
    start(async () => {
      const result = await bulkExportAcknowledgementCsvAction(announcementId, tenantId);
      if (!result.ok || !result.csv) {
        toast.error(result.message);
        return;
      }
      const bytes = Uint8Array.from(atob(result.csv), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(result.message);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
    >
      {pending ? <InlineLoader label="Exporting…" /> : (
        <>
          <Download className="h-4 w-4" /> Export CSV
        </>
      )}
    </button>
  );
}
