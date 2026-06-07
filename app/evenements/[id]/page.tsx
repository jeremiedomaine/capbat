"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Sidebar } from "@/components/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EVENT_TYPE_LABELS, getEventTypeBadgeClass, isWeddingEventType, type EventType } from "@/lib/event-types"
import { formatEventDateFr } from "@/lib/event-dates"
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/lib/payment-methods"
import { formatSpouseName } from "@/lib/wedding-display"

type WeddingDetail = {
  id: number
  eventType: EventType
  eventName: string
  couple: string
  contactName: string
  spouse1FirstName: string
  spouse1LastName: string
  spouse2FirstName: string
  spouse2LastName: string
  postalAddress: string
  comments: string
  email: string
  phone: string
  eventDate: string
  deposit: { amount: string; status: string }
  balance: { amount: string; status: string }
  depositPaidDate: string
  depositPaymentMethod: PaymentMethod | ""
  balancePaidDate: string
  balancePaymentMethod: PaymentMethod | ""
  autopilot: boolean
  lastActivity: string
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm text-gray-900 whitespace-pre-wrap">{value || "—"}</p>
    </div>
  )
}

export default function EventDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [wedding, setWedding] = useState<WeddingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [depositPaidDate, setDepositPaidDate] = useState("")
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<PaymentMethod | "">("")
  const [balancePaidDate, setBalancePaidDate] = useState("")
  const [balancePaymentMethod, setBalancePaymentMethod] = useState<PaymentMethod | "">("")
  const [savingPayments, setSavingPayments] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(`/api/weddings/${id}`, { credentials: "same-origin" })
        const payload = (await response.json()) as { wedding?: WeddingDetail; error?: string }
        if (!response.ok) {
          throw new Error(payload.error ?? "Impossible de charger la fiche.")
        }
        if (!cancelled && payload.wedding) {
          setWedding(payload.wedding)
          setDepositPaidDate(payload.wedding.depositPaidDate.slice(0, 10))
          setDepositPaymentMethod(payload.wedding.depositPaymentMethod)
          setBalancePaidDate(payload.wedding.balancePaidDate.slice(0, 10))
          setBalancePaymentMethod(payload.wedding.balancePaymentMethod)
        }
      } catch (e) {
        if (!cancelled) {
          setWedding(null)
          setError(e instanceof Error ? e.message : "Erreur de chargement.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleSavePayments() {
    setSavingPayments(true)
    try {
      const response = await fetch(`/api/weddings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depositPaidDate,
          depositPaymentMethod,
          balancePaidDate,
          balancePaymentMethod,
        }),
      })
      const payload = (await response.json()) as { wedding?: WeddingDetail; error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "Enregistrement impossible.")
      }
      if (payload.wedding) {
        setWedding(payload.wedding)
        setDepositPaidDate(payload.wedding.depositPaidDate.slice(0, 10))
        setDepositPaymentMethod(payload.wedding.depositPaymentMethod)
        setBalancePaidDate(payload.wedding.balancePaidDate.slice(0, 10))
        setBalancePaymentMethod(payload.wedding.balancePaymentMethod)
      }
      window.dispatchEvent(new Event("weddings-updated"))
      toast.success("Suivi des paiements enregistré")
    } catch (e) {
      toast.error("Enregistrement impossible", {
        description: e instanceof Error ? e.message : "Réessayez dans un instant.",
      })
    } finally {
      setSavingPayments(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/evenements">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Mes événements
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Dashboard</Link>
            </Button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" aria-hidden />
              <p className="text-sm">Chargement de la fiche…</p>
            </div>
          ) : null}

          {!loading && error ? (
            <Card className="border-red-100 bg-red-50">
              <CardContent className="p-6 text-sm text-red-800">{error}</CardContent>
            </Card>
          ) : null}

          {!loading && wedding ? (
            <>
              <header className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={getEventTypeBadgeClass(wedding.eventType)}
                  >
                    {EVENT_TYPE_LABELS[wedding.eventType]}
                  </Badge>
                </div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {wedding.eventName || wedding.couple}
                </h1>
                <p className="text-sm text-gray-500">
                  Fiche détaillée de l&apos;événement — informations complémentaires et suivi des
                  paiements.
                </p>
              </header>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Identité de l&apos;événement</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <DetailField label="Nom de l'événement" value={wedding.eventName} />
                  <DetailField label="Libellé tableau" value={wedding.couple} />
                  <DetailField label="Date" value={formatEventDateFr(wedding.eventDate)} />
                  <DetailField label="Dernière activité" value={wedding.lastActivity} />
                </CardContent>
              </Card>

              {isWeddingEventType(wedding.eventType) ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Les mariés</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <DetailField
                      label="Marié(e) 1"
                      value={formatSpouseName(wedding.spouse1FirstName, wedding.spouse1LastName)}
                    />
                    <DetailField
                      label="Marié(e) 2"
                      value={formatSpouseName(wedding.spouse2FirstName, wedding.spouse2LastName)}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Contact</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DetailField label="Nom du contact" value={wedding.contactName} />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Coordonnées</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <DetailField label="Adresse postale" value={wedding.postalAddress} />
                  <DetailField label="E-mail" value={wedding.email} />
                  <DetailField label="Téléphone" value={wedding.phone} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Commentaire</CardTitle>
                </CardHeader>
                <CardContent>
                  <DetailField label="Notes" value={wedding.comments} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Suivi financier</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <DetailField label="Acompte" value={wedding.deposit.amount} />
                  <DetailField label="Solde" value={wedding.balance.amount} />
                  <DetailField
                    label="Relance automatique"
                    value={wedding.autopilot ? "Activée" : "Désactivée"}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Suivi des paiements</CardTitle>
                  <CardDescription>
                    Notez la date et le moyen de paiement pour l&apos;acompte et le solde afin de
                    vous y retrouver facilement.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-4 rounded-lg border border-gray-100 p-4">
                      <p className="text-sm font-medium text-gray-900">Acompte</p>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-800">Date de paiement</label>
                        <Input
                          type="date"
                          value={depositPaidDate}
                          onChange={(e) => setDepositPaidDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-800">Moyen de paiement</label>
                        <Select
                          value={depositPaymentMethod || "none"}
                          onValueChange={(value) =>
                            setDepositPaymentMethod(value === "none" ? "" : (value as PaymentMethod))
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

                    <div className="space-y-4 rounded-lg border border-gray-100 p-4">
                      <p className="text-sm font-medium text-gray-900">Solde</p>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-800">Date de paiement</label>
                        <Input
                          type="date"
                          value={balancePaidDate}
                          onChange={(e) => setBalancePaidDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-800">Moyen de paiement</label>
                        <Select
                          value={balancePaymentMethod || "none"}
                          onValueChange={(value) =>
                            setBalancePaymentMethod(value === "none" ? "" : (value as PaymentMethod))
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
                  </div>

                  <Button onClick={() => void handleSavePayments()} disabled={savingPayments}>
                    {savingPayments ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Enregistrement…
                      </>
                    ) : (
                      "Enregistrer le suivi des paiements"
                    )}
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </main>
    </div>
  )
}
