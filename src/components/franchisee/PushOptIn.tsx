"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, X } from "lucide-react";
import { isPushSupported, subscribeToPush } from "./pushSubscribe";

const DISMISS_KEY = "kick-push-optin-dismissed";

export function PushOptIn() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    const alreadyGranted = typeof Notification !== "undefined" && Notification.permission === "granted";
    setVisible(!dismissed && isPushSupported() && !alreadyGranted);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function enable() {
    setBusy(true);
    try {
      await subscribeToPush();
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
