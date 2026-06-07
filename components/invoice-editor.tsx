"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Download,
  GripVertical,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  Save,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Invoice, InvoiceLineItem, InvoiceLineItemKind, InvoiceStatus } from "@/lib/invoice-types"
import { INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS } from "@/lib/invoice-types"
import type { InvoiceCatalogItem, InvoiceTemplate } from "@/lib/invoice-template"
import {
  computeAmountHt,
  computeVatAmount,
  formatEuro,
  formatEuroDetailed,
  lineItemsTotal,
} from "@/lib/invoice-utils"
import { loadWorkspaceSettings } from "@/lib/workspace-settings-client"

type EditableLine = InvoiceLineItem & { key: string }

function lineKey() {
  return `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function toEditableLines(items: InvoiceLineItem[]): EditableLine[] {
  return items.map((item) => ({ ...item, key: lineKey() }))
}

function fromEditableLines(lines: EditableLine[]): InvoiceLineItem[] {
  return lines.map(({ key: _key, ...item }) => item)
}

type Props = {
  invoiceId: string
}

export function InvoiceEditor({ invoiceId }: Props) {
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [template, setTemplate] = useState<InvoiceTemplate | null>(null)
  const [lines, setLines] = useState<EditableLine[]>([])
  const [notes, setNotes] = useState("")
  const [issuedAt, setIssuedAt] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [vatRate, setVatRate] = useState(20)
  const [status, setStatus] = useState<InvoiceStatus>("draft")
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, settings] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`, { credentials: "same-origin" }),
        loadWorkspaceSettings(),
      ])
      const payload = (await invRes.json()) as { invoice?: Invoice; error?: string }
      if (!invRes.ok || !payload.invoice) {
        throw new Error(payload.error ?? "Facture introuvable.")
      }
      const inv = payload.invoice
      setInvoice(inv)
      setTemplate(settings.invoiceTemplate)
      setLines(toEditableLines(inv.lineItems))
      setNotes(inv.notes ?? "")
      setIssuedAt(inv.issuedAt.slice(0, 10))
      setDueAt(inv.dueAt.slice(0, 10))
      setVatRate(inv.vatRate)
      setStatus(inv.status)
      setLocked(inv.locked)
    } catch (e) {
      toast.error("Chargement impossible", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    load()
  }, [load])

  const amountTtc = useMemo(() => lineItemsTotal(lines), [lines])
  const amountHt = useMemo(() => computeAmountHt(amountTtc, vatRate), [amountTtc, vatRate])
  const vatAmount = useMemo(() => computeVatAmount(amountTtc, vatRate), [amountTtc, vatRate])

  const readOnly = locked

  const updateLine = (key: string, patch: Partial<EditableLine>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  const addBlankLine = (kind: InvoiceLineItemKind = "extra") => {
    setLines((prev) => [
      ...prev,
      {
        key: lineKey(),
        label: kind === "discount" ? "Remise" : "Ligne",
        quantity: 1,
        unitPrice: kind === "discount" ? -100 : 0,
        kind,
      },
    ])
  }

  const addFromCatalog = (catalogItem: InvoiceCatalogItem) => {
    setLines((prev) => [
      ...prev,
      {
        key: lineKey(),
        label: catalogItem.label,
        quantity: 1,
        unitPrice: catalogItem.unitPrice,
        kind: catalogItem.kind,
      },
    ])
  }

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((line) => line.key !== key))
  }

  const moveLine = (index: number, direction: -1 | 1) => {
    setLines((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const save = async () => {
    if (!invoice) return
    setSaving(true)
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          lineItems: fromEditableLines(lines),
          amountTtc,
          notes,
          issuedAt,
          dueAt,
          vatRate,
          status,
          locked,
        }),
      })
      const payload = (await response.json()) as { invoice?: Invoice; error?: string }
      if (!response.ok) throw new Error(payload.error ?? "Enregistrement impossible.")
      if (payload.invoice) {
        setInvoice(payload.invoice)
        setLocked(payload.invoice.locked)
      }
      toast.success("Facture enregistrée")
    } catch (e) {
      toast.error("Enregistrement impossible", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleLock = async () => {
    if (!invoice) return
    const nextLocked = !locked
    setSaving(true)
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ locked: nextLocked }),
      })
      const payload = (await response.json()) as { invoice?: Invoice; error?: string }
      if (!response.ok) throw new Error(payload.error ?? "Action impossible.")
      setLocked(nextLocked)
      if (payload.invoice) setInvoice(payload.invoice)
      toast.success(nextLocked ? "Facture verrouillée" : "Facture déverrouillée")
    } catch (e) {
      toast.error("Action impossible", {
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
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, { credentials: "same-origin" })
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "Téléchargement impossible.")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${invoice.number}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success("PDF téléchargé")
    } catch (e) {
      toast.error("Échec du PDF", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Chargement…
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-gray-500">Facture introuvable.</p>
        <Button asChild variant="outline">
          <Link href="/facturation">Retour à la facturation</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-gray-600">
            <Link href="/facturation">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Facturation
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-gray-900">{invoice.number}</h1>
          <p className="text-sm text-gray-500">
            {INVOICE_TYPE_LABELS[invoice.type]} — {invoice.couple}
            {locked ? (
              <span className="ml-2 inline-flex items-center text-amber-700">
                <Lock className="w-3.5 h-3.5 mr-1" />
                Verrouillée
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={toggleLock} disabled={saving}>
            {locked ? (
              <>
                <LockOpen className="w-4 h-4 mr-2" />
                Déverrouiller
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Verrouiller
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={downloadPdf} disabled={downloading}>
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            PDF
          </Button>
          <Button type="button" onClick={save} disabled={saving || readOnly}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Lignes de facturation</CardTitle>
                <CardDescription>
                  Ajoutez des extras, remises ou lignes personnalisées. Total recalculé automatiquement.
                </CardDescription>
              </div>
              {!readOnly ? (
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button type="button" size="sm" variant="outline" onClick={() => addBlankLine("extra")}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Ligne
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => addBlankLine("discount")}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Remise
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {template?.catalog.length && !readOnly ? (
                <div className="rounded-lg border border-dashed border-gray-200 p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Depuis le catalogue
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {template.catalog.map((item) => (
                      <Button
                        key={item.id}
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => addFromCatalog(item)}
                      >
                        {item.label} ({formatEuro(item.unitPrice)})
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {lines.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">Aucune ligne.</p>
              ) : (
                lines.map((line, index) => (
                  <div
                    key={line.key}
                    className="grid grid-cols-1 md:grid-cols-[auto_1fr_80px_120px_auto] gap-2 items-center rounded-lg border border-gray-100 p-3"
                  >
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={readOnly || index === 0}
                        onClick={() => moveLine(index, -1)}
                      >
                        <GripVertical className="w-4 h-4 rotate-180" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={readOnly || index === lines.length - 1}
                        onClick={() => moveLine(index, 1)}
                      >
                        <GripVertical className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input
                      value={line.label}
                      disabled={readOnly}
                      onChange={(e) => updateLine(line.key, { label: e.target.value })}
                      placeholder="Description"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={line.quantity}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateLine(line.key, { quantity: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                    <Input
                      type="number"
                      step={0.01}
                      value={line.unitPrice}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateLine(line.key, {
                          unitPrice: Number(e.target.value) || 0,
                          kind: Number(e.target.value) < 0 ? "discount" : line.kind,
                        })
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-red-600"
                      disabled={readOnly}
                      onClick={() => removeLine(line.key)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}

              <div className="border-t border-gray-100 pt-4 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Total HT</span>
                  <span>{formatEuroDetailed(amountHt)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>TVA ({vatRate} %)</span>
                  <span>{formatEuroDetailed(vatAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900 text-base">
                  <span>Total TTC</span>
                  <span>{formatEuro(amountTtc)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                disabled={readOnly}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Informations complémentaires visibles sur le PDF…"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>Détails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Statut">
                <Select
                  value={status}
                  disabled={readOnly}
                  onValueChange={(v) => setStatus(v as InvoiceStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Date d'émission">
                <Input
                  type="date"
                  value={issuedAt}
                  disabled={readOnly}
                  onChange={(e) => setIssuedAt(e.target.value)}
                />
              </Field>
              <Field label="Échéance">
                <Input
                  type="date"
                  value={dueAt}
                  disabled={readOnly}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </Field>
              <Field label="TVA (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={vatRate}
                  disabled={readOnly}
                  onChange={(e) => setVatRate(Number(e.target.value) || 0)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-1">
              <p className="font-medium text-gray-900">{invoice.client.name}</p>
              {invoice.client.contactName ? <p>{invoice.client.contactName}</p> : null}
              <p>{invoice.client.email}</p>
              {invoice.client.phone ? <p>{invoice.client.phone}</p> : null}
              <Button
                type="button"
                variant="link"
                className="px-0 h-auto"
                onClick={() => router.push(`/evenements/${invoice.weddingId}`)}
              >
                Voir l&apos;événement
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-800">{label}</label>
      {children}
    </div>
  )
}
