"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Loader2, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  TOURIST_TAX_INVOICE_STATUS_LABELS,
  type TouristTaxInvoice,
  type TouristTaxInvoiceStatus,
  type TouristTaxOccupancyLine,
} from "@/lib/tourist-tax-invoice-types"
import { supportsCapBatBilling, type BookingSource } from "@/lib/booking-source"
import {
  countStayNights,
  TOURIST_TAX_MAX_ADULTS,
  TOURIST_TAX_RATE_EUR,
} from "@/lib/tourist-tax"
import {
  formatEuroDetailed,
  formatPeriodLabel,
  occupancyLinesTotal,
  todayIsoDate,
} from "@/lib/tourist-tax-invoice-utils"

type WeddingOption = {
  id: number
  couple: string
  contactName: string
  postalAddress?: string
  eventDate: string
  eventType: "wedding" | "gite" | "other"
  eventName: string
  bookingSource?: BookingSource
  stayArrivalDate?: string
  stayDepartureDate?: string
}

type LineDraft = TouristTaxOccupancyLine & { key: string }

const STATUS_BADGE: Record<TouristTaxInvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
}

const PAYMENT_METHODS = ["Espèces", "Chèque", "Virement", "Carte bancaire", "Autre"]

function lineKey() {
  return `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function weddingLabel(wedding: WeddingOption) {
  if (wedding.eventType === "other" && wedding.eventName.trim()) return wedding.eventName.trim()
  return wedding.couple
}

export function TouristTaxDashboard() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<TouristTaxInvoice[]>([])
  const [weddings, setWeddings] = useState<WeddingOption[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TouristTaxInvoice | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<TouristTaxInvoiceStatus | "all">("all")

  const [weddingId, setWeddingId] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientAddress, setClientAddress] = useState("")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")
  const [issuedAt, setIssuedAt] = useState(todayIsoDate())
  const [paidAt, setPaidAt] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("Espèces")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<LineDraft[]>([
    { key: lineKey(), adults: 0, nights: 0 },
  ])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, wedRes] = await Promise.all([
        fetch("/api/tourist-tax-invoices", { credentials: "same-origin" }),
        fetch("/api/weddings", { credentials: "same-origin" }),
      ])
      const invPayload = (await invRes.json()) as { invoices?: TouristTaxInvoice[]; error?: string }
      const wedPayload = (await wedRes.json()) as { weddings?: WeddingOption[] }
      if (!invRes.ok) throw new Error(invPayload.error ?? "Chargement impossible.")
      setInvoices(invPayload.invoices ?? [])
      setWeddings(wedRes.ok ? wedPayload.weddings ?? [] : [])
    } catch (e) {
      toast.error("Chargement impossible", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const billableWeddings = useMemo(
    () => weddings.filter((row) => supportsCapBatBilling(row.bookingSource)),
    [weddings]
  )

  const selectedWedding = useMemo(
    () => billableWeddings.find((row) => String(row.id) === weddingId) ?? null,
    [billableWeddings, weddingId]
  )

  const nights = countStayNights(periodStart, periodEnd)
  const previewTotal = occupancyLinesTotal(
    lines.map(({ adults, nights: n }) => ({ adults, nights: n })),
    TOURIST_TAX_RATE_EUR
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return invoices.filter((invoice) => {
      if (statusFilter !== "all" && invoice.status !== statusFilter) return false
      if (!q) return true
      return (
        invoice.number.toLowerCase().includes(q) ||
        invoice.couple.toLowerCase().includes(q) ||
        invoice.clientName.toLowerCase().includes(q)
      )
    })
  }, [invoices, query, statusFilter])

  const openCreate = () => {
    setWeddingId("")
    setClientName("")
    setClientAddress("")
    setPeriodStart("")
    setPeriodEnd("")
    setIssuedAt(todayIsoDate())
    setPaidAt("")
    setPaymentMethod("Espèces")
    setNotes("")
    setLines([{ key: lineKey(), adults: 0, nights: 0 }])
    setCreateOpen(true)
  }

  const applyWedding = (id: string) => {
    setWeddingId(id)
    const wedding = weddings.find((row) => String(row.id) === id)
    if (!wedding) return
    setClientName(wedding.couple || wedding.contactName || "")
    setClientAddress(wedding.postalAddress ?? "")
    const start = (wedding.stayArrivalDate || wedding.eventDate || "").slice(0, 10)
    const end = (wedding.stayDepartureDate || "").slice(0, 10)
    setPeriodStart(start)
    setPeriodEnd(end)
    const autoNights = countStayNights(start, end)
    setLines([{ key: lineKey(), adults: 0, nights: autoNights }])
  }

  const handleCreate = async () => {
    if (!selectedWedding) {
      toast.error("Sélectionnez un événement.")
      return
    }
    if (!clientName.trim()) {
      toast.error("Indiquez le nom du client.")
      return
    }
    if (!periodStart || !periodEnd || nights <= 0) {
      toast.error("Période invalide", {
        description: "Renseignez une arrivée et un départ cohérents.",
      })
      return
    }
    const prepared = lines
      .map((line) => ({
        adults: Math.min(TOURIST_TAX_MAX_ADULTS, Math.max(0, Math.floor(Number(line.adults) || 0))),
        nights: Math.max(0, Math.floor(Number(line.nights) || 0)),
      }))
      .filter((line) => line.adults > 0 && line.nights > 0)

    if (!prepared.length) {
      toast.error("Ajoutez au moins une ligne avec des adultes et des nuitées.")
      return
    }

    setCreateSubmitting(true)
    try {
      const response = await fetch("/api/tourist-tax-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          weddingId: selectedWedding.id,
          couple: weddingLabel(selectedWedding),
          periodStart,
          periodEnd,
          lines: prepared,
          issuedAt,
          paidAt: paidAt || undefined,
          paymentMethod,
          clientName: clientName.trim(),
          clientAddress: clientAddress.trim() || undefined,
          notes: notes.trim() || undefined,
          status: paidAt ? "paid" : "draft",
        }),
      })
      const payload = (await response.json()) as { invoice?: TouristTaxInvoice; error?: string }
      if (!response.ok || !payload.invoice) throw new Error(payload.error ?? "Création impossible.")
      setCreateOpen(false)
      router.push(`/taxe-de-sejour/${payload.invoice.id}`)
    } catch (e) {
      toast.error("Création impossible", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
    } finally {
      setCreateSubmitting(false)
    }
  }

  const downloadPdf = async (invoice: TouristTaxInvoice) => {
    setPendingId(invoice.id)
    try {
      const response = await fetch(`/api/tourist-tax-invoices/${invoice.id}/pdf`, {
        credentials: "same-origin",
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "PDF indisponible.")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${invoice.number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error("Téléchargement impossible", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
    } finally {
      setPendingId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setPendingId(deleteTarget.id)
    try {
      const response = await fetch(`/api/tourist-tax-invoices/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "Suppression impossible.")
      }
      setInvoices((prev) => prev.filter((row) => row.id !== deleteTarget.id))
      toast.success("Facture de taxe supprimée")
    } catch (e) {
      toast.error("Suppression impossible", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
    } finally {
      setPendingId(null)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Rechercher n°, client, événement…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as TouristTaxInvoiceStatus | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {(Object.keys(TOURIST_TAX_INVOICE_STATUS_LABELS) as TouristTaxInvoiceStatus[]).map(
                (status) => (
                  <SelectItem key={status} value={status}>
                    {TOURIST_TAX_INVOICE_STATUS_LABELS[status]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle taxe
        </Button>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Événement</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead className="w-[120px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-gray-500">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Chargement…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-gray-500">
                  Aucune facture de taxe de séjour.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/taxe-de-sejour/${invoice.id}`)}
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/taxe-de-sejour/${invoice.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline"
                    >
                      {invoice.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">{invoice.couple}</div>
                    <div className="text-xs text-gray-500">{invoice.clientName}</div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatPeriodLabel(invoice.periodStart, invoice.periodEnd) || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE[invoice.status]}>
                      {TOURIST_TAX_INVOICE_STATUS_LABELS[invoice.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatEuroDetailed(invoice.amountTtc)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={pendingId === invoice.id}
                        onClick={() => void downloadPdf(invoice)}
                      >
                        {pendingId === invoice.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(invoice)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nouvelle taxe de séjour</DialogTitle>
            <DialogDescription>
              Calcul auto à {TOURIST_TAX_RATE_EUR.toFixed(2).replace(".", ",")} € / adulte / nuitée
              (max {TOURIST_TAX_MAX_ADULTS} adultes).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Événement</label>
              <Select value={weddingId} onValueChange={applyWedding}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un événement" />
                </SelectTrigger>
                <SelectContent>
                  {billableWeddings.map((wedding) => (
                    <SelectItem key={wedding.id} value={String(wedding.id)}>
                      {weddingLabel(wedding)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Arrivée</label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => {
                    setPeriodStart(e.target.value)
                    const nextNights = countStayNights(e.target.value, periodEnd)
                    setLines((prev) =>
                      prev.length === 1 ? [{ ...prev[0], nights: nextNights }] : prev
                    )
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Départ</label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => {
                    setPeriodEnd(e.target.value)
                    const nextNights = countStayNights(periodStart, e.target.value)
                    setLines((prev) =>
                      prev.length === 1 ? [{ ...prev[0], nights: nextNights }] : prev
                    )
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {nights > 0 ? `${nights} nuitée${nights > 1 ? "s" : ""}` : "Période à renseigner"}
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">Client</label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
              <Textarea
                placeholder="Adresse (optionnel)"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Occupation</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setLines((prev) => [
                      ...prev,
                      { key: lineKey(), adults: 0, nights: Math.max(1, nights) },
                    ])
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Ligne
                </Button>
              </div>
              {lines.map((line, index) => (
                <div key={line.key} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={TOURIST_TAX_MAX_ADULTS}
                    placeholder="Adultes"
                    value={line.adults || ""}
                    onChange={(e) => {
                      const adults = Number(e.target.value)
                      setLines((prev) =>
                        prev.map((row) =>
                          row.key === line.key
                            ? {
                                ...row,
                                adults: Number.isFinite(adults) ? adults : 0,
                              }
                            : row
                        )
                      )
                    }}
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Nuitées"
                    value={line.nights || ""}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      setLines((prev) =>
                        prev.map((row) =>
                          row.key === line.key
                            ? {
                                ...row,
                                nights: Number.isFinite(value) ? value : 0,
                              }
                            : row
                        )
                      )
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={lines.length === 1}
                    onClick={() => setLines((prev) => prev.filter((row) => row.key !== line.key))}
                    aria-label={`Supprimer la ligne ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <p className="text-sm font-medium text-gray-900">
                Total : {formatEuroDetailed(previewTotal)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date d&apos;émission</label>
                <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date de paiement</label>
                <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mode de paiement</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optionnel"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void handleCreate()} disabled={createSubmitting}>
              {createSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deleteTarget?.number} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. La facture de taxe de séjour sera effacée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
