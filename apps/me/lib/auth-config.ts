import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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

      // Auto-issue Passport Pioneer badge to new users
      try {
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
