"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud, FileImage, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetchJson";
import { ASSET_CATEGORIES } from "@/server/modules/assets/schemas";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "application/zip", "video/"];

type BrandOption = { value: string; label: string };

type Props = {
  /** Where to send the browser after a successful upload. */
  returnTo: string;
  /** Brand selector — KICK_ADMIN only. Omit for franchisor uploads (tenant is implicit). */
  brandOptions?: BrandOption[];
  /**
   * Fixed target tenant — KICK_ADMIN replace flow only, where the brand is
   * dictated by the asset being replaced rather than picked from a selector.
   * Omit for franchisor uploads (tenant is server-derived from the session).
   */
  fixedTenantId?: string;
  /** Present when this form is replacing an existing asset with a new version. */
  replaces?: { id: string; name: string; category: string | null; type: string };
};

export function UploadArtworkForm({ returnTo, brandOptions, fixedTenantId, replaces }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(replaces?.name ?? "");
  const [category, setCategory] = useState(replaces?.category ?? ASSET_CATEGORIES[0]);
  const [tenantId, setTenantId] = useState(brandOptions?.[0]?.value ?? "");
  const [versionNotes, setVersionNotes] = useState("");
  const [publishActive, setPublishActive] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  function pickFile(f?: File) {
    if (!f) return;
    if (!ALLOWED_MIME_PREFIXES.some((p) => f.type.startsWith(p))) {
      toast.error("Unsupported file type. Use an image, PDF, ZIP, or video file.");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      toast.error("File exceeds the 50 MB limit.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    if (!name.trim()) return toast.error("Asset name is required.");
    if (!category) return toast.error("Category is required.");
    if (!file) return toast.error("Choose a file to upload.");
    if (brandOptions && !tenantId) return toast.error("Choose a brand.");

    // KICK_ADMIN must always name the target brand — from the selector on new
    // uploads, or fixed to the replaced asset's brand on the replace flow.
    // Franchisors send nothing; their tenant is derived server-side.
    const targetTenantId = brandOptions ? tenantId : fixedTenantId;

    setUploading(true);
    setProgress(0);
    try {
      const signed = await fetchJson<{ uploadUrl: string; storageKey: string }>("/api/assets/upload-url", {
        method: "POST",
        body: JSON.stringify({ mime: file.type, sizeBytes: file.size, ...(targetTenantId ? { tenantId: targetTenantId } : {}) }),
      });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signed.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (event) => event.lengthComputable && setProgress(Math.round((event.loaded / event.total) * 100));
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      await fetchJson("/api/assets", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          type: replaces?.type ?? category.toLowerCase().replace(/\s+/g, "-"),
          category,
          mime: file.type,
          sizeBytes: file.size,
          storageKey: signed.storageKey,
          replacesId: replaces?.id ?? null,
          versionNotes: versionNotes.trim() || null,
          publishActive,
          ...(targetTenantId ? { tenantId: targetTenantId } : {}),
        }),
      });

      toast.success(replaces ? "New version uploaded." : "Artwork uploaded.");
      router.push(returnTo);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      {brandOptions && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="artwork-brand">Brand</Label>
          <Select id="artwork-brand" value={tenantId} onChange={(e) => setTenantId(e.target.value)} disabled={uploading}>
            {brandOptions.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="artwork-name">Asset name</Label>
        <Input id="artwork-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Burger Xpress Logo" disabled={uploading} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="artwork-category">Category</Label>
        <Select id="artwork-category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={uploading || !!replaces}>
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="artwork-notes">Version notes (optional)</Label>
        <Textarea
          id="artwork-notes"
          value={versionNotes}
          onChange={(e) => setVersionNotes(e.target.value)}
          placeholder="What changed in this upload?"
          disabled={uploading}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>File</Label>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-background p-6 text-center hover:border-primary/50 disabled:opacity-60"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, no permanent asset URL exists yet.
            <img src={preview} alt="" className="h-24 w-24 rounded object-cover" />
          ) : file ? (
            <FileImage className="h-8 w-8 text-muted-foreground" />
          ) : (
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">{file ? file.name : "Click to choose a file"}</span>
          <span className="text-xs text-muted-foreground">Images, PDF, ZIP, or video — up to 50 MB</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          accept="image/*,application/pdf,application/zip,video/*"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        {uploading && (
          <div className="mt-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Uploading artwork… {progress}%</p>
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={publishActive} onChange={(e) => setPublishActive(e.target.checked)} disabled={uploading} className="h-4 w-4 rounded border-input accent-primary" />
        Publish as Active immediately
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.push(returnTo)} disabled={uploading}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {uploading ? "Uploading…" : replaces ? "Upload New Version" : "Upload Artwork"}
        </Button>
      </div>
    </div>
  );
}
