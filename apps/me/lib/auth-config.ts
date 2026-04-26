import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { CustomPrismaAdapter } from '@/lib/auth-adapter';
import { prisma } from '@/lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: CustomPrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Trust Google's email_verified flag — when true, mark the user as
      // email-verified at sign-in so we don't bug them with our own link.
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email,
          name: profile.name,
          image: profile.picture,
          emailVerified: profile.email_verified ? new Date() : null,
        } as { id: string; email: string; name: string; image: string; emailVerified: Date | null };
      },
    }),
    Credentials({
      // Email + password fallback. We require emailVerified before allowing
      // sign-in so the verification flow stays meaningful.
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase();
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
          // Either no such user, or the user signed up with OAuth and has no
          // password set. Don't leak which by returning a generic null.
          return null;
        }
        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        if (!user.emailVerified) {
          // Surface as a thrown error so the login page can show "verify your
          // email first" rather than silent reject. NextAuth will route this
          // to the error= query param.
          throw new Error('EmailNotVerified');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName ?? null,
          image: user.avatarUrl ?? null,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;

      // Hardened: every step is independently try/caught so a failure here
      // can never crash the auth flow. Earlier versions of this handler let
      // a thrown exception bubble up and 500'd the OAuth callback.
      try {
        // Generate an 8-char Passport code (unambiguous chars, collision-safe)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for (let attempt = 0; attempt < 5; attempt++) {
          let code = '';
          for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
          try {
            await prisma.user.update({ where: { id: user.id }, data: { passportCode: code } });
            break;
          } catch {
            // collision on unique constraint — retry with a new code
          }
        }
      } catch (err) {
        console.error('[auth] Failed to set passportCode:', err);
      }

      try {
        // Auto-issue Passport Pioneer badge to new users
        const badge = await prisma.passportBadge.findUnique({ where: { slug: 'passport-pioneer' } });
        if (!badge || badge.retiredAt) return;
        if (badge.maxSupply && badge.totalIssued >= badge.maxSupply) return;

        await prisma.$transaction([
          prisma.userBadge.create({
            data: {
              userId: user.id,
              badgeId: badge.id,
              issuedBy: 'afterroar',
              reason: 'Early Passport adopter',
            },
          }),
          prisma.passportBadge.update({
            where: { id: badge.id },
            data: { totalIssued: { increment: 1 } },
          }),
        ]);
      } catch (err) {
        console.error('[auth] Failed to issue Pioneer badge:', err);
      }
    },
  },
});
