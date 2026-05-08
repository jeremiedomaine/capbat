import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch (error) {
    console.error("[middleware] invocation failed", error)
    const pathname = request.nextUrl.pathname
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Middleware indisponible." }, { status: 503 })
    }
    const login = request.nextUrl.clone()
    login.pathname = "/login"
    return NextResponse.redirect(login)
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
