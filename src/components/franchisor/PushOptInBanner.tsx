"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetchJson";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes.buffer;
}

export function PushOptInBanner() {
  const [status, setStatus] = useState<"idle" | "unsupported" | "granted" | "denied" | "subscribing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "granted") setStatus("granted");
    else if (Notification.permission === "denied") setStatus("denied");
  }, []);

  async function enable() {
    setStatus("subscribing");
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "idle");
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("Push notifications are not configured");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = subscription.toJSON();
      await fetchJson("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      });

      setStatus("granted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable notifications");
      setStatus("error");
    }
  }

  if (status === "unsupported" || status === "granted") return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-border bg-muted/50 p-3 text-sm">
      <span className="flex items-center gap-2">
        <Bell className="h-4 w-4" />
        {status === "denied"
          ? "Notifications are blocked in your browser settings."
          : "Enable notifications to hear about new tasks and announcements."}
      </span>
      {status !== "denied" && (
        <Button size="sm" onClick={enable} disabled={status === "subscribing"}>
          {status === "subscribing" ? "Enabling…" : "Enable notifications"}
        </Button>
      )}
      {error && <span className="text-destructive">{error}</span>}
    </div>
  );
}
