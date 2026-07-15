"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChecklistItem = {
  itemId: string;
  title: string;
  order: number;
  done: boolean;
  doneAt: string | null;
};

type Props = {
  templateId: string;
  name: string;
  percentComplete: number;
  checklist: ChecklistItem[];
};

export function OnboardingChecklist({ templateId, name, percentComplete: initialPercent, checklist: initialChecklist }: Props) {
  const [checklist, setChecklist] = useState(initialChecklist);
  const [percent, setPercent] = useState(initialPercent);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function toggle(itemId: string, done: boolean) {
    setPendingId(itemId);
    const prevChecklist = checklist;
    const prevPercent = percent;

    const next = checklist.map((c) => (c.itemId === itemId ? { ...c, done } : c));
    setChecklist(next);
    setPercent(Math.round((next.filter((c) => c.done).length / next.length) * 100));

    try {
      const res = await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, itemId, done }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setChecklist(prevChecklist); // roll back
      setPercent(prevPercent);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{name}</CardTitle>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{percent}% complete</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        {checklist.map((item) => (
          <label key={item.itemId} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.done}
              disabled={pendingId === item.itemId}
              onChange={(e) => toggle(item.itemId, e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.title}</span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
