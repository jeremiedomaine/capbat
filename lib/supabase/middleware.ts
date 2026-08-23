import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabasePublicKey, getSupabasePublicUrl } from "@/lib/supabase/env-public"

const AUTH_FETCH_TIMEOUT_MS = 2500

function resolvePublicSupabaseConfig() {
  return { url: getSupabasePublicUrl(), key: getSupabasePublicKey() }
}

function isPublicAuthPath(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/forgot-password") ||
    pathname.startsWith("/auth/update-password")
  )
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.includes("-auth-token"))
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS)
  const abortFromInit = () => controller.abort()
  init?.signal?.addEventListener("abort", abortFromInit)
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer)
    init?.signal?.removeEventListener("abort", abortFromInit)
  })
}

function unauthenticatedResponse(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 })
  }
  if (isPublicAuthPath(pathname)) {
    return NextResponse.next({ request })
  }
  const url = request.nextUrl.clone()
  url.pathname = "/login"
  url.searchParams.set("next", pathname)
  return NextResponse.redirect(url)
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isAutomationEndpoint =
    pathname.startsWith("/api/automations/run") ||
    pathname.startsWith("/api/automations/deposit-reminder") ||
    pathname.startsWith("/api/automations/post-event-reminder")
  if (isAutomationEndpoint) {
    return NextResponse.next({ request })
  }

  const { url: supabaseUrl, key: supabaseKey } = resolvePublicSupabaseConfig()
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "[middleware] NEXT_PUBLIC_SUPABASE_URL ou clé publique manquante (PUBLISHABLE_KEY ou ANON_KEY)."
    )
    if (isPublicAuthPath(pathname)) {
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

  if (!hasSupabaseAuthCookie(request)) {
    return unauthenticatedResponse(request)
  }

  try {
    let response = NextResponse.next({ request })

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      global: {
        fetch: fetchWithTimeout,
      },
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

    const { data, error: authError } = await supabase.auth.getClaims()
    const user = data?.claims

    if (authError) {
      console.warn("[middleware] auth.getClaims:", authError.message)
    }

    if (!user) {
      return unauthenticatedResponse(request)
    }

    if (pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/", request.url))
    }

    return response
  } catch (error) {
    console.error("[middleware]", error)
    // Cookie présent mais Auth trop lent / coupé : ne pas rediriger en boucle.
    if (pathname.startsWith("/api/")) {
      return NextResponse.next({ request })
    }
    if (isPublicAuthPath(pathname)) {
      return NextResponse.next({ request })
    }
    return NextResponse.next({ request })
  }
}
