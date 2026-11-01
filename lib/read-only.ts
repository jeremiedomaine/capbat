/**
 * Mode lecture seule pour le développement local sur les vraies données.
 * Activé uniquement via NEXT_PUBLIC_APP_READ_ONLY=1 (jamais défini sur Vercel).
 */

export const READ_ONLY_MESSAGE =
  "Mode lecture seule (local) : aucune modification n'est enregistrée."

/** Écritures Supabase Auth nécessaires pour se connecter / se déconnecter. */
const ALLOWED_WRITE_PATHS = ["/auth/v1/token", "/auth/v1/logout"]

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export function isReadOnlyMode(): boolean {
  return process.env.NEXT_PUBLIC_APP_READ_ONLY === "1"
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase()
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase()
  return "GET"
}

function requestPathname(input: RequestInfo | URL): string {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  try {
    return new URL(raw).pathname
  } catch {
    return raw
  }
}

export function createReadOnlyFetch(
  baseFetch: typeof fetch = (...args) => globalThis.fetch(...args)
): typeof fetch {
  return async (input, init) => {
    const method = requestMethod(input, init)
    if (SAFE_METHODS.has(method)) return baseFetch(input, init)

    const pathname = requestPathname(input)
    if (ALLOWED_WRITE_PATHS.some((path) => pathname.startsWith(path))) {
      return baseFetch(input, init)
    }

    return new Response(
      JSON.stringify({ code: "READ_ONLY", message: READ_ONLY_MESSAGE, error: READ_ONLY_MESSAGE }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    )
  }
}
