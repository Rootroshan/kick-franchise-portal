"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { fetchJson } from "@/lib/fetchJson";

type Report = {
  id: string;
  period: string;
  periodLabel: string;
  generatedAt: string;
  hasCsv: boolean;
  hasPdf: boolean;
};

export function RebateReportsPanel({ reports }: { reports: Report[] }) {
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(reportId: string, format: "csv" | "pdf") {
    const key = `${reportId}-${format}`;
    setDownloadingKey(key);
    setError(null);
    try {
      const { url } = await fetchJson<{ url: string }>(`/api/rebates/reports/${reportId}/download?format=${format}`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get download link");
    } finally {
      setDownloadingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4">Period</th>
              <th className="py-2 pr-4">Label</th>
              <th className="py-2 pr-4">Generated</th>
              <th className="py-2 pr-4">Downloads</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b border-border/50">
                <td className="py-2 pr-4">{r.period}</td>
                <td className="py-2 pr-4">{r.periodLabel}</td>
                <td className="py-2 pr-4">{formatDateTime(r.generatedAt)}</td>
                <td className="py-2 pr-4">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!r.hasCsv || downloadingKey === `${r.id}-csv`}
                      onClick={() => download(r.id, "csv")}
                    >
                      {downloadingKey === `${r.id}-csv` ? "…" : "CSV"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!r.hasPdf || downloadingKey === `${r.id}-pdf`}
                      onClick={() => download(r.id, "pdf")}
                    >
                      {downloadingKey === `${r.id}-pdf` ? "…" : "PDF"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-muted-foreground">
                  No reports generated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
