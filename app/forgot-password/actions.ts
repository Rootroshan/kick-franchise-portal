"use server";

import { createResetToken, resetPasswordWithToken } from "@/server/auth/passwordReset";
import { getEnv } from "@/lib/env";

export type ActionResult = { ok: boolean; message: string };

/**
 * Requests a password reset link.
 *
 * ALWAYS reports success, even for an unknown address — telling the caller
 * "no account found" turns this endpoint into a way to test which emails are
 * registered.
 */
export async function requestResetAction(email: string): Promise<ActionResult> {
  const generic = {
    ok: true,
    message: "If an account exists for that address, a reset link is on its way.",
  };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { ok: false, message: "Enter a valid email address." };
  }

  try {
    const token = await createResetToken(email);
    if (!token) return generic; // unknown or inactive account

    const base = getEnv().APP_BASE_DOMAIN;
    const link = `https://${base}/forgot-password?token=${token}`;
    const resendKey = getEnv().RESEND_API_KEY;

    if (!resendKey) {
      // Email is not configured. Log the link so an operator can still complete
      // a reset, rather than silently doing nothing.
      console.warn(`[password-reset] RESEND_API_KEY unset — link for ${email}: ${link}`);
      return generic;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: getEnv().RESEND_FROM_EMAIL,
        to: email.trim(),
        subject: "Reset your KICK password",
        text: `Use this link to reset your password. It expires in one hour.\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
      }),
    });

    if (!res.ok) console.error("[password-reset] Resend rejected the send", res.status);
  } catch (err) {
    console.error("[password-reset] failed", err);
  }

  return generic;
}

/** Consumes the token and sets the new password. */
export async function resetPasswordAction(token: string, password: string): Promise<ActionResult> {
  if (!token) return { ok: false, message: "That reset link is invalid." };

  const result = await resetPasswordWithToken(token, password);
  return result.ok
    ? { ok: true, message: "Password updated. You can now sign in." }
    : { ok: false, message: result.message };
}
