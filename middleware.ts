import { type NextRequest, NextResponse } from "next/server"
import {
  canAttemptRefresh,
  isAccessTokenExpired,
  parseSupabaseAuthSession,
} from "@/lib/auth/session-cookie"

function isPublicAuthPath(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/forgot-password") ||
    pathname.startsWith("/auth/update-password")
  )
}

function isAutomationEndpoint(pathname: string) {
  return (
    pathname.startsWith("/api/automations/run") ||
    pathname.startsWith("/api/automations/deposit-reminder") ||
    pathname.startsWith("/api/automations/post-event-reminder")
  )
}

function clearAuthCookies(response: NextResponse, request: NextRequest) {
  const secure = request.nextUrl.protocol === "https:"
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.includes("-auth-token")) continue
    response.cookies.set(cookie.name, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
  }
}

function unauthenticatedResponse(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 })
  }
  if (isPublicAuthPath(pathname)) {
    return NextResponse.next()
  }
  const login = request.nextUrl.clone()
  login.pathname = "/login"
  login.searchParams.set("next", pathname)
  const response = NextResponse.redirect(login)
  clearAuthCookies(response, request)
  return response
}

/**
 * Auth Edge sans appel réseau Supabase (évite les timeouts Vercel).
 * - cookie absent / illisible → login
 * - access token expiré sans refresh token → login + purge cookies
 * - sinon laisse passer ; le refresh se fait côté navigateur (AuthSessionKeeper)
 *   et dans les API Node via getUser().
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isAutomationEndpoint(pathname)) {
    return NextResponse.next()
  }

  const cookies = request.cookies.getAll()
  const session = parseSupabaseAuthSession(cookies)
  const hasAuthCookie = cookies.some((cookie) => cookie.name.includes("-auth-token"))

  if (!hasAuthCookie) {
    return unauthenticatedResponse(request)
  }

  // Cookie présent mais illisible, ou access expiré sans refresh possible.
  if (
    !session ||
    (isAccessTokenExpired(session) && !canAttemptRefresh(session))
  ) {
    return unauthenticatedResponse(request)
  }

  if (pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
}
