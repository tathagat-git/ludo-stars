import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

/**
 * Augment next-auth types so that `id` and `username` travel through the
 * JWT -> session pipeline. Both the Credentials provider and the `jwt` /
 * `session` callbacks in `src/lib/auth.ts` rely on these augmentations.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    username: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    username?: string;
  }
}
