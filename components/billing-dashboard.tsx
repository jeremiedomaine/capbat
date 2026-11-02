"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, FileText, Loader2, Lock, Plus, Search, Settings2, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { InvoiceSettingsSheet } from "@/components/invoice-settings-sheet"
import type { Invoice, InvoiceStatus, InvoiceType } from "@/lib/invoice-types"
import { INVOICE_STATUS_LABELS } from "@/lib/invoice-types"
import { buildLineItemsFromTemplate } from "@/lib/invoice-template"
import {
  addCalendarDays,
  formatEuro,
  lineItemsTotal,
  parseEuroAmount,
  todayIsoDate,
} from "@/lib/invoice-utils"
import { DEFAULT_WORKSPACE_SETTINGS, type WorkspaceSettings } from "@/lib/workspace-settings"
import { loadWorkspaceSettings } from "@/lib/workspace-settings-client"

type WeddingOption = {
  id: number
  couple: string
  contactName: string
  email: string
  phone: string
  postalAddress?: string
  eventDate: string
  eventType: "wedding" | "gite" | "other"
  eventName: string
  deposit: { amount: string }
  balance: { amount: string }
}

const TYPE_SHORT_LABELS: Record<InvoiceType, string> = {
  deposit: "Acompte",
  balance: "Solde",
  full: "Globale",
}

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
}

