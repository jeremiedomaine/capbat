/** Variables NEXT_PUBLIC_* (nom du client, textes affichés côté interface). */

export function getPublicAppName(): string {
  const name = process.env.NEXT_PUBLIC_APP_NAME?.trim()
  return name && name.length > 0 ? name : "UpStay"
}

/** Texte sous le titre « Connexion » sur la page de login. */
export function getPublicAuthIntro(): string {
  const raw = process.env.NEXT_PUBLIC_APP_AUTH_INTRO?.trim()
  if (raw) return raw
  return "Votre espace pour suivre événements, encaissements et automatisation."
}
