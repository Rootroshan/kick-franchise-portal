"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "@/app/(franchisee)/profile/actions";

/** Inline edit for the caller's own display name and phone — nothing else is editable. */
export function EditProfileDialog({ displayName, phone }: { displayName: string; phone: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(displayName);
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await updateProfileAction({ displayName: name, phone: phoneValue });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    toast.success("Profile updated.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit profile
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogClose onClick={() => setOpen(false)} />
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-name">Display name</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-phone">Phone (optional)</Label>
              <Input id="profile-phone" type="tel" value={phoneValue} onChange={(e) => setPhoneValue(e.target.value)} maxLength={30} placeholder="e.g. 416-555-0100" />
            </div>
            <p className="text-xs text-muted-foreground">
              Your role, brand and store are managed by your franchise administrator and cannot be changed here.
            </p>
            {error && <p className="text-sm text-status-error" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
