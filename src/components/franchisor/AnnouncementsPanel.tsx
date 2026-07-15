"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { fetchJson } from "@/lib/fetchJson";
import { formatDateTime } from "@/lib/utils";

type Announcement = {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "EXPIRED";
  publishAt: string | null;
  expiresAt: string | null;
  requiresAck: boolean;
};

const STATUS_VARIANT: Record<Announcement["status"], "success" | "warning" | "muted"> = {
  PUBLISHED: "success",
  SCHEDULED: "warning",
  DRAFT: "muted",
  EXPIRED: "muted",
};

export function AnnouncementsPanel({ initialAnnouncements }: { initialAnnouncements: Announcement[] }) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = announcements.find((a) => a.id === editingId) ?? null;

  function upsert(a: Announcement) {
    setAnnouncements((prev) => {
      const idx = prev.findIndex((x) => x.id === a.id);
      if (idx === -1) return [a, ...prev];
      const copy = [...prev];
      copy[idx] = a;
      return copy;
    });
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <AnnouncementForm key={editing?.id ?? "new"} announcement={editing} onSaved={upsert} onCancel={() => setEditingId(null)} />

      <ul className="flex flex-col gap-2">
        {announcements.map((a) => (
          <li key={a.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{a.title}</span>
                {a.isPinned && <Badge variant="outline">Pinned</Badge>}
                {a.requiresAck && <Badge variant="outline">Requires ack</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => setEditingId(a.id)}>
                  Edit
                </Button>
                <Link href={`/franchisor/announcements/${a.id}/report`}>
                  <Button size="sm" variant="ghost">
                    Ack report
                  </Button>
                </Link>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {a.publishAt ? `Publishes ${formatDateTime(a.publishAt)}` : "Publishes immediately"}
              {a.expiresAt ? ` · Expires ${formatDateTime(a.expiresAt)}` : ""}
            </p>
          </li>
        ))}
        {announcements.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
      </ul>
    </div>
  );
}

function AnnouncementForm({
  announcement,
  onSaved,
  onCancel,
}: {
  announcement: Announcement | null;
  onSaved: (a: Announcement) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [body, setBody] = useState(announcement?.body ?? "");
  const [isPinned, setIsPinned] = useState(announcement?.isPinned ?? false);
  const [requiresAck, setRequiresAck] = useState(announcement?.requiresAck ?? false);
  const [publishAt, setPublishAt] = useState(announcement?.publishAt?.slice(0, 16) ?? "");
  const [expiresAt, setExpiresAt] = useState(announcement?.expiresAt?.slice(0, 16) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        title,
        body,
        isPinned,
        requiresAck,
        publishAt: publishAt || null,
        expiresAt: expiresAt || null,
      };
      const result = announcement
        ? await fetchJson<{ announcement: Announcement }>(`/api/announcements/${announcement.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await fetchJson<{ announcement: Announcement }>("/api/announcements", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      onSaved(result.announcement);
      if (!announcement) {
        setTitle("");
        setBody("");
        setIsPinned(false);
        setRequiresAck(false);
        setPublishAt("");
        setExpiresAt("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save announcement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-md border border-dashed border-border p-4">
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={300} />
      <Textarea placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} required maxLength={20000} rows={4} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Publish at (optional)
          <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Expires at (optional)
          <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
          Pinned
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} />
          Requires acknowledgement
        </label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : announcement ? "Save changes" : "Create announcement"}
        </Button>
        {announcement && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
