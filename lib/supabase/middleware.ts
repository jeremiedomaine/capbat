import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

function resolvePublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  return { url, key }
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isAutomationEndpoint = pathname.startsWith("/api/automations/deposit-reminder")
  if (isAutomationEndpoint) {
    return NextResponse.next({ request })
  }

  const { url: supabaseUrl, key: supabaseKey } = resolvePublicSupabaseConfig()
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "[middleware] NEXT_PUBLIC_SUPABASE_URL ou clé publique manquante (PUBLISHABLE_KEY ou ANON_KEY)."
    )
    if (
      pathname.startsWith("/login") ||
      pathname.startsWith("/auth/forgot-password") ||
      pathname.startsWith("/auth/update-password")
    ) {
      return NextResponse.next({ request })
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 503 })
    }
    const login = request.nextUrl.clone()
    login.pathname = "/login"
    login.searchParams.set("error", "config")
    return NextResponse.redirect(login)
  }

  try {
    let response = NextResponse.next({ request })

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.warn("[middleware] auth.getUser:", authError.message)
    }

    const isLogin = pathname.startsWith("/login")
    const isPublicAuth =
      isLogin ||
      pathname.startsWith("/auth/forgot-password") ||
      pathname.startsWith("/auth/update-password")

    if (!user) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Non autorisé." }, { status: 401 })
      }
      if (!isPublicAuth) {
        const url = request.nextUrl.clone()
        url.pathname = "/login"
        url.searchParams.set("next", pathname)
        return NextResponse.redirect(url)
      }
      return response
    }

    if (user && isLogin) {
      return NextResponse.redirect(new URL("/", request.url))
    }

    return response
  } catch (error) {
    console.error("[middleware]", error)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Middleware indisponible." }, { status: 503 })
    }
    const login = request.nextUrl.clone()
    login.pathname = "/login"
    return NextResponse.redirect(login)
  }
}
