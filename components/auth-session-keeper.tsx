"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

function isPublicAuthPath(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/forgot-password") ||
    pathname.startsWith("/auth/update-password")
  )
}

const REFRESH_SKEW_SECONDS = 5 * 60
const POLL_MS = 4 * 60 * 1000

/**
 * Garde la session vivante côté navigateur :
 * - refresh proactif avant expiration du JWT
 * - renvoie vers /login si le refresh token est mort
 * Évite l’UI « connectée » avec des API en 401.
 */
export function AuthSessionKeeper() {
  const pathname = usePathname()
  const redirectingRef = useRef(false)

  useEffect(() => {
    if (isPublicAuthPath(pathname)) return

    const supabase = createClient()
    let cancelled = false

    const redirectToLogin = () => {
      if (cancelled || redirectingRef.current) return
      redirectingRef.current = true
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""
      // Remplace sans déclencher une 2ᵉ navigation via onAuthStateChange.
      window.location.replace(`/login${next}`)
    }

    const ensureSession = async () => {
      if (cancelled || redirectingRef.current) return

      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled || redirectingRef.current) return

      const session = sessionData.session
      const expiresAt = session?.expires_at ?? 0
      const now = Math.floor(Date.now() / 1000)
      const needsRefresh = !session || expiresAt <= now + REFRESH_SKEW_SECONDS

      if (!needsRefresh) {
        const { data } = await supabase.auth.getUser()
        if (cancelled || redirectingRef.current) return
        if (data.user) return
      }

      const refreshed = await supabase.auth.refreshSession()
      if (cancelled || redirectingRef.current) return
      const user = refreshed.data.user ?? refreshed.data.session?.user ?? null
      if (!user) {
        // Nettoyage local sans attendre (évite course avec la navigation).
        void supabase.auth.signOut({ scope: "local" })
        redirectToLogin()
      }
    }

    void ensureSession()
    const timer = window.setInterval(() => {
      void ensureSession()
    }, POLL_MS)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled || redirectingRef.current) return
      if (event === "SIGNED_OUT") {
        redirectToLogin()
      }
    })

    const onFocus = () => {
      void ensureSession()
    }
    window.addEventListener("focus", onFocus)
    const onVisibility = () => {
      if (document.visibilityState === "visible") void ensureSession()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
      subscription.unsubscribe()
    }
  }, [pathname])

  return null
}
