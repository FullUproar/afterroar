import type { Adapter, AdapterUser, AdapterAccount, AdapterSession } from "@auth/core/adapters";
import type { PrismaClient, User as PrismaUser } from "@prisma/client";

/* ------------------------------------------------------------------ */
/*  Custom Prisma adapter for NextAuth                                 */
/*                                                                      */
/*  The default @auth/prisma-adapter assumes the User model has fields */
/*  named `name`, `image`, and `emailVerified`. Our shared User schema */
/*  uses `displayName` and `avatarUrl` (plus we now have emailVerified).*/
/*  Rather than rename the columns and break the ops + HQ apps, this   */
/*  adapter translates field names at the boundary.                    */
/*                                                                      */
/*  Implements the full Adapter interface for next-auth v5. JWT        */
/*  sessions don't need DB session methods, but we implement them so   */
/*  switching to database sessions later is a one-line config change.  */
/* ------------------------------------------------------------------ */

function userToAdapter(u: PrismaUser): AdapterUser {
  return {
    id: u.id,
    email: u.email,
    emailVerified: u.emailVerified ?? null,
    name: u.displayName ?? null,
    image: u.avatarUrl ?? null,
  };
}

export function CustomPrismaAdapter(prisma: PrismaClient): Adapter {
  return {
    async createUser(data) {
      // NextAuth passes { name, email, emailVerified, image } — translate to schema.
      //
      // Note: this adapter is only hit by OAuth signups (Google). The
      // Credentials signup path at /api/auth/signup writes to the User
      // table directly and never goes through here. So we can safely
      // default emailVerified to a Date when none is supplied — every
      // user reaching this code path came in via an OAuth provider
      // whose token already proves email ownership. NextAuth v5 strips
      // emailVerified from the profile() return value before it hits
      // the adapter (it's an AdapterUser-only field), which is why the
      // Google profile callback's "emailVerified: profile.email_verified
      // ? new Date() : null" line can't actually carry through to here.
      const user = await prisma.user.create({
        data: {
          email: data.email,
          displayName: data.name ?? null,
          avatarUrl: data.image ?? null,
          emailVerified: data.emailVerified ?? new Date(),
        },
      });
      return userToAdapter(user);
    },

    async getUser(id) {
      const user = await prisma.user.findUnique({ where: { id } });
      return user ? userToAdapter(user) : null;
    },

    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({ where: { email } });
      return user ? userToAdapter(user) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true },
      });
      return account?.user ? userToAdapter(account.user) : null;
    },

    async updateUser({ id, ...data }) {
      if (!id) throw new Error("updateUser called without id");
      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.name !== undefined ? { displayName: data.name } : {}),
          ...(data.image !== undefined ? { avatarUrl: data.image } : {}),
          ...(data.emailVerified !== undefined ? { emailVerified: data.emailVerified } : {}),
        },
      });
      return userToAdapter(user);
    },

    async deleteUser(userId) {
      await prisma.user.delete({ where: { id: userId } });
    },

    async linkAccount(account) {
      await prisma.account.create({
        data: {
          userId: account.userId,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          refresh_token: account.refresh_token ?? null,
          access_token: account.access_token ?? null,
          expires_at: account.expires_at ?? null,
          token_type: account.token_type ?? null,
          scope: account.scope ?? null,
          id_token: account.id_token ?? null,
          session_state:
            account.session_state == null
              ? null
              : typeof account.session_state === "string"
                ? account.session_state
                : JSON.stringify(account.session_state),
        },
      });
      return account as AdapterAccount;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      const account = await prisma.account.delete({
        where: { provider_providerAccountId: { provider, providerAccountId } },
      });
      return {
        ...account,
        type: account.type as AdapterAccount["type"],
      } as AdapterAccount;
    },

    /* ── Session methods (only used if you switch to strategy: 'database'). ── */

    async createSession(_session): Promise<AdapterSession> {
      // JWT sessions — no DB write needed. Returning the input keeps the type
      // contract; callers that use database sessions will need to wire this
      // up against a Session model in the schema (we don't have one today).
      throw new Error("Database sessions are not configured. Use JWT strategy.");
    },

    async getSessionAndUser() {
      return null;
    },

    async updateSession() {
      return null;
    },

    async deleteSession() {
      return;
    },

    /* ── Email verification tokens ── */

    async createVerificationToken(verificationToken) {
      const created = await prisma.verificationToken.create({
        data: {
          identifier: verificationToken.identifier,
          token: verificationToken.token,
          expires: verificationToken.expires,
        },
      });
      return created;
    },

    async useVerificationToken({ identifier, token }) {
      try {
        const used = await prisma.verificationToken.delete({
          where: { identifier_token: { identifier, token } },
        });
        return used;
      } catch {
        return null;
      }
    },
  };
}
