"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Download,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import type { Invoice, InvoiceParty, InvoiceType } from "@/lib/invoice-types"
import { INVOICE_TYPE_LABELS } from "@/lib/invoice-types"
import {
  addCalendarDays,
  buildLineItemsForType,
  formatEuro,
  lineItemsTotal,
  parseEuroAmount,
  todayIsoDate,
} from "@/lib/invoice-utils"
import {
  BILLING_EVENTS,
  getStoredBillingProfile,
  setStoredBillingProfile,
  type BillingProfile,
} from "@/lib/billing-local-storage"
import {
  getStoredCompanyName,
  getStoredContactEmail,
  getStoredManagerName,
  PROFILE_EVENTS,
} from "@/lib/profile-local-storage"

type WeddingOption = {
  id: number
  couple: string
  contactName: string
  email: string
  phone: string
  eventDate: string
  deposit: { amount: string }
  balance: { amount: string }
}

export function BillingDashboard() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [weddings, setWeddings] = useState<WeddingOption[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const [billingProfile, setBillingProfile] = useState<BillingProfile>(getStoredBillingProfile)
  const [companyName, setCompanyName] = useState("Domaine des Roses")
  const [contactEmail, setContactEmail] = useState("contact@domainedesroses.fr")

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
        toast.error("Impossible de charger les factures", {
          description: invPayload.error?.slice(0, 160),
        })
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
  }, [refresh])

  useEffect(() => {
    const syncProfile = () => {
      setBillingProfile(getStoredBillingProfile())
      setCompanyName(getStoredCompanyName()?.trim() || "Domaine des Roses")
      setContactEmail(getStoredContactEmail()?.trim() || "contact@domainedesroses.fr")
    }
    syncProfile()
    window.addEventListener(BILLING_EVENTS.updated, syncProfile)
    window.addEventListener(PROFILE_EVENTS.company, syncProfile)
    window.addEventListener(PROFILE_EVENTS.contactEmail, syncProfile)
    return () => {
      window.removeEventListener(BILLING_EVENTS.updated, syncProfile)
      window.removeEventListener(PROFILE_EVENTS.company, syncProfile)
      window.removeEventListener(PROFILE_EVENTS.contactEmail, syncProfile)
    }
  }, [])

  const issuerParty = useMemo((): InvoiceParty => {
    return {
      name: companyName,
      contactName: getStoredManagerName()?.trim() || undefined,
      email: contactEmail,
      phone: billingProfile.phone || undefined,
      addressLine: billingProfile.addressLine,
      postalCode: billingProfile.postalCode,
      city: billingProfile.city,
      siret: billingProfile.siret || undefined,
      vatNumber: billingProfile.vatNumber || undefined,
    }
  }, [billingProfile, companyName, contactEmail])

  const saveBillingProfile = () => {
    setStoredBillingProfile(billingProfile)
    toast.success("Coordonnées de facturation enregistrées")
  }

  const downloadPdf = async (invoice: Invoice) => {
    setPendingId(invoice.id)
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, {
        credentials: "same-origin",
      })
      const contentType = response.headers.get("content-type") ?? ""
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "Téléchargement impossible.")
      }
      if (!contentType.includes("pdf")) {
        throw new Error("Le serveur n'a pas renvoyé un PDF valide.")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${invoice.number}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success("PDF téléchargé", { description: invoice.number })
    } catch (e) {
      toast.error("Échec du PDF", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
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
        body: JSON.stringify({
          types: ["deposit", "balance"],
          issuer: issuerParty,
          dueInDays: 30,
          vatRate: 20,
        }),
      })
      const payload = (await response.json()) as {
        created?: Invoice[]
        skipped?: { couple: string; reason: string }[]
        error?: string
      }
      if (!response.ok) throw new Error(payload.error ?? "Génération impossible.")

      await refresh()
      const createdCount = payload.created?.length ?? 0
      const skippedCount = payload.skipped?.length ?? 0
      toast.success(
        createdCount
          ? `${createdCount} facture${createdCount > 1 ? "s" : ""} créée${createdCount > 1 ? "s" : ""}`
          : "Aucune nouvelle facture",
        {
          description:
            skippedCount > 0
              ? `${skippedCount} événement(s) ignoré(s) (déjà facturé ou montant nul).`
              : "Téléchargez les PDF depuis la liste.",
        }
      )
    } catch (e) {
      toast.error("Génération automatique échouée", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
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

    const depositAmount = parseEuroAmount(wedding.deposit.amount)
    const balanceAmount = parseEuroAmount(wedding.balance.amount)
    const lineItems = buildLineItemsForType(
      newType,
      wedding.couple,
      wedding.eventDate,
      depositAmount,
      balanceAmount
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
          issuer: issuerParty,
          client: {
            name: wedding.couple,
            contactName: wedding.contactName,
            email: wedding.email,
            phone: wedding.phone,
          },
          issuedAt,
          dueAt: addCalendarDays(issuedAt, 30),
          vatRate: 20,
          status: "draft",
        }),
      })
      const payload = (await response.json()) as { invoice?: Invoice; error?: string }
      if (!response.ok) throw new Error(payload.error ?? "Création impossible.")
      if (payload.invoice) {
        setInvoices((prev) => [payload.invoice!, ...prev])
      }
      setCreateOpen(false)
      toast.success("Facture créée", { description: payload.invoice?.number })
    } catch (e) {
      toast.error("Création impossible", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
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
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle>Coordonnées de facturation</CardTitle>
          <CardDescription>
            Ces informations apparaissent sur chaque PDF (en-tête émetteur).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Adresse">
            <Input
              value={billingProfile.addressLine}
              onChange={(e) =>
                setBillingProfile((p) => ({ ...p, addressLine: e.target.value }))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code postal">
              <Input
                value={billingProfile.postalCode}
                onChange={(e) =>
                  setBillingProfile((p) => ({ ...p, postalCode: e.target.value }))
                }
              />
            </Field>
            <Field label="Ville">
              <Input
                value={billingProfile.city}
                onChange={(e) => setBillingProfile((p) => ({ ...p, city: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="SIRET">
            <Input
              value={billingProfile.siret}
              onChange={(e) => setBillingProfile((p) => ({ ...p, siret: e.target.value }))}
            />
          </Field>
          <Field label="N° TVA intracommunautaire">
            <Input
              value={billingProfile.vatNumber}
              onChange={(e) =>
                setBillingProfile((p) => ({ ...p, vatNumber: e.target.value }))
              }
            />
          </Field>
          <Field label="Téléphone facturation">
            <Input
              value={billingProfile.phone}
              onChange={(e) => setBillingProfile((p) => ({ ...p, phone: e.target.value }))}
            />
          </Field>
          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="button" variant="outline" onClick={saveBillingProfile}>
              Enregistrer les coordonnées
            </Button>
            <p className="text-xs text-gray-500">
              Nom et e-mail : Paramètres ({companyName})
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-gray-100 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Factures
            </CardTitle>
            <CardDescription>
              Générez automatiquement les factures d&apos;acompte et de solde, puis téléchargez le PDF.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleAutoGenerate}
              disabled={generating || loading}
            >
              {generating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Générer automatiquement
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)} disabled={loading}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle facture
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Chargement…
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">
              Aucune facture pour le moment. Utilisez &laquo;&nbsp;Générer automatiquement&nbsp;&raquo; pour
              créer les factures à partir de vos événements.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Couple</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Émission</TableHead>
                  <TableHead>Montant TTC</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.number}</TableCell>
                    <TableCell>{invoice.couple}</TableCell>
                    <TableCell className="text-gray-600 text-sm">
                      {INVOICE_TYPE_LABELS[invoice.type]}
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm">
                      {formatFrenchShort(invoice.issuedAt)}
                    </TableCell>
                    <TableCell>{formatEuro(invoice.amountTtc)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
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
                          disabled={pendingId === invoice.id}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle facture</DialogTitle>
            <DialogDescription>
              Créez une facture manuelle pour un événement existant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Événement">
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
            </Field>
            <Field label="Type de facture">
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
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleCreateInvoice}
              disabled={createSubmitting || !newWeddingId}
            >
              {createSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-800">{label}</label>
      {children}
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
