"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Download } from "lucide-react";

type AssetItem = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  mime: string;
};

export function AssetGrid({ assets }: { assets: AssetItem[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set(assets.map((a) => a.category).filter((c): c is string => !!c));
    return Array.from(set).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      const matchesSearch = !q || a.name.toLowerCase().includes(q);
      const matchesCategory = category === "all" || a.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [assets, search, category]);

  async function download(id: string, name: string) {
    setDownloadingId(id);
    try {
      // Always fetch a fresh signed URL — it expires in 5 min, never cache/reuse.
      const res = await fetch(`/api/assets/${id}/download`);
      if (!res.ok) throw new Error("Failed to get download link");
      const { url } = await res.json();
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert("Couldn't download this file — try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input placeholder="Search assets…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-32 shrink-0">
          <option value="all">All</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 && <p className="text-sm text-muted-foreground">No assets match.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {filtered.map((asset) => (
          <Card key={asset.id}>
            <CardContent className="flex aspect-square items-center justify-center p-3">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-2 p-3 pt-0">
              <p className="line-clamp-2 text-xs font-medium">{asset.name}</p>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => download(asset.id, asset.name)}
                disabled={downloadingId === asset.id}
              >
                <Download className="h-3.5 w-3.5" />
                {downloadingId === asset.id ? "…" : "Download"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
