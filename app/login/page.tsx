"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { getPublicAppName, getPublicAuthIntro } from "@/lib/branding-public"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/"
  const resetOk = searchParams.get("reset") === "ok"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signError) {
        setError("Email ou mot de passe incorrect.")
        toast.error("Connexion refusée", {
          description: "Vérifiez l’e-mail et le mot de passe.",
        })
        return
      }

      toast.success("Connexion réussie")
      router.push(next.startsWith("/") ? next : "/")
      router.refresh()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Impossible de se connecter. Réessayez plus tard."
      setError(message)
      toast.error("Erreur", { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-white border-gray-100 shadow-sm max-w-md w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Connexion</CardTitle>
        <CardDescription>{getPublicAuthIntro()}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {resetOk ? (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              Mot de passe mis à jour. Connectez-vous avec le nouveau mot de passe.
            </p>
          ) : null}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-gray-800">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-gray-800">
                Mot de passe
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-xs text-blue-600 hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Connexion…
              </>
            ) : (
              "Se connecter"
            )}
          </Button>
        </form>
        <p className="mt-4 text-xs text-gray-400">
          Besoin d&apos;aide pour vous connecter ? Contactez la personne qui vous a envoyé vos
          identifiants.
        </p>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <header className="mb-8 text-center space-y-1">
        <p className="text-xl font-semibold text-gray-900 tracking-tight">{getPublicAppName()}</p>
        <p className="text-sm text-gray-500">Plateforme événements et suivi des encaissements</p>
      </header>
      <Suspense
        fallback={
          <p className="text-sm text-gray-500">
            Chargement…{" "}
            <Link href="/login" className="text-blue-600 underline">
              actualiser
            </Link>
          </p>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  )
}
