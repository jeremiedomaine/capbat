"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
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
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const redirectToLogin = async () => {
      if (isPublicAuthPath(pathname)) return
      await supabase.auth.signOut({ scope: "local" })
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""
      window.location.replace(`/login${next}`)
    }

    const ensureSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled) return

      const session = sessionData.session
      const expiresAt = session?.expires_at ?? 0
      const now = Math.floor(Date.now() / 1000)
      const needsRefresh = !session || expiresAt <= now + REFRESH_SKEW_SECONDS

      if (needsRefresh) {
        const refreshed = await supabase.auth.refreshSession()
        if (cancelled) return
        const user = refreshed.data.user ?? refreshed.data.session?.user ?? null
        if (!user) {
          await redirectToLogin()
          return
        }
      } else {
        const { data } = await supabase.auth.getUser()
        if (cancelled) return
        if (!data.user) {
          const refreshed = await supabase.auth.refreshSession()
          if (cancelled) return
          if (!(refreshed.data.user ?? refreshed.data.session?.user)) {
            await redirectToLogin()
            return
          }
        }
      }

      if (pathname.startsWith("/login")) {
        router.replace("/")
      }
    }

    void ensureSession()
    const timer = window.setInterval(() => {
      void ensureSession()
    }, POLL_MS)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return
      if (event === "SIGNED_OUT" && !isPublicAuthPath(pathname)) {
        window.location.replace("/login")
      }
      if (event === "SIGNED_IN" && pathname.startsWith("/login")) {
        router.replace("/")
      }
      if (event === "TOKEN_REFRESHED") {
        // cookies mis à jour côté navigateur
      }
    })

    const onFocus = () => {
      void ensureSession()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void ensureSession()
    })

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener("focus", onFocus)
      subscription.unsubscribe()
    }
  }, [pathname, router])

  return null
}
