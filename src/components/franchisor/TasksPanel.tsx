"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/fetchJson";
import { formatDate } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  details: string | null;
  dueAt: string | null;
  assignmentCount: number;
};

type CompletionStats = {
  total: number;
  completed: number;
  percentComplete: number;
  assignments: { locationId: string; locationName: string; status: string; completedAt: string | null }[];
};

export function TasksPanel({ locations, initialTasks }: { locations: { id: string; name: string }[]; initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statsFor, setStatsFor] = useState<string | null>(null);
  const [stats, setStats] = useState<CompletionStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  function toggleLocation(id: string) {
    setSelectedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedLocations.size === 0) {
      setError("Select at least one location");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { task } = await fetchJson<{ task: { id: string; title: string; details: string | null; dueAt: string | null; assignments: unknown[] } }>(
        "/api/tasks",
        {
          method: "POST",
          body: JSON.stringify({
            title,
            details: details || undefined,
            dueAt: dueAt || undefined,
            locationIds: [...selectedLocations],
          }),
        }
      );
      setTasks((prev) => [
        { id: task.id, title: task.title, details: task.details, dueAt: task.dueAt, assignmentCount: task.assignments.length },
        ...prev,
      ]);
      setTitle("");
      setDetails("");
      setDueAt("");
      setSelectedLocations(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  async function viewStats(taskId: string) {
    setStatsFor(taskId);
    setStats(null);
    setStatsLoading(true);
    try {
      // No dedicated stats route was in the confirmed API surface, so we derive
      // it client-side from the task list's per-assignment data via /api/tasks.
      const { tasks: refreshed } = await fetchJson<{
        tasks: { id: string; assignments: { locationId: string; status: string; completedAt: string | null; location?: { name: string } }[] }[];
      }>("/api/tasks");
      const task = refreshed.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");
      const completed = task.assignments.filter((a) => a.status === "COMPLETED");
      setStats({
        total: task.assignments.length,
        completed: completed.length,
        percentComplete: task.assignments.length ? Math.round((completed.length / task.assignments.length) * 100) : 0,
        assignments: task.assignments.map((a) => ({
          locationId: a.locationId,
          locationName: a.location?.name ?? locations.find((l) => l.id === a.locationId)?.name ?? a.locationId,
          status: a.status,
          completedAt: a.completedAt,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load completion stats");
    } finally {
      setStatsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-md border border-dashed border-border p-4">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={300} />
        <Textarea placeholder="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} />
        <label className="flex flex-col gap-1 text-sm sm:w-64">
          Due date (optional)
          <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </label>
        <div>
          <p className="mb-1 text-sm font-medium">Assign to locations</p>
          <div className="flex flex-wrap gap-2">
            {locations.map((l) => (
              <label
                key={l.id}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
              >
                <input type="checkbox" checked={selectedLocations.has(l.id)} onChange={() => toggleLocation(l.id)} />
                {l.name}
              </label>
            ))}
            {locations.length === 0 && <p className="text-sm text-muted-foreground">No locations available.</p>}
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={submitting} className="self-start">
          {submitting ? "Creating…" : "Create task"}
        </Button>
      </form>

      <ul className="flex flex-col gap-2">
        {tasks.map((t) => (
          <li key={t.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t.dueAt ? `Due ${formatDate(t.dueAt)}` : "No due date"} · {t.assignmentCount} location{t.assignmentCount === 1 ? "" : "s"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => viewStats(t.id)}>
                Completion stats
              </Button>
            </div>
            {t.details && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.details}</p>}
            {statsFor === t.id && (
              <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                {statsLoading && <p>Loading…</p>}
                {!statsLoading && stats && (
                  <>
                    <p className="mb-2 font-medium">
                      {stats.completed}/{stats.total} complete ({stats.percentComplete}%)
                    </p>
                    <ul className="flex flex-col gap-1">
                      {stats.assignments.map((a) => (
                        <li key={a.locationId} className="flex items-center justify-between">
                          <span>{a.locationName}</span>
                          <span className={a.status === "COMPLETED" ? "text-green-700" : "text-muted-foreground"}>{a.status}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
        {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
      </ul>
    </div>
  );
}
