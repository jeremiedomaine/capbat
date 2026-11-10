/** Lecture locale (sans réseau) du cookie de session Supabase SSR. */

export type CookiePair = { name: string; value: string }

export type ParsedAuthSession = {
  accessToken?: string
  refreshToken?: string
  /** Unix seconds */
  expiresAt?: number
}

const BASE64_PREFIX = "base64-"

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const padLength = (4 - (padded.length % 4)) % 4
  const normalized = padded + "=".repeat(padLength)
  if (typeof atob === "function") {
    return atob(normalized)
  }
  return Buffer.from(value, "base64url").toString("utf8")
}

function decodeCookiePayload(raw: string): string {
  const value = raw.trim()
  if (!value) return ""
  if (value.startsWith(BASE64_PREFIX)) {
    try {
      return decodeBase64Url(value.slice(BASE64_PREFIX.length))
    } catch {
      return ""
    }
  }
  return value
}

function readJwtExp(accessToken: string): number | undefined {
  const parts = accessToken.split(".")
  if (parts.length < 2) return undefined
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: number }
    return typeof payload.exp === "number" ? payload.exp : undefined
  } catch {
    return undefined
  }
}

/**
 * Recompose le cookie auth Supabase (éventuellement chunké `.0`, `.1`, …)
 * et en extrait access / refresh / expiry — sans appeler le réseau.
 */
export function parseSupabaseAuthSession(cookies: CookiePair[]): ParsedAuthSession | null {
  const authCookies = cookies
    .filter((cookie) => cookie.name.includes("-auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name, "en"))

  if (!authCookies.length) return null

  const base = authCookies.find((cookie) => !/\.\d+$/.test(cookie.name))
  const chunks = authCookies.filter((cookie) => /\.\d+$/.test(cookie.name))

  const raw = base
    ? base.value
    : chunks
        .sort((a, b) => {
          const ai = Number(a.name.split(".").pop())
          const bi = Number(b.name.split(".").pop())
          return ai - bi
        })
        .map((cookie) => cookie.value)
        .join("")

  if (!raw) return null

  try {
    const decoded = decodeCookiePayload(raw)
    const parsed = JSON.parse(decoded) as {
      access_token?: string
      refresh_token?: string
      expires_at?: number
    }

    const accessToken =
      typeof parsed.access_token === "string" ? parsed.access_token : undefined
    const refreshToken =
      typeof parsed.refresh_token === "string" ? parsed.refresh_token : undefined
    const expiresAt =
      typeof parsed.expires_at === "number"
        ? parsed.expires_at
        : accessToken
          ? readJwtExp(accessToken)
          : undefined

    return { accessToken, refreshToken, expiresAt }
  } catch {
    return null
  }
}

export function isAccessTokenExpired(
  session: ParsedAuthSession | null,
  skewSeconds = 60
): boolean {
  // Sans expiry lisible, on force le chemin refresh / login (évite les boucles).
  if (!session?.expiresAt) return true
  return session.expiresAt <= Math.floor(Date.now() / 1000) + skewSeconds
}

export function canAttemptRefresh(session: ParsedAuthSession | null): boolean {
  return Boolean(session?.refreshToken?.trim())
}
