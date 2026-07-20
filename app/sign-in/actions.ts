"use server";

import { headers } from "next/headers";
import { authPrisma } from "@/server/db/authClient";
import { verifyPassword } from "@/server/auth/password";
import {
  loginInputSchema,
  validatePortalLogin,
  validateAdminLogin,
  type LoginOutcome,
} from "@/server/auth/loginValidation";

/**
 * Pre-flight authorisation check for the brand portals.
 *
 * The client calls this BEFORE NextAuth's signIn() so a rejection (wrong
 * portal, no store, wrong brand) can be shown inline instead of bouncing
 * through an error redirect. It never issues a session — signIn() still does
 * that, and the middleware plus requestContext.ts still gate every request, so
 * this cannot become the only line of defence.
 *
 * The host is read from the request headers server-side; a client-supplied
 * tenant or redirect is never consulted.
 */
export async function checkPortalLoginAction(input: {
  email: string;
  password: string;
  role: string;
}): Promise<LoginOutcome> {
  const parsed = loginInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Incorrect email or password for this portal." };
  }

  const { email, password, role } = parsed.data;

  const user = await authPrisma.user.findUnique({ where: { email } });
  // One message for unknown address, OAuth-only account, wrong password and
  // deactivated user — anything finer confirms which addresses are registered.
  if (!user?.passwordHash || !user.isActive || !(await verifyPassword(user.passwordHash, password))) {
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Incorrect email or password for this portal." };
  }

  const host = (await headers()).get("host") ?? "";
  return validatePortalLogin(user.id, host, role);
}

/** Same pre-flight for the KICK Super Admin login, which has no role selector. */
export async function checkAdminLoginAction(input: {
  email: string;
  password: string;
}): Promise<LoginOutcome> {
  const email = input.email.trim().toLowerCase();

  const user = await authPrisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !user.isActive || !(await verifyPassword(user.passwordHash, input.password))) {
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Incorrect email or password." };
  }

  return validateAdminLogin(user.id);
}
