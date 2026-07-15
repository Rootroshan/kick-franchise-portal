"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import { fetchJson } from "@/lib/fetchJson";

type LogEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  role: string;
  actorId: string;
  createdAt: string;
};

export function AuditLogPanel({ initialLogs }: { initialLogs: LogEntry[] }) {
  const [logs, setLogs] = useState(initialLogs);
  const [entity, setEntity] = useState("");
  const [entityId, setEntityId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFilter(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (entity) params.set("entity", entity);
      if (entityId) params.set("entityId", entityId);
      const { logs: filtered } = await fetchJson<{ logs: LogEntry[] }>(`/api/admin/audit-log?${params.toString()}`);
      setLogs(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to filter audit log");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onFilter} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input placeholder="Entity (e.g. Tenant)" value={entity} onChange={(e) => setEntity(e.target.value)} />
        </div>
        <div className="flex-1">
          <Input placeholder="Entity ID" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
        </div>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Filtering…" : "Filter"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Action</th>
              <th className="py-2 pr-4">Entity</th>
              <th className="py-2 pr-4">Entity ID</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Actor</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-border/50">
                <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                <td className="py-2 pr-4">{l.action}</td>
                <td className="py-2 pr-4">{l.entity}</td>
                <td className="py-2 pr-4 font-mono text-xs">{l.entityId ?? "—"}</td>
                <td className="py-2 pr-4">{l.role}</td>
                <td className="py-2 pr-4 font-mono text-xs">{l.actorId}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-muted-foreground">
                  No matching audit entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
