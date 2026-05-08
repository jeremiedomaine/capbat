import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** Retourne null si OK, sinon la réponse Next à retourner telle quelle. */
export async function gateInternalToolAccess(): Promise<Response | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 })
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
