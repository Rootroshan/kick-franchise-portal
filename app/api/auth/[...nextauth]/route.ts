import { handlers } from "@/server/auth/config";

// NextAuth's OAuth callback, session and CSRF endpoints. Public — see
// middleware isPublicRoute — because no session exists during sign-in.
export const { GET, POST } = handlers;
