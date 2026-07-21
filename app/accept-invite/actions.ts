"use server";

import { acceptInvitation } from "@/server/auth/invitations";

export type ActionResult = { ok: boolean; message: string };

/** Consumes the invitation token and creates the account. */
export async function acceptInvitationAction(token: string, password: string): Promise<ActionResult> {
  if (!token) return { ok: false, message: "That invitation link is invalid." };

  const result = await acceptInvitation(token, password);
  return result.ok
    ? { ok: true, message: "Account created. You can now sign in." }
    : { ok: false, message: result.message };
}
