export { auth as middleware } from '@/lib/auth-config';

export const config = {
  matcher: [
    '/settings/:path*',
    '/library/:path*',
    '/points/:path*',
    '/history/:path*',
    '/data/:path*',
  ],
};
