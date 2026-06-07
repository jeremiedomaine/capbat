"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Sidebar } from "@/components/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { validateNewEventInput } from "@/lib/form-validation"
import {
  isEventType,
  isWeddingEventType,
  type EventType,
  getEventDateLabel,
  getNewEventNamePlaceholder,
} from "@/lib/event-types"
import { buildDashboardCouple, buildPrimaryContactName } from "@/lib/wedding-display"

export default function NewEventPage() {
  const router = useRouter()
  const [eventType, setEventType] = useState<EventType>("wedding")
  const [eventName, setEventName] = useState("")
  const [spouse1FirstName, setSpouse1FirstName] = useState("")
  const [spouse1LastName, setSpouse1LastName] = useState("")
  const [spouse2FirstName, setSpouse2FirstName] = useState("")
  const [spouse2LastName, setSpouse2LastName] = useState("")
  const [contactName, setContactName] = useState("")
  const [postalAddress, setPostalAddress] = useState("")
  const [comments, setComments] = useState("")
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

    const validationError = validateNewEventInput({
      eventType,
      eventName,
      spouse1FirstName,
      spouse1LastName,
      spouse2FirstName,
      spouse2LastName,
      contactName,
      email,
      phone,
      eventDate,
      depositAmount,
      balanceAmount,
    })
    if (validationError) {
      setError(validationError)
      toast.error("Vérifiez le formulaire", { description: validationError })
      return
    }

    const couple = buildDashboardCouple({
      eventType,
      eventName,
      spouse1FirstName,
      spouse2FirstName,
    })
    const resolvedContactName = buildPrimaryContactName({
      eventType,
      spouse1FirstName,
      spouse1LastName,
      contactName,
    })

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/weddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          eventName: eventName.trim(),
          spouse1FirstName: spouse1FirstName.trim(),
          spouse1LastName: spouse1LastName.trim(),
          spouse2FirstName: spouse2FirstName.trim(),
          spouse2LastName: spouse2LastName.trim(),
          postalAddress: postalAddress.trim(),
          comments: comments.trim(),
          couple,
          contactName: resolvedContactName,
          email: email.trim(),
          phone: phone.trim(),
          eventDate,
          depositAmount,
          balanceAmount,
          autopilot,
        }),
      })

      const payload = (await response.json()) as { wedding?: { id: number }; error?: string }

      if (!response.ok) {
        const msg = payload.error ?? "Impossible de créer l'événement."
        setError(msg)
        toast.error("Création impossible", { description: msg })
        return
      }

      toast.success("Événement créé", {
        description: "La fiche détaillée est disponible.",
      })
      router.push(payload.wedding ? `/evenements/${payload.wedding.id}` : "/evenements")
      router.refresh()
    } catch {
      const msg = "Une erreur réseau est survenue. Veuillez réessayer."
      setError(msg)
      toast.error("Erreur réseau", { description: msg })
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
              Les informations détaillées seront disponibles sur la fiche de l&apos;événement. Le
              tableau de bord reste synthétique.
            </p>
          </header>

          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>Informations de l&apos;événement</CardTitle>
              <CardDescription>
                Choisissez le type d&apos;événement, puis complétez les champs pour l&apos;ajouter à
                votre planning.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-800">Type d&apos;événement</label>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={eventType}
                    onValueChange={(value) => {
                      if (isEventType(value)) setEventType(value)
                    }}
                    className="w-full max-w-xl grid grid-cols-3"
                  >
                    <ToggleGroupItem value="wedding" className="flex-1">
                      Mariage
                    </ToggleGroupItem>
                    <ToggleGroupItem value="gite" className="flex-1">
                      Gîte
                    </ToggleGroupItem>
                    <ToggleGroupItem value="other" className="flex-1">
                      Autre événement
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-800">Nom de l&apos;événement</label>
                  <Input
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder={getNewEventNamePlaceholder(eventType)}
                    required
                  />
                </div>

                {isWeddingEventType(eventType) ? (
                  <div className="space-y-4 rounded-lg border border-gray-100 p-4">
                    <p className="text-sm font-medium text-gray-900">Les mariés</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                          Marié(e) 1
                        </p>
                        <Input
                          value={spouse1FirstName}
                          onChange={(e) => setSpouse1FirstName(e.target.value)}
                          placeholder="Prénom"
                          required
                        />
                        <Input
                          value={spouse1LastName}
                          onChange={(e) => setSpouse1LastName(e.target.value)}
                          placeholder="Nom"
                          required
                        />
                      </div>
                      <div className="space-y-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                          Marié(e) 2
                        </p>
                        <Input
                          value={spouse2FirstName}
                          onChange={(e) => setSpouse2FirstName(e.target.value)}
                          placeholder="Prénom"
                          required
                        />
                        <Input
                          value={spouse2LastName}
                          onChange={(e) => setSpouse2LastName(e.target.value)}
                          placeholder="Nom"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800">Nom du contact</label>
                    <Input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Ex: Laura Martin"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-800">Adresse postale</label>
                  <Textarea
                    value={postalAddress}
                    onChange={(e) => setPostalAddress(e.target.value)}
                    placeholder="Numéro, rue, code postal, ville"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-800">Commentaire</label>
                  <Textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Notes internes, demandes particulières, informations utiles…"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <label className="text-sm font-medium text-gray-800">
                      {getEventDateLabel(eventType)}
                    </label>
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
                    <p className="text-sm font-medium text-gray-800">Relances par défaut</p>
                    <p className="text-xs text-gray-500">
                      Coche toutes les automatisations compatibles sur la fiche de l&apos;événement
                      (modifiable ensuite).
                    </p>
                  </div>
                  <Switch checked={autopilot} onCheckedChange={setAutopilot} />
                </div>

                {error ? <p className="text-sm text-red-600">{error}</p> : null}

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Création…
                      </>
                    ) : (
                      "Créer l'événement"
                    )}
                  </Button>
                  <Button asChild type="button" variant="outline" disabled={isSubmitting}>
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
