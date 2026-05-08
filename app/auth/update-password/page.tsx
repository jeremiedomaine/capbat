"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { getPublicAppName } from "@/lib/branding-public"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setShowForm(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setShowForm(true)
      }
    })

    const fallback = window.setTimeout(() => setShowForm(true), 1200)

    return () => {
      subscription.unsubscribe()
      window.clearTimeout(fallback)
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }
    if (password.length < 8) {
      setError("Utilisez au moins 8 caractères.")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError("Impossible de mettre à jour le mot de passe. Le lien est peut-être expiré.")
        return
      }

      await supabase.auth.signOut()
      router.push("/login?reset=ok")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <header className="mb-8 text-center space-y-1">
        <p className="text-xl font-semibold text-gray-900 tracking-tight">{getPublicAppName()}</p>
        <p className="text-sm text-gray-500">Sécurisation de votre compte</p>
      </header>

      <Card className="bg-white border-gray-100 shadow-sm max-w-md w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Nouveau mot de passe</CardTitle>
          <CardDescription>
            Définissez un nouveau mot de passe après avoir ouvert le lien reçu par email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showForm ? (
            <p className="text-sm text-gray-500">Préparation du formulaire…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="pwd" className="text-sm font-medium text-gray-800">
                  Nouveau mot de passe
                </label>
                <Input
                  id="pwd"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="pwd2" className="text-sm font-medium text-gray-800">
                  Confirmer
                </label>
                <Input
                  id="pwd2"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </form>
          )}
          <Link href="/login" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Retour à la connexion
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