export function BillingDashboard() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [weddings, setWeddings] = useState<WeddingOption[]>([])
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all")
  const [newWeddingId, setNewWeddingId] = useState("")
  const [newType, setNewType] = useState<InvoiceType>("deposit")

  const refresh = useCallback(async () => {
    try {
      const [invRes, wedRes] = await Promise.all([
        fetch("/api/invoices", { credentials: "same-origin" }),
        fetch("/api/weddings", { credentials: "same-origin" }),
      ])
      const invPayload = (await invRes.json()) as { invoices?: Invoice[]; error?: string }
      const wedPayload = (await wedRes.json()) as { weddings?: WeddingOption[] }
      if (!invRes.ok) {
        toast.error("Impossible de charger les factures", { description: invPayload.error?.slice(0, 160) })
        setInvoices([])
      } else {
        setInvoices(invPayload.invoices ?? [])
      }
      setWeddings(wedRes.ok ? wedPayload.weddings ?? [] : [])
    } catch {
      toast.error("Réseau indisponible", { description: "Rechargez la page." })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    loadWorkspaceSettings().then(setSettings)
  }, [refresh])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return invoices.filter((invoice) => {
      if (statusFilter !== "all" && invoice.status !== statusFilter) return false
      if (!needle) return true
      return (
        invoice.number.toLowerCase().includes(needle) ||
        invoice.couple.toLowerCase().includes(needle) ||
        invoice.client.name.toLowerCase().includes(needle)
      )
    })
  }, [invoices, query, statusFilter])

  const totals = useMemo(() => {
    const active = invoices.filter((invoice) => invoice.status !== "cancelled")
    return {
      toCollect: active.filter((i) => i.status !== "paid").reduce((sum, i) => sum + i.amountTtc, 0),
      paid: active.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amountTtc, 0),
      drafts: active.filter((i) => i.status === "draft").length,
    }
  }, [invoices])

  const downloadPdf = async (invoice: Invoice) => {
    setPendingId(invoice.id)
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, { credentials: "same-origin" })
      if (!response.ok || !(response.headers.get("content-type") ?? "").includes("pdf")) {
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
    } catch (e) {
      toast.error("Échec du PDF", { description: e instanceof Error ? e.message : "Réessayez." })
    } finally {
      setPendingId(null)
    }
  }

  const handleAutoGenerate = async () => {
    setGenerating(true)
    try {
      const response = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ types: ["deposit", "balance"] }),
      })
      const payload = (await response.json()) as {
        created?: Invoice[]
        skipped?: { couple: string; reason: string }[]
        error?: string
      }
      if (!response.ok) throw new Error(payload.error ?? "Génération impossible.")
      await refresh()
      const createdCount = payload.created?.length ?? 0
      if (createdCount === 0) {
        toast.message("Rien à créer", {
          description: "Chaque événement avec un acompte et un solde a déjà ses factures.",
        })
        return
      }
      toast.success(`${createdCount} facture${createdCount > 1 ? "s" : ""} créée${createdCount > 1 ? "s" : ""}`)
    } catch (e) {
      toast.error("Création impossible", { description: e instanceof Error ? e.message : "Réessayez." })
    } finally {
      setGenerating(false)
    }
  }

  const handleCreateInvoice = async () => {
    const wedding = weddings.find((w) => String(w.id) === newWeddingId)
    if (!wedding) {
      toast.error("Sélectionnez un événement.")
      return
    }
    const template = settings.invoiceTemplate
    const lineItems = buildLineItemsFromTemplate(
      newType,
      {
        couple: wedding.couple,
        eventDate: wedding.eventDate,
        eventType: wedding.eventType,
        eventName: wedding.eventName,
      },
      template,
      parseEuroAmount(wedding.deposit.amount),
      parseEuroAmount(wedding.balance.amount)
    )
    const amountTtc = lineItemsTotal(lineItems)
    if (amountTtc <= 0) {
      toast.error("Montant invalide", { description: "Vérifiez l'acompte ou le solde de l'événement." })
      return
    }

    setCreateSubmitting(true)
    try {
      const issuedAt = todayIsoDate()
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          weddingId: wedding.id,
          couple: wedding.couple,
          type: newType,
          amountTtc,
          lineItems,
          client: {
            name: wedding.couple,
            contactName: wedding.contactName,
            email: wedding.email,
            phone: wedding.phone,
            addressLine: wedding.postalAddress || undefined,
          },
          issuedAt,
          dueAt: addCalendarDays(issuedAt, template.defaultDueDays),
          vatRate: template.defaultVatRate,
          status: "draft",
        }),
      })
      const payload = (await response.json()) as { invoice?: Invoice; error?: string }
      if (!response.ok || !payload.invoice) throw new Error(payload.error ?? "Création impossible.")
      setCreateOpen(false)
      router.push(`/facturation/${payload.invoice.id}`)
    } catch (e) {
      toast.error("Création impossible", { description: e instanceof Error ? e.message : "Réessayez." })
    } finally {
      setCreateSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setPendingId(deleteTarget.id)
    try {
      const response = await fetch(`/api/invoices/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "Suppression impossible.")
      }
      setInvoices((prev) => prev.filter((row) => row.id !== deleteTarget.id))
      toast.success("Facture supprimée")
    } catch (e) {
      toast.error("Suppression impossible", { description: e instanceof Error ? e.message : "Réessayez." })
    } finally {
      setPendingId(null)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi label="À encaisser" value={formatEuro(totals.toCollect)} />
        <Kpi label="Encaissé" value={formatEuro(totals.paid)} />
        <Kpi label="Brouillons" value={String(totals.drafts)} />
      </div>

      <Card className="bg-white border-gray-100 shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[260px]">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un couple, un n°…"
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InvoiceStatus | "all")}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="w-4 h-4 mr-2" />
                Réglages
              </Button>
              <Button type="button" variant="outline" onClick={handleAutoGenerate} disabled={generating || loading}>
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Créer les factures manquantes
              </Button>
              <Button type="button" onClick={() => setCreateOpen(true)} disabled={loading}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle facture
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-gray-500">
              <FileText className="h-8 w-8 text-gray-300" />
              {invoices.length === 0
                ? "Aucune facture. « Créer les factures manquantes » prépare l'acompte et le solde de chaque événement."
                : "Aucune facture ne correspond à la recherche."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Mariés</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/facturation/${invoice.id}`)}
                  >
                    <TableCell className="font-medium">
                      <Link href={`/facturation/${invoice.id}`} onClick={(e) => e.stopPropagation()}>
                        {invoice.number}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.couple}</TableCell>
                    <TableCell className="text-gray-600 text-sm">{TYPE_SHORT_LABELS[invoice.type]}</TableCell>
                    <TableCell className="text-gray-600 text-sm">{formatFrenchShort(invoice.dueAt)}</TableCell>
                    <TableCell className="text-right font-medium">{formatEuro(invoice.amountTtc)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={STATUS_BADGE[invoice.status]}>
                          {INVOICE_STATUS_LABELS[invoice.status]}
                        </Badge>
                        {invoice.locked ? <Lock className="w-3.5 h-3.5 text-amber-600" aria-label="Verrouillée" /> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pendingId === invoice.id}
                          onClick={() => downloadPdf(invoice)}
                          title="Télécharger le PDF"
                        >
                          {pendingId === invoice.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          disabled={pendingId === invoice.id || invoice.locked}
                          onClick={() => setDeleteTarget(invoice)}
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InvoiceSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSaved={setSettings}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle facture</DialogTitle>
            <DialogDescription>
              Choisissez l&apos;événement : la facture est pré-remplie, vous ajoutez ensuite les extras.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800">Événement</label>
              <Select value={newWeddingId} onValueChange={setNewWeddingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un mariage" />
                </SelectTrigger>
                <SelectContent>
                  {weddings.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.couple} — {formatFrenchShort(w.eventDate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800">Type de facture</label>
              <Select value={newType} onValueChange={(v) => setNewType(v as InvoiceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Acompte</SelectItem>
                  <SelectItem value="balance">Solde</SelectItem>
                  <SelectItem value="full">Globale</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={handleCreateInvoice} disabled={createSubmitting || !newWeddingId}>
              {createSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer et ouvrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              La facture {deleteTarget?.number} sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-white border-gray-100 shadow-sm">
      <CardContent className="pt-5">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  )
}

function formatFrenchShort(iso: string) {
  const key = iso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return iso
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${key}T12:00:00`))
}
