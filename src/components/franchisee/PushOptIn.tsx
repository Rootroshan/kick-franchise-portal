"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, X } from "lucide-react";

const DISMISS_KEY = "kick-push-optin-dismissed";

/** Standard VAPID applicationServerKey conversion: URL-safe base64 -> Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function PushOptIn() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    const alreadyGranted = typeof Notification !== "undefined" && Notification.permission === "granted";
    setVisible(!dismissed && supported && !alreadyGranted);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        dismiss();
        return;
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("Push not configured");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      });
      dismiss();
    } catch {
      dismiss();
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <Bell className="h-5 w-5 shrink-0 text-primary" />
        <p className="flex-1 text-xs">Get notified about new announcements and tasks.</p>
        <Button size="sm" onClick={enable} disabled={busy}>
          Enable
        </Button>
        <button aria-label="Dismiss" onClick={dismiss} className="text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}
