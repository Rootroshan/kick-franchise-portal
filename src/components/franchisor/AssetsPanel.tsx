"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchJson } from "@/lib/fetchJson";

type Asset = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  status: "ACTIVE" | "ARCHIVED" | "DEPRECATED";
  mime: string;
  sizeBytes: number;
  version: number;
};

export function AssetsPanel({ initialAssets }: { initialAssets: Asset[] }) {
  const [assets, setAssets] = useState(initialAssets);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (a.status === "ARCHIVED") return false;
      if (category && a.category !== category) return false;
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [assets, category, search]);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file to upload");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const { uploadUrl, storageKey } = await fetchJson<{ uploadUrl: string; storageKey: string }>("/api/assets/upload-url", {
        method: "POST",
        body: JSON.stringify({ mime: file.type, sizeBytes: file.size }),
      });

      const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("Upload to storage failed");

      const { asset } = await fetchJson<{ asset: Asset }>("/api/assets", {
        method: "POST",
        body: JSON.stringify({
          name: nameRef.current?.value || file.name,
          type: file.type.split("/")[0] || "file",
          category: categoryInputRef.current?.value || undefined,
          mime: file.type,
          sizeBytes: file.size,
          storageKey,
        }),
      });

      setAssets((prev) => [asset, ...prev]);
      if (fileRef.current) fileRef.current.value = "";
      if (nameRef.current) nameRef.current.value = "";
      if (categoryInputRef.current) categoryInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function archive(assetId: string) {
    try {
      const { asset } = await fetchJson<{ asset: Asset }>(`/api/assets/${assetId}/archive`, { method: "POST" });
      setAssets((prev) => prev.map((a) => (a.id === assetId ? asset : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive asset");
    }
  }

  async function download(assetId: string) {
    try {
      const { url } = await fetchJson<{ url: string }>(`/api/assets/${assetId}/download`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get download link");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onUpload} className="flex flex-col gap-2 rounded-md border border-dashed border-border p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-sm">File</label>
          <input ref={fileRef} type="file" className="block w-full text-sm" required />
        </div>
        <div className="flex-1">
          <Input ref={nameRef} placeholder="Name (optional)" />
        </div>
        <div className="flex-1">
          <Input ref={categoryInputRef} placeholder="Category (optional)" />
        </div>
        <Button type="submit" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-64" />
        <Input placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" />
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{a.name}</span>
              <Badge variant="outline">v{a.version}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {a.category ?? "Uncategorized"} · {(a.sizeBytes / 1024).toFixed(0)} KB
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => download(a.id)}>
                Download
              </Button>
              <Button size="sm" variant="ghost" onClick={() => archive(a.id)}>
                Archive
              </Button>
            </div>
          </li>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No assets match.</p>}
      </ul>
    </div>
  );
}
