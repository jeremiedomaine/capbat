/** URL projet Supabase (même valeur partout : middleware, client, serveur). */
export function getSupabasePublicUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined
}

/**
 * URL pour le client admin (API routes) : d’abord la var publique, puis `SUPABASE_URL`
 * (souvent dupliquée sur Vercel côté serveur uniquement — même valeur que l’URL du projet).
 */
export function getSupabaseUrlForServer(): string | undefined {
  return getSupabasePublicUrl() || process.env.SUPABASE_URL?.trim() || undefined
}

/**
 * Clé publique navigateur : publishable (sb_publishable_…) ou clé anon JWT classique.
 * Les deux noms sont acceptés pour coller à la doc Supabase et aux dashboards Vercel.
 */
export function getSupabasePublicKey(): string | undefined {
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  return publishable || anon || undefined
}
