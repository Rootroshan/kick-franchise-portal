"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type Props = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  requiresAck: boolean;
  acked: boolean;
  /** Full body view (detail page) vs truncated preview (feed list). */
  full?: boolean;
};

export function AnnouncementCard({ id, title, body, createdAt, requiresAck, acked, full }: Props) {
  const [isAcked, setIsAcked] = useState(acked);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function acknowledge() {
    setLoading(true);
    setError(null);
    setIsAcked(true); // optimistic
    try {
      const res = await fetch(`/api/announcements/${id}/ack`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to acknowledge");
    } catch {
      setIsAcked(false); // roll back
      setError("Couldn't acknowledge — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            {full ? title : <Link href={`/announcements/${id}`}>{title}</Link>}
          </CardTitle>
          {requiresAck && <Badge variant={isAcked ? "success" : "warning"}>{isAcked ? "Acknowledged" : "Ack required"}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{formatDate(createdAt)}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <p className={full ? "whitespace-pre-wrap text-sm" : "line-clamp-2 text-sm text-muted-foreground"}>{body}</p>
        {requiresAck && !isAcked && (
          <div className="mt-3">
            <Button size="sm" onClick={acknowledge} disabled={loading}>
              {loading ? "Acknowledging…" : "Acknowledge"}
            </Button>
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
