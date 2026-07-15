"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchJson } from "@/lib/fetchJson";

type Template = {
  id: string;
  name: string;
  items: { id: string; title: string; order: number }[];
};

type ProgressOverviewRow = { locationId: string; locationName: string; percentComplete: number; isStuck: boolean };

export function OnboardingPanel({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [overviewFor, setOverviewFor] = useState<string | null>(null);
  const [overview, setOverview] = useState<ProgressOverviewRow[] | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function viewOverview(templateId: string) {
    setOverviewFor(templateId);
    setOverview(null);
    setOverviewLoading(true);
    setError(null);
    try {
      const { overview: rows } = await fetchJson<{ overview: ProgressOverviewRow[] }>(
        `/api/onboarding/progress?templateId=${templateId}`
      );
      setOverview(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load progress overview");
    } finally {
      setOverviewLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <NewTemplateForm onCreated={(t) => setTemplates((prev) => [t, ...prev])} />
      {error && <p className="text-sm text-destructive">{error}</p>}

      <ul className="flex flex-col gap-2">
        {templates.map((t) => (
          <li key={t.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.items.length} checklist items</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => viewOverview(t.id)}>
                Progress overview
              </Button>
            </div>
            <ol className="mt-2 list-decimal pl-5 text-sm text-muted-foreground">
              {t.items.map((i) => (
                <li key={i.id}>{i.title}</li>
              ))}
            </ol>
            {overviewFor === t.id && (
              <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                {overviewLoading && <p>Loading…</p>}
                {!overviewLoading && overview && (
                  <ul className="flex flex-col gap-1">
                    {overview.map((row) => (
                      <li
                        key={row.locationId}
                        className={`flex items-center justify-between rounded px-2 py-1 ${row.isStuck ? "bg-destructive/10" : ""}`}
                      >
                        <span>{row.locationName}</span>
                        <span className="flex items-center gap-2">
                          {row.isStuck && <Badge variant="destructive">Stuck</Badge>}
                          <span>{row.percentComplete}%</span>
                        </span>
                      </li>
                    ))}
                    {overview.length === 0 && <p className="text-muted-foreground">No locations yet.</p>}
                  </ul>
                )}
              </div>
            )}
          </li>
        ))}
        {templates.length === 0 && <p className="text-sm text-muted-foreground">No templates yet.</p>}
      </ul>
    </div>
  );
}

function NewTemplateForm({ onCreated }: { onCreated: (t: Template) => void }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateItem(index: number, value: string) {
    setItems((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  function addItem() {
    setItems((prev) => [...prev, ""]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanedItems = items.map((i) => i.trim()).filter(Boolean);
    if (cleanedItems.length === 0) {
      setError("Add at least one checklist item");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { template } = await fetchJson<{
        template: { id: string; name: string; items: { id: string; title: string; order: number }[] };
      }>("/api/onboarding/templates", {
        method: "POST",
        body: JSON.stringify({ name, items: cleanedItems.map((title) => ({ title })) }),
      });
      onCreated(template);
      setName("");
      setItems([""]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-md border border-dashed border-border p-4">
      <Input placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={300} />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Checklist items</p>
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={`Step ${index + 1}`}
              maxLength={500}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => removeItem(index)}
              disabled={items.length === 1}
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={addItem} className="self-start">
          <Plus className="h-4 w-4" /> Add item
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Creating…" : "Create template"}
      </Button>
    </form>
  );
}
