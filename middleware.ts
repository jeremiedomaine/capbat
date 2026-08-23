import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

function isPublicAuthPath(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/forgot-password") ||
    pathname.startsWith("/auth/update-password")
  )
}

function fallbackResponse(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Middleware indisponible." }, { status: 503 })
  }
  if (isPublicAuthPath(pathname)) {
    return NextResponse.next({ request })
  }
  const login = request.nextUrl.clone()
  login.pathname = "/login"
  login.searchParams.set("next", pathname)
  return NextResponse.redirect(login)
}

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch (error) {
    console.error("[middleware] invocation failed", error)
    return fallbackResponse(request)
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
}
