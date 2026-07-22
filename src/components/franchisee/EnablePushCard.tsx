"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPushSupported, subscribeToPush } from "./pushSubscribe";

type PushState = "idle" | "busy" | "enabled" | "blocked" | "unsupported";

/** "Never Miss an Update" right-rail card — wires the existing push-subscribe flow. */
export function EnablePushCard() {
  // Start as "unsupported" (renders nothing) until mounted, so SSR and the
  // first client render agree regardless of browser capabilities.
  const [state, setState] = useState<PushState>("unsupported");

  useEffect(() => {
    if (!isPushSupported()) return;
    setState(Notification.permission === "granted" ? "enabled" : Notification.permission === "denied" ? "blocked" : "idle");
  }, []);

  if (state === "unsupported") return null;

  async function enable() {
    setState("busy");
    try {
      // Permission prompt fires here, on the click — never on page load.
      const permission = await subscribeToPush();
      setState(permission === "granted" ? "enabled" : permission === "denied" ? "blocked" : "idle");
    } catch {
      toast.error("Couldn't enable notifications — try again.");
      setState("idle");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bell className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-semibold">Never Miss an Update</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Enable push notifications to get instant alerts for new announcements.
      </p>
      <div className="mt-3">
        {state === "enabled" ? (
          <p className="flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Notifications enabled
          </p>
        ) : state === "blocked" ? (
          <p className="text-sm text-muted-foreground">
            Notifications are blocked — allow them for this site in your browser settings.
          </p>
        ) : (
          <Button size="sm" className="w-full" onClick={enable} disabled={state === "busy"}>
            {state === "busy" ? "Enabling…" : "Enable Notifications"}
          </Button>
        )}
      </div>
    </div>
  );
}
