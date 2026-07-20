import type { DefaultSession } from "next-auth";

/**
 * requestContext.ts looks up Membership by User.id, so the session must expose
 * it. NextAuth's default Session.user has no `id` — the session callback in
 * server/auth/config.ts populates it and this declaration makes it typed.
 */
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
