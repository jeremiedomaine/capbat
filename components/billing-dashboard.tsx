"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, FileText, Loader2, Lock, Plus, Search, Settings2, Trash2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import type { Invoice, InvoiceOccasion, InvoiceStatus, InvoiceType } from "@/lib/invoice-types"
import { INVOICE_OCCASION_LABELS, INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS } from "@/lib/invoice-types"
import { applyInvoiceTemplateVars, labelTemplateForOccasion } from "@/lib/invoice-template"
import {
  addCalendarDays,
  formatEuro,
  lineItemsTotal,
  parseEuroAmount,
  todayIsoDate,
} from "@/lib/invoice-utils"
import { DEFAULT_WORKSPACE_SETTINGS, type WorkspaceSettings } from "@/lib/workspace-settings"
import { loadWorkspaceSettings } from "@/lib/workspace-settings-client"
import { supportsCapBatBilling, type BookingSource } from "@/lib/booking-source"

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
  bookingSource?: BookingSource
  deposit: { amount: string }
  balance: { amount: string }
}

type CreateLineDraft = {
  key: string
  label: string
  amount: string
  periodStart: string
  periodEnd: string
}

function newCreateLineKey() {
  return `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all")
  const [typeFilter, setTypeFilter] = useState<InvoiceType | "all">("all")
  const [occasionFilter, setOccasionFilter] = useState<InvoiceOccasion | "all">("all")
  const [yearFilter, setYearFilter] = useState<string>("all")
  const [newWeddingId, setNewWeddingId] = useState("")
  const [newType, setNewType] = useState<InvoiceType>("deposit")
  const [newOccasion, setNewOccasion] = useState<InvoiceOccasion>("wedding")
  const [createLines, setCreateLines] = useState<CreateLineDraft[]>([
    { key: newCreateLineKey(), label: "", amount: "", periodStart: "", periodEnd: "" },
  ])
  const [createClientName, setCreateClientName] = useState("")
  const [createContactName, setCreateContactName] = useState("")
  const [createEmail, setCreateEmail] = useState("")
  const [createPhone, setCreatePhone] = useState("")
  const [createAddress, setCreateAddress] = useState("")
  const [createPostalCode, setCreatePostalCode] = useState("")
  const [createCity, setCreateCity] = useState("")
  const [createIssuedAt, setCreateIssuedAt] = useState(todayIsoDate())
  const [createDueAt, setCreateDueAt] = useState("")
  const [createVatRate, setCreateVatRate] = useState(10)
  const [createNotes, setCreateNotes] = useState("")

  const billableWeddings = useMemo(
    () => weddings.filter((w) => supportsCapBatBilling(w.bookingSource)),
    [weddings]
  )

  const selectedWedding = useMemo(
    () => billableWeddings.find((w) => String(w.id) === newWeddingId) ?? null,
    [newWeddingId, billableWeddings]
  )

  const createLinesTotal = useMemo(
    () => createLines.reduce((sum, line) => sum + parseEuroAmount(line.amount), 0),
    [createLines]
  )

  const occasionFromWedding = (wedding: WeddingOption | null): InvoiceOccasion =>
    wedding && wedding.eventType !== "wedding" ? "other" : "wedding"

  const prefillsCreateForm = useCallback(
    (wedding: WeddingOption | null, type: InvoiceType, occasion: InvoiceOccasion) => {
      const template = settings.invoiceTemplate
      if (!wedding) {
        setCreateLines([{ key: newCreateLineKey(), label: "", amount: "", periodStart: "", periodEnd: "" }])
        setCreateClientName("")
        setCreateContactName("")
        setCreateEmail("")
        setCreatePhone("")
        setCreateAddress("")
        setCreatePostalCode("")
        setCreateCity("")
        setCreateNotes("")
        const issued = todayIsoDate()
        setCreateIssuedAt(issued)
        setCreateDueAt(addCalendarDays(issued, template.defaultDueDays))
        setCreateVatRate(template.defaultVatRate)
        return
      }

      const deposit = parseEuroAmount(wedding.deposit.amount)
      const balance = parseEuroAmount(wedding.balance.amount)
      const amount = type === "deposit" ? deposit : type === "balance" ? balance : deposit + balance
      const eventDay = wedding.eventDate.slice(0, 10)
      const context = {
        couple: wedding.couple,
        eventDate: wedding.eventDate,
        eventType: wedding.eventType,
        eventName: wedding.eventName || wedding.couple,
      }
      const labelTemplate = labelTemplateForOccasion(type, template, occasion)

      setCreateLines([
        {
          key: newCreateLineKey(),
          label: applyInvoiceTemplateVars(labelTemplate, context),
          amount: amount > 0 ? String(amount) : "",
          periodStart: eventDay,
          periodEnd: eventDay,
        },
      ])
      setCreateClientName(wedding.couple)
      setCreateContactName(wedding.contactName || "")
      setCreateEmail(wedding.email || "")
      setCreatePhone(wedding.phone || "")
      setCreateAddress(wedding.postalAddress || "")
      setCreatePostalCode("")
      setCreateCity("")
      setCreateNotes("")
      const issued = todayIsoDate()
      setCreateIssuedAt(issued)
      setCreateDueAt(addCalendarDays(issued, template.defaultDueDays))
      setCreateVatRate(template.defaultVatRate)
    },
    [settings.invoiceTemplate]
  )

  const updateCreateLine = (key: string, patch: Partial<CreateLineDraft>) => {
    setCreateLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  const addCreateLine = () => {
    setCreateLines((prev) => [
      ...prev,
      { key: newCreateLineKey(), label: "", amount: "", periodStart: "", periodEnd: "" },
    ])
  }

  const removeCreateLine = (key: string) => {
    setCreateLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)))
  }

  const openCreateDialog = () => {
    setNewWeddingId("")
    setNewType("deposit")
    setNewOccasion("wedding")
    prefillsCreateForm(null, "deposit", "wedding")
    setCreateOpen(true)
  }

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

  const yearOptions = useMemo(() => {
    const years = new Set<string>()
    for (const invoice of invoices) {
      const year = invoice.issuedAt.slice(0, 4)
      if (/^\d{4}$/.test(year)) years.add(year)
    }
    return [...years].sort((a, b) => b.localeCompare(a))
  }, [invoices])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return invoices
      .filter((invoice) => {
        if (statusFilter !== "all" && invoice.status !== statusFilter) return false
        if (typeFilter !== "all" && invoice.type !== typeFilter) return false
        if (occasionFilter !== "all" && invoice.occasion !== occasionFilter) return false
        if (yearFilter !== "all" && invoice.issuedAt.slice(0, 4) !== yearFilter) return false
        if (!needle) return true
        return (
          invoice.number.toLowerCase().includes(needle) ||
          invoice.couple.toLowerCase().includes(needle) ||
          invoice.client.name.toLowerCase().includes(needle)
        )
      })
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.number.localeCompare(a.number))
  }, [invoices, occasionFilter, query, statusFilter, typeFilter, yearFilter])

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

  const handleCreateInvoice = async () => {
    const wedding = selectedWedding
    if (!wedding) {
      toast.error("Sélectionnez un événement.")
      return
    }
    if (!createClientName.trim()) {
      toast.error("Indiquez le nom du client.")
      return
    }

    const prepared = createLines.map((line) => ({
      label: line.label.trim(),
      amount: parseEuroAmount(line.amount),
      periodStart: line.periodStart.trim().slice(0, 10) || undefined,
      periodEnd: line.periodEnd.trim().slice(0, 10) || undefined,
    }))
    if (prepared.some((line) => !line.label)) {
      toast.error("Chaque ligne doit avoir un libellé.")
      return
    }
    if (prepared.every((line) => line.amount === 0)) {
      toast.error("Montant invalide", {
        description: "Indiquez au moins un montant TTC sur une ligne.",
      })
      return
    }

    const lineItems = prepared.map((line) => ({
      label: line.label,
      quantity: 1,
      unitPrice: line.amount,
      kind: (line.amount < 0 ? "discount" : "standard") as "discount" | "standard",
      periodStart: line.periodStart,
      periodEnd: line.periodEnd,
    }))
    const amountTtc = lineItemsTotal(lineItems)
    if (amountTtc <= 0) {
      toast.error("Total invalide", { description: "Le total TTC de la facture doit être positif." })
      return
    }

    setCreateSubmitting(true)
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          weddingId: wedding.id,
          couple: wedding.couple,
          type: newType,
          occasion: newOccasion,
          amountTtc,
          lineItems,
          client: {
            name: createClientName.trim(),
            contactName: createContactName.trim() || undefined,
            email: createEmail.trim(),
            phone: createPhone.trim() || undefined,
            addressLine: createAddress.trim() || undefined,
            postalCode: createPostalCode.trim() || undefined,
            city: createCity.trim() || undefined,
          },
          issuedAt: createIssuedAt || todayIsoDate(),
          dueAt: createDueAt || addCalendarDays(createIssuedAt || todayIsoDate(), settings.invoiceTemplate.defaultDueDays),
          vatRate: createVatRate,
          notes: createNotes.trim() || undefined,
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

  const hasActiveFilters =
    query.trim() !== "" ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    occasionFilter !== "all" ||
    yearFilter !== "all"

  const clearFilters = () => {
    setQuery("")
    setStatusFilter("all")
    setTypeFilter("all")
    setOccasionFilter("all")
    setYearFilter("all")
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[260px]">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="N°, client, événement…"
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InvoiceStatus | "all")}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Statut" />
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
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as InvoiceType | "all")}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="deposit">Acompte</SelectItem>
                  <SelectItem value="balance">Solde</SelectItem>
                  <SelectItem value="full">Globale</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={occasionFilter}
                onValueChange={(v) => setOccasionFilter(v as InvoiceOccasion | "all")}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Occasion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mariage & autre</SelectItem>
                  <SelectItem value="wedding">Mariage</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes années</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters ? (
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  Réinitialiser
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="w-4 h-4 mr-2" />
                Réglages
              </Button>
              <Button type="button" onClick={openCreateDialog} disabled={loading}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle facture
              </Button>
            </div>
          </div>

          {!loading && invoices.length > 0 ? (
            <p className="text-xs text-gray-500">
              {filtered.length} facture{filtered.length > 1 ? "s" : ""}
              {hasActiveFilters ? ` sur ${invoices.length}` : ""}
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-gray-500">
              <FileText className="h-8 w-8 text-gray-300" />
              {invoices.length === 0
                ? "Aucune facture. Créez-en une avec « Nouvelle facture »."
                : "Aucune facture ne correspond aux filtres."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Client</TableHead>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nouvelle facture</DialogTitle>
            <DialogDescription>
              Choisissez l&apos;événement et le type, puis ajustez les paramètres propres à ce client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800">Pour quel type ?</label>
              <div className="grid grid-cols-2 gap-2">
                {(["wedding", "other"] as InvoiceOccasion[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setNewOccasion(value)
                      prefillsCreateForm(selectedWedding, newType, value)
                    }}
                    className={
                      newOccasion === value
                        ? "rounded-md border border-gray-900 bg-gray-900 px-3 py-2 text-sm font-medium text-white"
                        : "rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300"
                    }
                  >
                    {INVOICE_OCCASION_LABELS[value]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                {newOccasion === "wedding"
                  ? "Ton mariage : message chaleureux, ornements discrets."
                  : "Ton autre prestation : plus sobre, sans esprit mariage."}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800">Événement</label>
              <Select
                value={newWeddingId}
                onValueChange={(value) => {
                  setNewWeddingId(value)
                  const wedding = weddings.find((w) => String(w.id) === value) ?? null
                  const occasion = occasionFromWedding(wedding)
                  setNewOccasion(occasion)
                  prefillsCreateForm(wedding, newType, occasion)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un événement" />
                </SelectTrigger>
                <SelectContent>
                  {billableWeddings.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.couple} — {formatFrenchShort(w.eventDate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800">Type de facture</label>
              <Select
                value={newType}
                onValueChange={(v) => {
                  const type = v as InvoiceType
                  setNewType(type)
                  prefillsCreateForm(selectedWedding, type, newOccasion)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Acompte</SelectItem>
                  <SelectItem value="balance">Solde</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedWedding ? (
              <div className="space-y-4 rounded-lg border border-gray-100 bg-gray-50/80 p-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Paramètres de cette facture</p>
                  <p className="text-xs text-gray-500">
                    {INVOICE_TYPE_LABELS[newType]} pour {selectedWedding.couple} — prérempli, modifiable
                    pour ce client.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Lignes de prestation</p>
                      <p className="text-xs text-gray-500">
                        Découpez le prix comme vous voulez (libellé + montant libres). Référence événement
                        {newType === "deposit"
                          ? ` : acompte ${formatEuro(parseEuroAmount(selectedWedding.deposit.amount))}`
                          : newType === "balance"
                            ? ` : solde ${formatEuro(parseEuroAmount(selectedWedding.balance.amount))}`
                            : ` : total ${formatEuro(
                                parseEuroAmount(selectedWedding.deposit.amount) +
                                  parseEuroAmount(selectedWedding.balance.amount)
                              )}`}
                        .
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addCreateLine}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Ajouter une ligne
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {createLines.map((line, index) => (
                      <div key={line.key} className="rounded-md border border-gray-200 bg-white p-3 space-y-2">
                        <div className="grid grid-cols-[1fr_110px_auto] gap-2 items-center">
                          <Input
                            value={line.label}
                            onChange={(e) => updateCreateLine(line.key, { label: e.target.value })}
                            placeholder={`Désignation ${index + 1}`}
                          />
                          <Input
                            type="number"
                            step={0.01}
                            value={line.amount}
                            onChange={(e) => updateCreateLine(line.key, { amount: e.target.value })}
                            placeholder="€ TTC"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-red-600"
                            disabled={createLines.length <= 1}
                            onClick={() => removeCreateLine(line.key)}
                            title="Retirer la ligne"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="space-y-1">
                            <span className="text-xs text-gray-500">Date de début</span>
                            <Input
                              type="date"
                              value={line.periodStart}
                              onChange={(e) => updateCreateLine(line.key, { periodStart: e.target.value })}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs text-gray-500">Date de fin</span>
                            <Input
                              type="date"
                              value={line.periodEnd}
                              onChange={(e) => updateCreateLine(line.key, { periodEnd: e.target.value })}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm font-medium text-gray-900">
                    <span>Total TTC</span>
                    <span>{formatEuro(createLinesTotal)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800">TVA (%)</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={createVatRate}
                      onChange={(e) => setCreateVatRate(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800">Date d&apos;émission</label>
                    <Input
                      type="date"
                      value={createIssuedAt}
                      onChange={(e) => {
                        const issued = e.target.value
                        setCreateIssuedAt(issued)
                        setCreateDueAt(addCalendarDays(issued, settings.invoiceTemplate.defaultDueDays))
                      }}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-gray-800">Échéance</label>
                    <Input type="date" value={createDueAt} onChange={(e) => setCreateDueAt(e.target.value)} />
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3 space-y-3">
                  <p className="text-sm font-medium text-gray-800">Client (facturé à)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-xs text-gray-500">Nom affiché</label>
                      <Input value={createClientName} onChange={(e) => setCreateClientName(e.target.value)} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-xs text-gray-500">À l&apos;attention de</label>
                      <Input value={createContactName} onChange={(e) => setCreateContactName(e.target.value)} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-xs text-gray-500">Adresse</label>
                      <Input value={createAddress} onChange={(e) => setCreateAddress(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">Code postal</label>
                      <Input value={createPostalCode} onChange={(e) => setCreatePostalCode(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">Ville</label>
                      <Input value={createCity} onChange={(e) => setCreateCity(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">E-mail</label>
                      <Input
                        type="email"
                        value={createEmail}
                        onChange={(e) => setCreateEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">Téléphone</label>
                      <Input value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-800">Note (facultatif)</label>
                  <Textarea
                    rows={2}
                    value={createNotes}
                    onChange={(e) => setCreateNotes(e.target.value)}
                    placeholder="Message spécifique à ce client…"
                  />
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleCreateInvoice}
              disabled={createSubmitting || !selectedWedding}
            >
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

function formatFrenchShort(iso: string) {
  const key = iso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return iso
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${key}T12:00:00`))
}
