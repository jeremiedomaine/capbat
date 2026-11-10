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
import { Checkbox } from "@/components/ui/checkbox"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { validateNewEventInput } from "@/lib/form-validation"
import {
  isEventType,
  isWeddingEventType,
  type EventType,
  getEventDateLabel,
  getNewEventNamePlaceholder,
} from "@/lib/event-types"
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/lib/payment-methods"
import {
  BOOKING_SOURCE_HINTS,
  BOOKING_SOURCE_LABELS,
  isBookingSource,
  isPlatformBooking,
  type BookingSource,
} from "@/lib/booking-source"
import {
  TOURIST_TAX_STATUS_LABELS,
  type TouristTaxStatus,
} from "@/lib/tourist-tax"
import { buildDashboardCouple, buildPrimaryContactName } from "@/lib/wedding-display"

export default function NewEventPage() {
  const router = useRouter()
  const [eventType, setEventType] = useState<EventType>("wedding")
  const [bookingSource, setBookingSource] = useState<BookingSource>("direct")
  const [eventName, setEventName] = useState("")
  const [spouse1FirstName, setSpouse1FirstName] = useState("")
  const [spouse1LastName, setSpouse1LastName] = useState("")
  const [spouse2FirstName, setSpouse2FirstName] = useState("")
  const [spouse2LastName, setSpouse2LastName] = useState("")
  const [spouse1Phone, setSpouse1Phone] = useState("")
  const [spouse2Phone, setSpouse2Phone] = useState("")
  const [contactName, setContactName] = useState("")
  const [postalAddress, setPostalAddress] = useState("")
  const [comments, setComments] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [stayArrivalDate, setStayArrivalDate] = useState("")
  const [stayDepartureDate, setStayDepartureDate] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [balanceAmount, setBalanceAmount] = useState("")
  const [depositAlreadyPaid, setDepositAlreadyPaid] = useState(false)
  const [depositPaidDate, setDepositPaidDate] = useState("")
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<PaymentMethod | "">("")
  const [touristTaxStatus, setTouristTaxStatus] = useState<TouristTaxStatus | "">("")
  const [touristTaxAmount, setTouristTaxAmount] = useState("")
  const [touristTaxPaidDate, setTouristTaxPaidDate] = useState("")
  const [autopilot, setAutopilot] = useState(true)
  const [generateInvoices, setGenerateInvoices] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const platformManaged = isPlatformBooking(bookingSource)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    const validationError = validateNewEventInput({
      eventType,
      skipBillingAmounts: platformManaged,
      eventName,
      spouse1FirstName,
      spouse1LastName,
      spouse2FirstName,
      spouse2LastName,
      spouse1Phone,
      spouse2Phone,
      contactName,
      email,
      phone,
      eventDate,
      stayArrivalDate,
      stayDepartureDate,
      depositAmount,
      balanceAmount,
      depositAlreadyPaid,
      depositPaidDate,
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
          bookingSource,
          eventName: eventName.trim(),
          spouse1FirstName: spouse1FirstName.trim(),
          spouse1LastName: spouse1LastName.trim(),
          spouse2FirstName: spouse2FirstName.trim(),
          spouse2LastName: spouse2LastName.trim(),
          spouse1Phone: spouse1Phone.trim(),
          spouse2Phone: spouse2Phone.trim(),
          postalAddress: postalAddress.trim(),
          comments: comments.trim(),
          couple,
          contactName: resolvedContactName,
          email: email.trim(),
          phone: phone.trim() || spouse1Phone.trim() || spouse2Phone.trim(),
          eventDate,
          stayArrivalDate,
          stayDepartureDate,
          depositAmount: platformManaged ? depositAmount || "0" : depositAmount,
          balanceAmount: platformManaged ? balanceAmount || "0" : balanceAmount,
          autopilot,
          generateInvoices: platformManaged ? false : generateInvoices,
          depositAlreadyPaid: platformManaged ? false : depositAlreadyPaid,
          depositPaidDate:
            !platformManaged && depositAlreadyPaid ? depositPaidDate : undefined,
          depositPaymentMethod:
            !platformManaged && depositAlreadyPaid ? depositPaymentMethod : undefined,
          touristTaxStatus:
            platformManaged || eventType === "other" ? undefined : touristTaxStatus,
          touristTaxAmount:
            platformManaged || eventType === "other" ? undefined : touristTaxAmount,
          touristTaxPaidDate:
            !platformManaged &&
            eventType !== "other" &&
            touristTaxStatus === "paid"
              ? touristTaxPaidDate
              : undefined,
        }),
      })

      const payload = (await response.json()) as {
        wedding?: { id: number }
        invoicesCreated?: number
        error?: string
      }

      if (!response.ok) {
        const msg = payload.error ?? "Impossible de créer l'événement."
        setError(msg)
        toast.error("Création impossible", { description: msg })
        return
      }

      toast.success("Événement créé", {
        description:
          payload.invoicesCreated && payload.invoicesCreated > 0
            ? `${payload.invoicesCreated} facture(s) brouillon créée(s).`
            : "La fiche détaillée est disponible.",
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
                  <label className="text-sm font-medium text-gray-800">
                    Source de réservation
                  </label>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={bookingSource}
                    onValueChange={(value) => {
                      if (isBookingSource(value)) {
                        setBookingSource(value)
                        if (value === "platform") {
                          setGenerateInvoices(false)
                          setDepositAlreadyPaid(false)
                          setTouristTaxStatus("")
                          setTouristTaxAmount("")
                          setTouristTaxPaidDate("")
                        }
                      }
                    }}
                    className="w-full max-w-xl grid grid-cols-2"
                  >
                    <ToggleGroupItem value="direct" className="flex-1">
                      {BOOKING_SOURCE_LABELS.direct}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="platform" className="flex-1">
                      {BOOKING_SOURCE_LABELS.platform}
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <p className="text-xs text-gray-500">{BOOKING_SOURCE_HINTS[bookingSource]}</p>
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
                        <Input
                          type="tel"
                          value={spouse1Phone}
                          onChange={(e) => setSpouse1Phone(e.target.value)}
                          placeholder="Téléphone (optionnel)"
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
                        <Input
                          type="tel"
                          value={spouse2Phone}
                          onChange={(e) => setSpouse2Phone(e.target.value)}
                          placeholder="Téléphone (optionnel)"
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
                      required={!isWeddingEventType(eventType)}
                    />
                    {isWeddingEventType(eventType) ? (
                      <p className="text-xs text-gray-500">
                        Contact principal pour les e-mails. Les téléphones des mariés sont
                        optionnels ci-dessus.
                      </p>
                    ) : null}
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
                    <label className="text-sm font-medium text-gray-800">Arrivée au logement</label>
                    <Input
                      type="date"
                      value={stayArrivalDate}
                      onChange={(e) => setStayArrivalDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800">Départ du logement</label>
                    <Input
                      type="date"
                      value={stayDepartureDate}
                      onChange={(e) => setStayDepartureDate(e.target.value)}
                      min={stayArrivalDate || undefined}
                      required
                    />
                  </div>
                  {!platformManaged ? (
                    <>
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
                    </>
                  ) : (
                    <div className="md:col-span-2 rounded-lg border border-violet-100 bg-violet-50/60 px-4 py-3 text-sm text-violet-900">
                      Réservation plateforme : pas de facture ni de taxe de séjour dans Cap&apos;Bat.
                      Elle compte uniquement pour le planning / remplissage.
                    </div>
                  )}
                </div>

                {!platformManaged ? (
                <div className="space-y-4 rounded-lg border border-gray-100 p-4">
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={depositAlreadyPaid}
                      onCheckedChange={(v) => setDepositAlreadyPaid(v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      Acompte déjà encaissé
                      <span className="block text-xs text-gray-500 font-normal mt-0.5">
                        Utile quand la fiche est créée après le versement.
                      </span>
                    </span>
                  </label>
                  {depositAlreadyPaid ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-800">
                          Date de versement
                        </label>
                        <Input
                          type="date"
                          value={depositPaidDate}
                          onChange={(e) => setDepositPaidDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-800">
                          Moyen de paiement
                        </label>
                        <Select
                          value={depositPaymentMethod || "none"}
                          onValueChange={(value) =>
                            setDepositPaymentMethod(
                              value === "none" ? "" : (value as PaymentMethod)
                            )
                          }
                        >
                          <SelectTrigger className="w-full bg-white">
                            <SelectValue placeholder="Choisir un moyen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Non renseigné</SelectItem>
                            {PAYMENT_METHOD_OPTIONS.map((method) => (
                              <SelectItem key={method} value={method}>
                                {PAYMENT_METHOD_LABELS[method]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : null}
                </div>
                ) : null}

                {!platformManaged && eventType !== "other" ? (
                  <div className="space-y-4 rounded-lg border border-gray-100 p-4">
                    <p className="text-sm font-medium text-gray-900">Taxe de séjour</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-800">Statut</label>
                        <Select
                          value={touristTaxStatus || "none"}
                          onValueChange={(value) =>
                            setTouristTaxStatus(
                              value === "none" ? "" : (value as TouristTaxStatus)
                            )
                          }
                        >
                          <SelectTrigger className="w-full bg-white">
                            <SelectValue placeholder="Non suivi" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Non suivi</SelectItem>
                            <SelectItem value="unpaid">
                              {TOURIST_TAX_STATUS_LABELS.unpaid}
                            </SelectItem>
                            <SelectItem value="paid">{TOURIST_TAX_STATUS_LABELS.paid}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-800">Montant (€)</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={touristTaxAmount}
                          onChange={(e) => setTouristTaxAmount(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      {touristTaxStatus === "paid" ? (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-800">
                            Date de versement
                          </label>
                          <Input
                            type="date"
                            value={touristTaxPaidDate}
                            onChange={(e) => setTouristTaxPaidDate(e.target.value)}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

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

                {!platformManaged ? (
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 p-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Factures brouillon</p>
                      <p className="text-xs text-gray-500">
                        Crée automatiquement les factures d&apos;acompte et de solde (modifiables dans
                        Facturation).
                      </p>
                    </div>
                    <Switch checked={generateInvoices} onCheckedChange={setGenerateInvoices} />
                  </div>
                ) : null}

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
