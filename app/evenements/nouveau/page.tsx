"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

export default function NewEventPage() {
  const router = useRouter()
  const [couple, setCouple] = useState("")
  const [contactName, setContactName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [balanceAmount, setBalanceAmount] = useState("")
  const [autopilot, setAutopilot] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/weddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couple,
          contactName,
          email,
          phone,
          eventDate,
          depositAmount,
          balanceAmount,
          autopilot,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(payload.error ?? "Impossible de créer l'événement.")
        return
      }

      router.push("/evenements")
      router.refresh()
    } catch {
      setError("Une erreur réseau est survenue. Veuillez réessayer.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">Nouvel événement</h1>
            <p className="text-sm text-gray-500">
              Créez un nouveau mariage et enregistrez-le. Personnalisez les messages depuis Automatisations.
            </p>
          </header>

          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>Informations de l&apos;événement</CardTitle>
              <CardDescription>
                Complétez les champs pour ajouter ce mariage à votre planning.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800">Couple</label>
                    <Input
                      value={couple}
                      onChange={(e) => setCouple(e.target.value)}
                      placeholder="Ex: Laura & Mehdi"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800">Nom du contact</label>
                    <Input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Ex: Laura Martin"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800">Adresse mail</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="exemple@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800">Numéro de téléphone</label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+33 6 12 34 56 78"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800">Date du mariage</label>
                    <Input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800">Acompte (€)</label>
                    <Input
                      type="number"
                      min="0"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="1500"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800">Solde (€)</label>
                    <Input
                      type="number"
                      min="0"
                      value={balanceAmount}
                      onChange={(e) => setBalanceAmount(e.target.value)}
                      placeholder="3500"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-gray-100 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Activer le pilote automatique</p>
                    <p className="text-xs text-gray-500">
                      Les relances e-mail seront planifiées automatiquement.
                    </p>
                  </div>
                  <Switch checked={autopilot} onCheckedChange={setAutopilot} />
                </div>

                {error ? <p className="text-sm text-red-600">{error}</p> : null}

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Création..." : "Créer l'événement"}
                  </Button>
                  <Button asChild type="button" variant="outline">
                    <Link href="/evenements">Annuler</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
