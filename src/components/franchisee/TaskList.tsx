"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type TaskItem = {
  taskId: string;
  assignmentId: string;
  title: string;
  details: string | null;
  dueAt: string | null;
  completed: boolean;
};

export function TaskList({ tasks }: { tasks: TaskItem[] }) {
  const [state, setState] = useState(() => new Map(tasks.map((t) => [t.assignmentId, t.completed])));
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function complete(assignmentId: string) {
    setPendingId(assignmentId);
    setState((prev) => new Map(prev).set(assignmentId, true)); // immediate UI feedback
    try {
      const res = await fetch(`/api/task-assignments/${assignmentId}/complete`, { method: "POST" });
      if (!res.ok) throw new Error("failed");
    } catch {
      setState((prev) => new Map(prev).set(assignmentId, false)); // roll back
      alert("Couldn't mark complete — try again.");
    } finally {
      setPendingId(null);
    }
  }

  if (tasks.length === 0) return <p className="text-sm text-muted-foreground">No tasks assigned.</p>;

  return (
    <div className="flex flex-col gap-3">
      {tasks.map((t) => {
        const done = state.get(t.assignmentId) ?? t.completed;
        return (
          <Card key={t.taskId}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Link href={`/tasks/${t.assignmentId}`} className="font-medium hover:underline">{t.title}</Link>
                  {done && <Badge variant="success">Done</Badge>}
                </div>
                {t.details && <p className="text-sm text-muted-foreground">{t.details}</p>}
                {t.dueAt && <p className="text-xs text-muted-foreground">Due {formatDate(t.dueAt)}</p>}
              </div>
              <Button
                size="sm"
                disabled={done || pendingId === t.assignmentId}
                onClick={() => complete(t.assignmentId)}
              >
                {done ? "Completed" : "Complete"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
