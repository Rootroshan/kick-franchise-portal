"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { fetchJson } from "@/lib/fetchJson";

type Member = {
  id: string;
  clerkUserId: string;
  role: "KICK_ADMIN" | "FRANCHISOR_ADMIN" | "FRANCHISEE_USER";
  email: string | null;
  displayName: string | null;
  locationId: string | null;
};

export function MembersPanel({ tenantId, initialMembers }: { tenantId: string; initialMembers: Member[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [clerkUserId, setClerkUserId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"FRANCHISOR_ADMIN" | "FRANCHISEE_USER">("FRANCHISOR_ADMIN");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { membership } = await fetchJson<{ membership: Member }>(`/api/admin/tenants/${tenantId}/members`, {
        method: "POST",
        body: JSON.stringify({ clerkUserId, email: email || undefined, role }),
      });
      setMembers((prev) => {
        const withoutDupe = prev.filter((m) => m.id !== membership.id);
        return [...withoutDupe, membership];
      });
      setClerkUserId("");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite member");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <span>{m.displayName || m.email || m.clerkUserId}</span>
            <Badge variant="outline">{m.role}</Badge>
          </li>
        ))}
        {members.length === 0 && <p className="text-sm text-muted-foreground">No members yet.</p>}
      </ul>

      {/* lg:, not sm: — this form sits in the Brand Detail two-column grid,
          where the column can be ~650px wide at a viewport that's still
          well under the sm breakpoint's real-world column width. sm:
          matches viewport width, not this container's width, so it forced
          4 fields onto one row at 1024px and truncated every placeholder. */}
      <form onSubmit={onSubmit} className="grid gap-2 lg:grid-cols-[1fr_1fr_auto_auto]">
        <Input placeholder="Clerk user ID" value={clerkUserId} onChange={(e) => setClerkUserId(e.target.value)} required />
        <Input placeholder="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="FRANCHISOR_ADMIN">Franchisor Admin</option>
          <option value="FRANCHISEE_USER">Franchisee User</option>
        </Select>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Inviting…" : "Invite"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
