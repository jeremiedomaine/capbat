"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { getPublicAppName } from "@/lib/branding-public"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      })

      if (resetError) {
        setError("Impossible d'envoyer l'email. Vérifiez l'adresse ou réessayez plus tard.")
        return
      }

      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <header className="mb-8 text-center space-y-1">
        <p className="text-xl font-semibold text-gray-900 tracking-tight">{getPublicAppName()}</p>
        <p className="text-sm text-gray-500">Réinitialisation du mot de passe</p>
      </header>

      <Card className="bg-white border-gray-100 shadow-sm max-w-md w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Mot de passe oublié</CardTitle>
          <CardDescription>
            Nous vous enverrons un lien pour choisir un nouveau mot de passe (vérifiez aussi les
            courriers indésirables).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <p className="text-sm text-gray-700">
              Si un compte existe pour cette adresse, un email vient d&apos;être envoyé.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Envoi…" : "Envoyer le lien"}
              </Button>
            </form>
          )}
          <Link href="/login" className="block text-sm text-blue-600 hover:underline">
            Retour à la connexion
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
