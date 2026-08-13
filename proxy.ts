import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { JWT } from 'next-auth/jwt';
import type { Session } from 'next-auth';
import authConfig from './auth.config';

const SESSION_COOKIE_SUFFIX = 'authjs.session-token';

type SessionToken = JWT & {
  id?: string;
  role?: string;
  provider?: string;
  rememberMe?: boolean;
};

function getSessionCookieName(request: Request) {
  const secureCookie = request.url.startsWith('https://');
  return `${secureCookie ? '__Secure-' : ''}${SESSION_COOKIE_SUFFIX}`;
}

function getSessionCookieChunks(req: NextRequest, cookieName: string) {
  return req.cookies
    .getAll()
    .filter((cookie) => cookie.name === cookieName || cookie.name.startsWith(`${cookieName}.`));
}

function toMutableResponse(response: Response) {
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function toClientSession(session: SessionToken | null) {
  if (!session || typeof session.exp !== 'number') return null;

  return {
    user: {
      id: session.id,
      name: session.name,
      email: session.email,
      image: session.picture,
      role: session.role,
      provider: session.provider,
      rememberMe: session.rememberMe,
    },
    expires: new Date(session.exp * 1000).toISOString(),
  };
}

function applyFixedSessionCookie(req: NextRequest, response: Response, session: SessionToken | null) {
  if (!session || typeof session.exp !== 'number') return;

  const cookieName = getSessionCookieName(req);
  const cookieChunks = getSessionCookieChunks(req, cookieName);

  if (cookieChunks.length === 0) return;

  const expiresAt = session.exp;
  const maxAge = Math.max(expiresAt - Math.floor(Date.now() / 1000), 0);
  const expires = new Date(expiresAt * 1000).toUTCString();
  const secure = cookieName.startsWith('__Secure-') ? '; Secure' : '';

  for (const cookie of cookieChunks) {
    response.headers.append(
      'Set-Cookie',
      `${cookie.name}=${cookie.value}; Path=/; Max-Age=${maxAge}; Expires=${expires}; HttpOnly; SameSite=Lax${secure}`
    );
  }
}

export default async function proxy(req: NextRequest) {
  const session = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: req.nextUrl.protocol === 'https:',
  }) as SessionToken | null;

  if (req.nextUrl.pathname === '/api/auth/session') {
    const response = NextResponse.json(toClientSession(session), {
      headers: {
        'Cache-Control': 'private, no-cache, no-store',
        Expires: '0',
        Pragma: 'no-cache',
      },
    });
    applyFixedSessionCookie(req, response, session);
    return response;
  }

  const authSession: Session | null = session
    ? {
        user: {
          id: session.id ?? '',
          name: session.name,
          email: session.email,
          role: session.role,
          provider: session.provider,
          rememberMe: session.rememberMe,
        },
        expires:
          typeof session.exp === 'number'
            ? new Date(session.exp * 1000).toISOString()
            : new Date().toISOString(),
      }
    : null;

  const authorized = await authConfig.callbacks?.authorized?.({
    request: req,
    auth: authSession,
  });

  let finalResponse: Response = NextResponse.next();

  if (authorized instanceof Response) {
    finalResponse = toMutableResponse(authorized);
  } else if (authorized === false) {
    const signInPage = authConfig.pages?.signIn ?? "/signin";
    if (req.nextUrl.pathname !== signInPage) {
      const signInUrl = req.nextUrl.clone();
      signInUrl.pathname = signInPage;
      signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
      finalResponse = NextResponse.redirect(signInUrl);
    }
  }

  applyFixedSessionCookie(req, finalResponse, session);

  return finalResponse;
}

export const config = {
  matcher: ['/api/auth/session', '/((?!api|_next/static|_next/image|favicon\\.ico|images).*)'],
};
