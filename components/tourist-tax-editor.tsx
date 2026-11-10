"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Download, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TouristTaxPreview } from "@/components/tourist-tax-document"
import { buildTouristTaxDocument } from "@/lib/tourist-tax-document"
import {
  TOURIST_TAX_INVOICE_STATUS_LABELS,
  type TouristTaxInvoice,
  type TouristTaxInvoiceStatus,
  type TouristTaxOccupancyLine,
} from "@/lib/tourist-tax-invoice-types"
import { TOURIST_TAX_MAX_ADULTS, TOURIST_TAX_RATE_EUR } from "@/lib/tourist-tax"
import {
  formatEuroDetailed,
  occupancyLinesTotal,
} from "@/lib/tourist-tax-invoice-utils"
import { DEFAULT_WORKSPACE_SETTINGS, type WorkspaceSettings } from "@/lib/workspace-settings"
import { loadWorkspaceSettings } from "@/lib/workspace-settings-client"

type EditableLine = TouristTaxOccupancyLine & { key: string }

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

function toEditable(lines: TouristTaxOccupancyLine[]): EditableLine[] {
  return lines.map((line) => ({ ...line, key: lineKey() }))
}

export function TouristTaxEditor({ invoiceId }: { invoiceId: string }) {
  const [invoice, setInvoice] = useState<TouristTaxInvoice | null>(null)
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS)
  const [lines, setLines] = useState<EditableLine[]>([])
  const [clientName, setClientName] = useState("")
  const [clientAddress, setClientAddress] = useState("")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")
  const [issuedAt, setIssuedAt] = useState("")
  const [paidAt, setPaidAt] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<TouristTaxInvoiceStatus>("draft")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, loadedSettings] = await Promise.all([
        fetch(`/api/tourist-tax-invoices/${invoiceId}`, { credentials: "same-origin" }),
        loadWorkspaceSettings(),
      ])
      const payload = (await invRes.json()) as { invoice?: TouristTaxInvoice; error?: string }
      if (!invRes.ok || !payload.invoice) throw new Error(payload.error ?? "Facture introuvable.")
      const inv = payload.invoice
      setInvoice(inv)
      setSettings(loadedSettings)
      setLines(toEditable(inv.lines))
      setClientName(inv.clientName)
      setClientAddress(inv.clientAddress)
      setPeriodStart(inv.periodStart)
      setPeriodEnd(inv.periodEnd)
      setIssuedAt(inv.issuedAt)
      setPaidAt(inv.paidAt)
      setPaymentMethod(inv.paymentMethod || "Espèces")
      setNotes(inv.notes ?? "")
      setStatus(inv.status)
      setDirty(false)
    } catch (e) {
      toast.error("Chargement impossible", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
      setInvoice(null)
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    void load()
  }, [load])

  const preparedLines = useMemo(
    () =>
      lines.map(({ adults, nights }) => ({
        adults: Math.min(TOURIST_TAX_MAX_ADULTS, Math.max(0, Math.floor(Number(adults) || 0))),
        nights: Math.max(0, Math.floor(Number(nights) || 0)),
      })),
    [lines]
  )

  const amount = occupancyLinesTotal(preparedLines, invoice?.rate ?? TOURIST_TAX_RATE_EUR)

  const previewModel = useMemo(() => {
    if (!invoice) return null
    return buildTouristTaxDocument({
      invoice: {
        number: invoice.number,
        periodStart,
        periodEnd,
        issuedAt,
        paidAt,
        paymentMethod,
        lines: preparedLines.filter((line) => line.adults > 0 && line.nights > 0),
        rate: invoice.rate,
        clientName,
        amountTtc: amount,
      },
      settings,
    })
  }, [
    invoice,
    periodStart,
    periodEnd,
    issuedAt,
    paidAt,
    paymentMethod,
    preparedLines,
    clientName,
    amount,
    settings,
  ])

  const markDirty = () => setDirty(true)

  const save = async () => {
    if (!invoice) return
    const validLines = preparedLines.filter((line) => line.adults > 0 && line.nights > 0)
    if (!validLines.length) {
      toast.error("Ajoutez au moins une ligne d'occupation.")
      return
    }
    if (!clientName.trim()) {
      toast.error("Indiquez le nom du client.")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/tourist-tax-invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          lines: validLines,
          periodStart,
          periodEnd,
          issuedAt,
          paidAt,
          paymentMethod,
          clientName: clientName.trim(),
          clientAddress: clientAddress.trim(),
          notes,
          status,
        }),
      })
      const payload = (await response.json()) as { invoice?: TouristTaxInvoice; error?: string }
      if (!response.ok || !payload.invoice) throw new Error(payload.error ?? "Enregistrement impossible.")
      setInvoice(payload.invoice)
      setLines(toEditable(payload.invoice.lines))
      setDirty(false)
      toast.success("Enregistré")
    } catch (e) {
      toast.error("Enregistrement impossible", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
    } finally {
      setSaving(false)
    }
  }

  const downloadPdf = async () => {
    if (!invoice) return
    setDownloading(true)
    try {
      const response = await fetch(`/api/tourist-tax-invoices/${invoice.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          lines: preparedLines.filter((line) => line.adults > 0 && line.nights > 0),
          periodStart,
          periodEnd,
          issuedAt,
          paidAt,
          paymentMethod,
          clientName: clientName.trim(),
          clientAddress: clientAddress.trim(),
          notes,
          status,
        }),
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
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Chargement…
      </div>
    )
  }

  if (!invoice || !previewModel) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-gray-500">Facture de taxe introuvable.</p>
        <Button asChild variant="outline">
          <Link href="/taxe-de-sejour">Retour</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link href="/taxe-de-sejour">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Taxe de séjour
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{invoice.number}</h1>
            <Badge variant="outline" className={STATUS_BADGE[status]}>
              {TOURIST_TAX_INVOICE_STATUS_LABELS[status]}
            </Badge>
            {dirty ? <span className="text-xs text-amber-700">Modifications non enregistrées</span> : null}
          </div>
          <p className="text-sm text-gray-500">{invoice.couple}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void downloadPdf()} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            PDF
          </Button>
          <Button onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Détails</CardTitle>
            <CardDescription>
              Tarif {TOURIST_TAX_RATE_EUR.toFixed(2).replace(".", ",")} € · max{" "}
              {TOURIST_TAX_MAX_ADULTS} adultes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Statut</label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value as TouristTaxInvoiceStatus)
                  markDirty()
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TOURIST_TAX_INVOICE_STATUS_LABELS) as TouristTaxInvoiceStatus[]).map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {TOURIST_TAX_INVOICE_STATUS_LABELS[value]}
                      </SelectItem>
                    )
                  )}
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
                    markDirty()
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
                    markDirty()
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Client</label>
              <Input
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value)
                  markDirty()
                }}
              />
              <Textarea
                value={clientAddress}
                onChange={(e) => {
                  setClientAddress(e.target.value)
                  markDirty()
                }}
                rows={2}
                placeholder="Adresse"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Occupation</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLines((prev) => [...prev, { key: lineKey(), adults: 0, nights: 1 }])
                    markDirty()
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Ligne
                </Button>
              </div>
              {lines.map((line) => (
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
                            ? { ...row, adults: Number.isFinite(adults) ? adults : 0 }
                            : row
                        )
                      )
                      markDirty()
                    }}
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Nuitées"
                    value={line.nights || ""}
                    onChange={(e) => {
                      const nights = Number(e.target.value)
                      setLines((prev) =>
                        prev.map((row) =>
                          row.key === line.key
                            ? { ...row, nights: Number.isFinite(nights) ? nights : 0 }
                            : row
                        )
                      )
                      markDirty()
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={lines.length === 1}
                    onClick={() => {
                      setLines((prev) => prev.filter((row) => row.key !== line.key))
                      markDirty()
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <p className="text-sm font-medium">Total : {formatEuroDetailed(amount)}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Émission</label>
                <Input
                  type="date"
                  value={issuedAt}
                  onChange={(e) => {
                    setIssuedAt(e.target.value)
                    markDirty()
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Paiement</label>
                <Input
                  type="date"
                  value={paidAt}
                  onChange={(e) => {
                    setPaidAt(e.target.value)
                    markDirty()
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mode de paiement</label>
              <Select
                value={paymentMethod || "Espèces"}
                onValueChange={(value) => {
                  setPaymentMethod(value)
                  markDirty()
                }}
              >
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
                onChange={(e) => {
                  setNotes(e.target.value)
                  markDirty()
                }}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <TouristTaxPreview model={previewModel} />
      </div>
    </div>
  )
}
