import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

const MIDDLEWARE_BUDGET_MS = 8000

function fallbackResponse(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Middleware indisponible." }, { status: 503 })
  }
  const login = request.nextUrl.clone()
  login.pathname = "/login"
  return NextResponse.redirect(login)
}

export async function middleware(request: NextRequest) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MIDDLEWARE_BUDGET_MS)
  try {
    return await Promise.race([
      updateSession(request, controller.signal),
      new Promise<NextResponse>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error("middleware budget exceeded"))
        })
      }),
    ])
  } catch (error) {
    console.error("[middleware] invocation failed", error)
    return fallbackResponse(request)
  } finally {
    clearTimeout(timer)
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
}
