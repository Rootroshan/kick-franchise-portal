"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Permitted-content search box (§29). Submits to /franchisor/search which only
 * queries announcements, artwork, tasks, onboarding templates, stores, and
 * franchisee users — never commerce records.
 */
export function FranchisorSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        if (term) router.push(`/franchisor/search?q=${encodeURIComponent(term)}`);
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search announcements, tasks, stores…"
        aria-label="Search brand content"
        className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </form>
  );
}
