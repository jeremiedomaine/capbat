import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseUrlForServer } from "@/lib/supabase/env-public"

let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached
  const url = getSupabaseUrlForServer()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const missing: string[] = []
  if (!url) {
    missing.push(
      "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_URL (copier l’URL du projet depuis Supabase → Settings → API)"
    )
  }
  if (!key) {
    missing.push(
      "SUPABASE_SERVICE_ROLE_KEY (Settings → API → service_role secret, pas la clé anon)"
    )
  }
  if (missing.length) {
    throw new Error(
      `Variables Vercel manquantes pour l’API : ${missing.join(" · ")}. Coche bien l’environnement **Production** pour chaque variable, puis redeploie.`
    )
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
