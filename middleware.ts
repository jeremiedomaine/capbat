import { type NextRequest, NextResponse } from "next/server"

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

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.includes("-auth-token"))
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isAutomationEndpoint(pathname)) {
    return NextResponse.next()
  }

  const signedIn = hasSupabaseAuthCookie(request)

  if (!signedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 })
    }
    if (isPublicAuthPath(pathname)) {
      return NextResponse.next()
    }
    const login = request.nextUrl.clone()
    login.pathname = "/login"
    login.searchParams.set("next", pathname)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
}
