"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetchJson";
import { ASSET_CATEGORIES } from "@/server/modules/assets/schemas";

type AssetLike = { id: string; name: string; category: string | null };

export function EditAssetMetadataDialog({ asset, onClose, onSaved }: { asset: AssetLike; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(asset.name);
  const [category, setCategory] = useState(asset.category ?? ASSET_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Asset name is required.");
    setSaving(true);
    try {
      await fetchJson(`/api/assets/${asset.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim(), category }) });
      toast.success("Asset updated.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
          <DialogClose onClick={onClose} />
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-asset-name">Asset name</Label>
            <Input id="edit-asset-name" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-asset-category">Category</Label>
            <Select id="edit-asset-category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={saving}>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
