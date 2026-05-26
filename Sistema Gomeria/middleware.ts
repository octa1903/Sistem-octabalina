import { next } from '@vercel/edge';

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};

export default function middleware(req: Request): Response {
  const user = process.env.SITE_USER;
  const pass = process.env.SITE_PASS;

  if (!user || !pass) {
    return next();
  }

  const auth = req.headers.get('authorization');
  const expected = 'Basic ' + btoa(`${user}:${pass}`);

  if (auth === expected) {
    return next();
  }

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Sistema Octabalina", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
