import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function resolveUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const auth = await Promise.race([
    supabase.auth.getUser(),
    new Promise<{ data: { user: null }; error: Error }>((resolve) => {
      setTimeout(
        () => resolve({ data: { user: null }, error: new Error("Auth timeout") }),
        8000
      )
    }),
  ])

  if (auth.data.user) return auth.data.user

  // Access token expiré : tente un refresh explicite (écrit les cookies via setAll).
  const refreshed = await Promise.race([
    supabase.auth.refreshSession(),
    new Promise<{ data: { user: null; session: null }; error: Error }>((resolve) => {
      setTimeout(
        () =>
          resolve({
            data: { user: null, session: null },
            error: new Error("Auth refresh timeout"),
          }),
        8000
      )
    }),
  ])

  return refreshed.data.user ?? refreshed.data.session?.user ?? null
}

/** Retourne null si OK, sinon la réponse Next à retourner telle quelle. */
export async function gateInternalToolAccess(): Promise<Response | null> {
  const supabase = await createClient()
  const user = await resolveUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: "Non autorisé. Session expirée : reconnecte-toi." },
      { status: 401 }
    )
  }

  const allowlistEnv = process.env.INTERNAL_ALLOWED_EMAILS?.trim()
  if (!allowlistEnv) return null

  const allowlist = allowlistEnv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (!allowlist.length) return null

  const email = user.email?.toLowerCase()
  if (!email || !allowlist.includes(email)) {
    return NextResponse.json({ error: "Ce compte n'est pas autorisé à utiliser cet espace." }, { status: 403 })
  }

  return null
}
