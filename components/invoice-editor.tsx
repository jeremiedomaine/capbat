"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  Loader2,
  Lock,
  LockOpen,
  Minus,
  Plus,
  Save,
  Trash2,
} from "lucide-react"
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
import { InvoicePreview } from "@/components/invoice-document"
import { buildInvoiceDocument, type InvoiceDocumentWedding } from "@/lib/invoice-document"
import type { InvoiceCatalogItem } from "@/lib/invoice-template"
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceLineItemKind,
  InvoiceParty,
  InvoiceStatus,
} from "@/lib/invoice-types"
import { INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS } from "@/lib/invoice-types"
import { formatEuro, lineItemsTotal } from "@/lib/invoice-utils"
import { DEFAULT_WORKSPACE_SETTINGS, type WorkspaceSettings } from "@/lib/workspace-settings"
import { loadWorkspaceSettings } from "@/lib/workspace-settings-client"

type EditableLine = InvoiceLineItem & { key: string }

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
}

function lineKey() {
  return `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function toEditableLines(items: InvoiceLineItem[]): EditableLine[] {
  return items.map((item) => ({ ...item, key: lineKey() }))
}

function fromEditableLines(lines: EditableLine[]): InvoiceLineItem[] {
  return lines.map(({ key: _key, ...item }) => ({
    ...item,
    label: item.label.trim(),
    description: item.description?.trim() || undefined,
    periodStart: item.periodStart?.trim().slice(0, 10) || undefined,
    periodEnd: item.periodEnd?.trim().slice(0, 10) || undefined,
  }))
}

export function InvoiceEditor({ invoiceId }: { invoiceId: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS)
  const [wedding, setWedding] = useState<InvoiceDocumentWedding | null>(null)
  const [lines, setLines] = useState<EditableLine[]>([])
  const [client, setClient] = useState<InvoiceParty>({ name: "", email: "" })
  const [notes, setNotes] = useState("")
  const [issuedAt, setIssuedAt] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [vatRate, setVatRate] = useState(10)
  const [status, setStatus] = useState<InvoiceStatus>("draft")
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, loadedSettings] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`, { credentials: "same-origin" }),
        loadWorkspaceSettings(),
      ])
      const payload = (await invRes.json()) as { invoice?: Invoice; error?: string }
      if (!invRes.ok || !payload.invoice) throw new Error(payload.error ?? "Facture introuvable.")
      const inv = payload.invoice
      setInvoice(inv)
      setSettings(loadedSettings)
      setLines(toEditableLines(inv.lineItems))
      setClient(inv.client)
      setNotes(inv.notes ?? "")
      setIssuedAt(inv.issuedAt.slice(0, 10))
      setDueAt(inv.dueAt.slice(0, 10))
      setVatRate(inv.vatRate)
      setStatus(inv.status)
      setLocked(inv.locked)
      setDirty(false)

      const wedRes = await fetch(`/api/weddings/${inv.weddingId}`, { credentials: "same-origin" })
      const wedPayload = (await wedRes.json().catch(() => ({}))) as { wedding?: InvoiceDocumentWedding }
      setWedding(wedRes.ok ? wedPayload.wedding ?? null : null)
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

  const draft = useMemo(
    () => ({
      lineItems: fromEditableLines(lines),
      client,
      notes,
      issuedAt,
      dueAt,
      vatRate,
      status,
    }),
    [client, dueAt, issuedAt, lines, notes, status, vatRate]
  )

  const model = useMemo(() => {
    if (!invoice) return null
    return buildInvoiceDocument({
      invoice: { ...invoice, ...draft, locked },
      wedding,
      settings,
    })
  }, [draft, invoice, locked, settings, wedding])

  const amountTtc = useMemo(() => lineItemsTotal(lines), [lines])
  const readOnly = locked

  const markDirty = () => setDirty(true)

  const updateLine = (key: string, patch: Partial<EditableLine>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
    markDirty()
  }

  const addLine = (kind: InvoiceLineItemKind) => {
    setLines((prev) => [
      ...prev,
      {
        key: lineKey(),
        label: kind === "discount" ? "Remise" : "",
        quantity: 1,
        unitPrice: kind === "discount" ? -100 : 0,
        kind,
        periodStart: "",
        periodEnd: "",
      },
    ])
    markDirty()
  }

  const addFromCatalog = (item: InvoiceCatalogItem) => {
    setLines((prev) => [
      ...prev,
      {
        key: lineKey(),
        label: item.label,
        quantity: 1,
        unitPrice: item.unitPrice,
        kind: item.kind,
        periodStart: "",
        periodEnd: "",
      },
    ])
    markDirty()
  }

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((line) => line.key !== key))
    markDirty()
  }

  const moveLine = (index: number, direction: -1 | 1) => {
    setLines((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    markDirty()
  }

  const updateClient = (patch: Partial<InvoiceParty>) => {
    setClient((prev) => ({ ...prev, ...patch }))
    markDirty()
  }

  const save = async () => {
    if (!invoice) return
    if (draft.lineItems.some((line) => !line.label)) {
      toast.error("Une ligne n'a pas de désignation.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...draft, amountTtc, locked }),
      })
      const payload = (await response.json()) as { invoice?: Invoice; error?: string }
      if (!response.ok) throw new Error(payload.error ?? "Enregistrement impossible.")
      if (payload.invoice) {
        setInvoice(payload.invoice)
        setLocked(payload.invoice.locked)
      }
      setDirty(false)
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
    if (!locked && dirty) {
      toast.error("Enregistrez vos modifications avant de verrouiller.")
      return
    }
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
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(draft),
      })
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
      toast.success("PDF téléchargé", {
        description: dirty ? "Version affichée, pas encore enregistrée." : invoice.number,
      })
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

  if (!invoice || !model) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-gray-500">Facture introuvable.</p>
        <Button asChild variant="outline">
          <Link href="/facturation">Retour à la facturation</Link>
        </Button>
      </div>
    )
  }

  const catalog = settings.invoiceTemplate.catalog

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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">{invoice.number}</h1>
            <Badge variant="outline" className={STATUS_BADGE[status]}>
              {INVOICE_STATUS_LABELS[status]}
            </Badge>
            {locked ? (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                <Lock className="w-3 h-3 mr-1" />
                Verrouillée
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-gray-500">
            {INVOICE_TYPE_LABELS[invoice.type]} — {invoice.couple}
            {wedding ? (
              <>
                {" · "}
                <Link href={`/evenements/${invoice.weddingId}`} className="text-blue-600 hover:underline">
                  Voir l&apos;événement
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? <span className="text-xs text-amber-700">Modifications non enregistrées</span> : null}
          <Button type="button" variant="outline" onClick={toggleLock} disabled={saving}>
            {locked ? <LockOpen className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
            {locked ? "Déverrouiller" : "Verrouiller"}
          </Button>
          <Button type="button" variant="outline" onClick={downloadPdf} disabled={downloading}>
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Télécharger le PDF
          </Button>
          <Button type="button" onClick={save} disabled={saving || readOnly || !dirty}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
        </div>
      </div>

      {locked ? (
        <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Cette facture est verrouillée : déverrouillez-la pour la modifier.
        </p>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-6 items-start">
        <div className="space-y-6">
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>Prestations</CardTitle>
              <CardDescription>
                Ajoutez les lignes dont vous avez besoin (libellé et montant libres).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!readOnly ? (
                <div className="flex flex-wrap gap-2">
                  {catalog.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => addFromCatalog(item)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      {item.label}
                      <span className="ml-1 text-gray-500">{formatEuro(item.unitPrice)}</span>
                    </Button>
                  ))}
                  <Button type="button" size="sm" variant="outline" onClick={() => addLine("extra")}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Ligne libre
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => addLine("discount")}>
                    <Minus className="w-3.5 h-3.5 mr-1" />
                    Remise
                  </Button>
                </div>
              ) : null}

              {lines.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">Aucune ligne.</p>
              ) : (
                <div className="space-y-3">
                  {lines.map((line, index) => (
                    <div key={line.key} className="rounded-lg border border-gray-100 p-3 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={line.label}
                          disabled={readOnly}
                          onChange={(e) => updateLine(line.key, { label: e.target.value })}
                          placeholder="Désignation"
                          className="font-medium"
                        />
                        <div className="flex shrink-0">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-8"
                            disabled={readOnly || index === 0}
                            onClick={() => moveLine(index, -1)}
                            title="Monter"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-8"
                            disabled={readOnly || index === lines.length - 1}
                            onClick={() => moveLine(index, 1)}
                            title="Descendre"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-8 text-red-600"
                            disabled={readOnly}
                            onClick={() => removeLine(line.key)}
                            title="Supprimer la ligne"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <span className="text-xs text-gray-500">Date de début</span>
                          <Input
                            type="date"
                            value={line.periodStart?.slice(0, 10) ?? ""}
                            disabled={readOnly}
                            onChange={(e) => updateLine(line.key, { periodStart: e.target.value })}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs text-gray-500">Date de fin</span>
                          <Input
                            type="date"
                            value={line.periodEnd?.slice(0, 10) ?? ""}
                            disabled={readOnly}
                            onChange={(e) => updateLine(line.key, { periodEnd: e.target.value })}
                          />
                        </label>
                      </div>
                      <Input
                        value={line.description ?? ""}
                        disabled={readOnly}
                        onChange={(e) => updateLine(line.key, { description: e.target.value })}
                        placeholder="Détail (facultatif)"
                        className="text-sm"
                      />
                      <div className="grid grid-cols-[90px_1fr_auto] items-center gap-2">
                        <label className="space-y-1">
                          <span className="text-xs text-gray-500">Quantité</span>
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
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs text-gray-500">Prix unitaire TTC (€)</span>
                          <Input
                            type="number"
                            step={0.01}
                            value={line.unitPrice}
                            disabled={readOnly}
                            onChange={(e) => {
                              const unitPrice = Number(e.target.value) || 0
                              updateLine(line.key, {
                                unitPrice,
                                kind: unitPrice < 0 ? "discount" : line.kind === "discount" ? "extra" : line.kind,
                              })
                            }}
                          />
                        </label>
                        <p className="pt-5 text-sm font-medium text-gray-900 text-right min-w-[90px]">
                          {formatEuro(line.quantity * line.unitPrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between border-t border-gray-100 pt-3 text-base font-semibold text-gray-900">
                <span>Total TTC</span>
                <span>{formatEuro(amountTtc)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>Facture</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Statut">
                <Select
                  value={status}
                  disabled={readOnly}
                  onValueChange={(value) => {
                    setStatus(value as InvoiceStatus)
                    markDirty()
                  }}
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
              <Field label="TVA (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={vatRate}
                  disabled={readOnly}
                  onChange={(e) => {
                    setVatRate(Math.max(0, Number(e.target.value) || 0))
                    markDirty()
                  }}
                />
              </Field>
              <Field label="Date d'émission">
                <Input
                  type="date"
                  value={issuedAt}
                  disabled={readOnly}
                  onChange={(e) => {
                    setIssuedAt(e.target.value)
                    markDirty()
                  }}
                />
              </Field>
              <Field label="Échéance">
                <Input
                  type="date"
                  value={dueAt}
                  disabled={readOnly}
                  onChange={(e) => {
                    setDueAt(e.target.value)
                    markDirty()
                  }}
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>Client</CardTitle>
              <CardDescription>Ce qui apparaît dans « Facturé à ».</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nom affiché" className="sm:col-span-2">
                <Input
                  value={client.name}
                  disabled={readOnly}
                  onChange={(e) => updateClient({ name: e.target.value })}
                />
              </Field>
              <Field label="À l'attention de" className="sm:col-span-2">
                <Input
                  value={client.contactName ?? ""}
                  disabled={readOnly}
                  onChange={(e) => updateClient({ contactName: e.target.value })}
                />
              </Field>
              <Field label="Adresse" className="sm:col-span-2">
                <Input
                  value={client.addressLine ?? ""}
                  disabled={readOnly}
                  onChange={(e) => updateClient({ addressLine: e.target.value })}
                />
              </Field>
              <Field label="Code postal">
                <Input
                  value={client.postalCode ?? ""}
                  disabled={readOnly}
                  onChange={(e) => updateClient({ postalCode: e.target.value })}
                />
              </Field>
              <Field label="Ville">
                <Input
                  value={client.city ?? ""}
                  disabled={readOnly}
                  onChange={(e) => updateClient({ city: e.target.value })}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={client.email}
                  disabled={readOnly}
                  onChange={(e) => updateClient({ email: e.target.value })}
                />
              </Field>
              <Field label="Téléphone">
                <Input
                  value={client.phone ?? ""}
                  disabled={readOnly}
                  onChange={(e) => updateClient({ phone: e.target.value })}
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>Note sur la facture</CardTitle>
              <CardDescription>Facultatif, affichée sous les prestations.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                disabled={readOnly}
                onChange={(e) => {
                  setNotes(e.target.value)
                  markDirty()
                }}
                rows={3}
                placeholder="Ex. : arrhes non remboursables en cas d'annulation."
              />
            </CardContent>
          </Card>
        </div>

        <div className="xl:sticky xl:top-6 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Aperçu</p>
          <InvoicePreview model={model} />
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <label className="text-sm font-medium text-gray-800">{label}</label>
      {children}
    </div>
  )
}
