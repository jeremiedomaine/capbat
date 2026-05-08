import { createBrowserClient } from "@supabase/ssr"
import { getSupabasePublicKey, getSupabasePublicUrl } from "@/lib/supabase/env-public"

export function createClient() {
  const url = getSupabasePublicUrl()
  const key = getSupabasePublicKey()
  if (!url || !key) {
    throw new Error(
      "Configuration Supabase manquante : définir NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY."
    )
  }
  return createBrowserClient(url, key)
}
