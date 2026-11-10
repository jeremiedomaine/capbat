import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getSupabasePublicKey, getSupabasePublicUrl } from "@/lib/supabase/env-public"
import { createReadOnlyFetch, isReadOnlyMode } from "@/lib/read-only"

export async function createClient() {
  const cookieStore = await cookies()
  const url = getSupabasePublicUrl()
  const key = getSupabasePublicKey()
  if (!url || !key) {
    throw new Error("Variables NEXT_PUBLIC_SUPABASE_URL et clé publique Supabase manquantes.")
  }

  const timedFetch: typeof fetch = (input, init) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    return fetch(input, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer)
    })
  }

  return createServerClient(url, key,
    {
      global: {
        fetch: isReadOnlyMode() ? createReadOnlyFetch(timedFetch) : timedFetch,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: {
            name: string
            value: string
            options: CookieOptions
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            /* set from Server Component */
          }
        },
      },
    }
  )
}
