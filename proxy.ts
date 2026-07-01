import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export const proxy = auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;
  const isLoginPage = nextUrl.pathname.startsWith('/admin/login');

  // Let the login page through always
  if (isLoginPage) return NextResponse.next();

  // Protect all other /admin/* routes
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/admin/login', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*'],
};
